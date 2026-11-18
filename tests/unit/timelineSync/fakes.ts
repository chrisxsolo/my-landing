// In-memory Gmail and Supabase stand-ins for timeline-sync tests. Synthetic
// data only — no real client names, addresses, amounts, or document links.

export type Row = Record<string, unknown>;
export type WriteLog = { op: "update" | "insert" | "upsert"; table: string; values: Row; id?: unknown };

export function createFakeDb(tables: Record<string, Row[]>, options: { failUpdatesOn?: string[] } = {}) {
  const writes: WriteLog[] = [];
  const rowsOf = (table: string) => (tables[table] ??= []);
  let nextId = 1;

  function selectChain(table: string) {
    let rows = [...rowsOf(table)];
    const result = () => Promise.resolve({ data: rows, error: null });
    const chain = {
      order: () => chain,
      limit: () => chain,
      eq: (column: string, value: unknown) => { rows = rows.filter(r => r[column] === value); return chain; },
      is: (column: string, value: unknown) => { rows = rows.filter(r => (r[column] ?? null) === value); return chain; },
      ilike: (column: string, pattern: string) => {
        const literal = pattern.replace(/\\(.)/g, "$1").toLowerCase();
        rows = rows.filter(r => String(r[column] ?? "").toLowerCase() === literal);
        return chain;
      },
      returns: result,
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => result().then(resolve),
    };
    return chain;
  }

  function runUpdate(table: string, values: Row, column: string, value: unknown) {
    if (options.failUpdatesOn?.includes(table)) return { data: null, error: { message: "write refused" } };
    const matched = rowsOf(table).filter(r => r[column] === value);
    matched.forEach(row => Object.assign(row, values));
    writes.push({ op: "update", table, values, id: value });
    return { data: matched.map(r => ({ id: r.id })), error: null };
  }

  const client = {
    from: (table: string) => ({
      select: () => selectChain(table),
      update: (values: Row) => ({
        eq: (column: string, value: unknown) => {
          let outcome: ReturnType<typeof runUpdate> | null = null;
          const run = () => (outcome ??= runUpdate(table, values, column, value));
          return {
            select: async () => run(),
            then: (resolve: (v: { error: unknown }) => unknown) => Promise.resolve({ error: run().error }).then(resolve),
          };
        },
      }),
      insert: async (values: Row) => {
        rowsOf(table).push({ id: `new-${nextId++}`, ...values });
        writes.push({ op: "insert", table, values });
        return { error: null };
      },
      upsert: async (values: Row) => {
        writes.push({ op: "upsert", table, values });
        return { error: null };
      },
    }),
  };
  return { client, writes, tables };
}

export type FakeMail = {
  id: string;
  /** Which search finds it: a discovery stage, or `thread:<client address>`. */
  box: "provider" | "sent_documents" | "sent" | "payments" | "signed" | `thread:${string}`;
  from: string;
  to: string;
  subject: string;
  at: string;
  snippet?: string;
  body?: string;
  labelIds?: string[];
};

function boxForQuery(query: string): string {
  if (query.includes("pixiesetmail.com")) return "provider";
  if (query.startsWith("in:sent (subject:")) return "sent_documents";
  if (query.startsWith("in:sent newer_than")) return "sent";
  if (query.includes("venmo.com")) return "payments";
  if (query.includes("docusign")) return "signed";
  const thread = query.match(/^from:(\S+) OR to:/);
  return thread ? `thread:${thread[1]}` : "unknown";
}

const base64Url = (text: string) =>
  Buffer.from(text, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

function toGmailMessage(mail: FakeMail, full: boolean) {
  return {
    id: mail.id,
    internalDate: String(Date.parse(mail.at)),
    labelIds: mail.labelIds ?? ["INBOX"],
    snippet: mail.snippet ?? "",
    payload: {
      headers: [
        { name: "From", value: mail.from },
        { name: "To", value: mail.to },
        { name: "Subject", value: mail.subject },
      ],
      ...(full ? { mimeType: "text/plain", body: { data: base64Url(mail.body ?? mail.snippet ?? "") } } : {}),
    },
  };
}

/**
 * A fetch() that answers Gmail list/get calls from `mailbox`. `failBoxes`
 * makes the matching searches return that HTTP status instead.
 */
export function createFakeGmail(mailbox: FakeMail[], failBoxes: Record<string, number> = {}) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  return async (input: string | URL) => {
    const url = new URL(String(input));
    const query = url.searchParams.get("q");
    if (url.pathname.endsWith("/messages") && query !== null) {
      const box = boxForQuery(query);
      const status = failBoxes[box] ?? failBoxes["*"];
      if (status) return json({}, status);
      return json({ messages: mailbox.filter(m => m.box === box).map(m => ({ id: m.id })) });
    }
    const id = url.pathname.split("/messages/")[1];
    const mail = mailbox.find(m => m.id === id);
    if (!mail) return json({}, 404);
    return json(toGmailMessage(mail, url.searchParams.get("format") === "full"));
  };
}
