import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export type VaultNote = {
  id: string;
  title: string;
  folder: string;
  content: string;
};

export type VaultFolder = {
  name: string;
  notes: VaultNote[];
};

async function readVaultFromSupabase(): Promise<VaultFolder[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("id, title, folder, content")
    .order("folder")
    .order("title");

  if (error) throw error;

  const folderMap = new Map<string, VaultNote[]>();
  for (const row of data ?? []) {
    const notes = folderMap.get(row.folder) ?? [];
    notes.push({ id: row.id, title: row.title, folder: row.folder, content: row.content });
    folderMap.set(row.folder, notes);
  }

  // Sort folders: Root first, then alphabetical
  const sorted = [...folderMap.entries()].sort(([a], [b]) => {
    if (a === "Root") return -1;
    if (b === "Root") return 1;
    return a.localeCompare(b);
  });

  return sorted.map(([name, notes]) => ({ name, notes }));
}

// GET /api/vault — returns full folder tree with content
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const folders = await readVaultFromSupabase();
    return NextResponse.json({ folders });
  } catch (err) {
    console.error("[vault] read error", err);
    return NextResponse.json({ error: "Failed to read vault" }, { status: 500 });
  }
}

// POST /api/vault/context — given keywords, returns relevant notes as text block
// Body: { keywords: string[] }
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const { keywords = [] }: { keywords: string[] } = await req.json();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("id, title, folder, content");

  if (error) {
    console.error("[vault] context error", error);
    return NextResponse.json({ error: "Failed to read vault" }, { status: 500 });
  }

  const lower = keywords.map((k: string) => k.toLowerCase());

  const relevant = (data ?? []).filter(note => {
    const haystack = (note.title + " " + note.folder + " " + note.content).toLowerCase();
    return lower.some(k => haystack.includes(k));
  });

  const context = relevant
    .map(n => `### ${n.folder} / ${n.title}\n${n.content}`)
    .join("\n\n---\n\n");

  return NextResponse.json({ context, count: relevant.length });
}
