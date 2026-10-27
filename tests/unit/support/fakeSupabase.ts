// A small in-memory stand-in for the supabase-js query builder, for loader and
// sync tests. Like PostgREST it returns at most `serverCap` rows per request
// and says nothing when it cuts a result short, so an un-paged read of a big
// table silently loses rows here exactly as it does in production.
//
// Supported: select (columns ignored; rows are stored with any embeds already
// inside), eq, neq, in, is, not(col, "is", null), contains, order, range,
// limit, single, maybeSingle, insert, update, upsert, delete, rpc.
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export interface FakeOp { table: string; kind: "insert" | "update" | "upsert" | "delete"; payload?: unknown; matched: Row[] }

export interface FakeOptions {
  serverCap?: number;
  /** Fail a read of this table; `fromRow` limits it to pages starting at or after that row. */
  failRead?: { table: string; fromRow?: number; message?: string };
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
}

export interface FakeSupabase {
  client: SupabaseClient;
  tables: Record<string, Row[]>;
  ops: FakeOp[];
  /** Every read as [table, from, to] (to = null for an un-ranged read). */
  reads: [string, number, number | null][];
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number }> {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private rangeFrom = 0;
  private rangeTo: number | null = null;
  private max: number | null = null;
  private kind: "select" | FakeOp["kind"] = "select";
  private payload: unknown = null;
  private one: "single" | "maybe" | null = null;
  private returning = false;

  constructor(private fake: FakeSupabase, private table: string, private opts: FakeOptions) {}

  select() { if (this.kind !== "select") this.returning = true; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this; }
  neq(col: string, v: unknown) { this.filters.push((r) => r[col] !== v); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  is(col: string, v: unknown) { this.filters.push((r) => (r[col] ?? null) === v); return this; }
  not(col: string, op: string, v: unknown) {
    if (op !== "is" || v !== null) throw new Error(`fake: unsupported not(${op})`);
    this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }
  contains(col: string, vs: unknown[]) {
    this.filters.push((r) => Array.isArray(r[col]) && vs.every((v) => (r[col] as unknown[]).includes(v)));
    return this;
  }
  order(col: string, o: { ascending?: boolean } = {}) { this.orders.push({ col, asc: o.ascending !== false }); return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  insert(p: unknown) { this.kind = "insert"; this.payload = p; return this; }
  update(p: unknown) { this.kind = "update"; this.payload = p; return this; }
  upsert(p: unknown) { this.kind = "upsert"; this.payload = p; return this; }
  delete() { this.kind = "delete"; return this; }

  private rows(): Row[] {
    return (this.fake.tables[this.table] ??= []);
  }

  private matched(): Row[] {
    const rows = this.rows().filter((r) => this.filters.every((f) => f(r)));
    return this.orders.length === 0 ? rows : [...rows].sort((a, b) => {
      for (const { col, asc } of this.orders) {
        const c = compare(a[col], b[col]);
        if (c !== 0) return asc ? c : -c;
      }
      return 0;
    });
  }

  private read() {
    this.fake.reads.push([this.table, this.rangeFrom, this.rangeTo]);
    const fail = this.opts.failRead;
    if (fail && fail.table === this.table && this.rangeFrom >= (fail.fromRow ?? 0)) {
      return { data: null, error: { message: fail.message ?? "statement timeout" } };
    }
    const cap = this.opts.serverCap ?? 1000;
    const wanted = this.rangeTo === null ? cap : Math.min(cap, this.rangeTo - this.rangeFrom + 1);
    const page = this.matched().slice(this.rangeFrom, this.rangeFrom + Math.min(wanted, this.max ?? wanted));
    if (this.one) return page.length === 1 || (this.one === "maybe" && page.length === 0)
      ? { data: page[0] ?? null, error: null }
      : { data: null, error: { message: `expected one row, got ${page.length}` } };
    return { data: page, error: null };
  }

  private write() {
    const list = Array.isArray(this.payload) ? (this.payload as Row[]) : [this.payload as Row];
    if (this.kind === "insert" || this.kind === "upsert") {
      const added = list.map((r, i) => ({ id: this.rows().length + i + 1, ...r }));
      this.rows().push(...added);
      this.fake.ops.push({ table: this.table, kind: this.kind, payload: this.payload, matched: added });
      const data = this.returning ? (this.one ? added[0] : added) : null;
      return { data, error: null };
    }
    const hit = this.matched();
    if (this.kind === "delete") this.fake.tables[this.table] = this.rows().filter((r) => !hit.includes(r));
    else hit.forEach((r) => Object.assign(r, this.payload));
    this.fake.ops.push({ table: this.table, kind: this.kind as FakeOp["kind"], payload: this.payload, matched: hit });
    return { data: null, error: null };
  }

  then<A, B>(
    ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null,
    bad?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const result = this.kind === "select" ? this.read() : this.write();
    return Promise.resolve(result).then(ok, bad);
  }
}

export function fakeSupabase(tables: Record<string, Row[]>, opts: FakeOptions = {}): FakeSupabase {
  const fake = { tables, ops: [], reads: [] } as unknown as FakeSupabase;
  fake.client = {
    from: (table: string) => new Query(fake, table, opts),
    rpc: (name: string, args: Record<string, unknown>) => {
      const handler = opts.rpc?.[name];
      return Promise.resolve(handler
        ? { data: handler(args), error: null }
        : { data: null, error: { message: `fake: no rpc ${name}` } });
    },
  } as unknown as SupabaseClient;
  return fake;
}

/** Rows 0..n-1 built by `make`, for big-library tests. */
export function manyRows(n: number, make: (i: number) => Row): Row[] {
  return Array.from({ length: n }, (_, i) => make(i));
}
