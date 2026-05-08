import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH ??
  "/Users/chrissolo/Documents/Photography Business Soloxsnaps";

const SKIP_DIRS = new Set([".obsidian", ".trash", "99 Archive", "Inbox"]);

type NoteRow = { id: string; title: string; folder: string; content: string; synced_at: string };

function readAllNotes(): NoteRow[] {
  const rows: NoteRow[] = [];
  const now = new Date().toISOString();

  const entries = fs.readdirSync(VAULT_PATH, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      rows.push({
        id: entry.name,
        title: entry.name.replace(".md", ""),
        folder: "Root",
        content: fs.readFileSync(path.join(VAULT_PATH, entry.name), "utf-8"),
        synced_at: now,
      });
    }
  }

  const subdirs = entries
    .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of subdirs) {
    const dirPath = path.join(VAULT_PATH, dir.name);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".md"));
    for (const f of files) {
      rows.push({
        id: `${dir.name}/${f}`,
        title: f.replace(".md", ""),
        folder: dir.name,
        content: fs.readFileSync(path.join(dirPath, f), "utf-8"),
        synced_at: now,
      });
    }
  }

  return rows;
}

// POST /api/vault/sync — reads local vault and upserts into Supabase
export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const notes = readAllNotes();
    const supabase = createSupabaseServerClient();

    const { error } = await supabase
      .from("vault_notes")
      .upsert(notes, { onConflict: "id" });

    if (error) throw error;

    return NextResponse.json({ synced: notes.length });
  } catch (err) {
    console.error("[vault/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
