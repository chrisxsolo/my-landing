import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH
  ?? "/Users/chrissolo/Documents/Photography Business Soloxsnaps";

const SKIP_DIRS = new Set([".obsidian", ".trash", "99 Archive", "Inbox"]);

export type VaultNote = {
  id: string;       // relative path from vault root
  title: string;
  folder: string;
  content: string;
};

export type VaultFolder = {
  name: string;
  notes: VaultNote[];
};

function readVault(): VaultFolder[] {
  const folders: VaultFolder[] = [];

  const entries = fs.readdirSync(VAULT_PATH, { withFileTypes: true });

  // Root-level notes (HOME.md, Welcome.md, CLAUDE_CONTEXT.md)
  const rootNotes: VaultNote[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const fullPath = path.join(VAULT_PATH, entry.name);
      const content = fs.readFileSync(fullPath, "utf-8");
      rootNotes.push({
        id: entry.name,
        title: entry.name.replace(".md", ""),
        folder: "Root",
        content,
      });
    }
  }
  if (rootNotes.length) folders.push({ name: "Root", notes: rootNotes });

  // Subfolders
  const subdirs = entries
    .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of subdirs) {
    const dirPath = path.join(VAULT_PATH, dir.name);
    const noteFiles = fs.readdirSync(dirPath).filter(f => f.endsWith(".md"));
    const notes: VaultNote[] = noteFiles.map(f => {
      const fullPath = path.join(dirPath, f);
      const content = fs.readFileSync(fullPath, "utf-8");
      return {
        id: `${dir.name}/${f}`,
        title: f.replace(".md", ""),
        folder: dir.name,
        content,
      };
    });
    if (notes.length) folders.push({ name: dir.name, notes });
  }

  return folders;
}

// GET /api/vault — returns full folder tree with content
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  try {
    const folders = readVault();
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
  const folders = readVault();
  const allNotes = folders.flatMap(f => f.notes);

  const lower = keywords.map((k: string) => k.toLowerCase());

  const relevant = allNotes.filter(note => {
    const haystack = (note.title + " " + note.folder + " " + note.content).toLowerCase();
    return lower.some(k => haystack.includes(k));
  });

  const context = relevant
    .map(n => `### ${n.folder} / ${n.title}\n${n.content}`)
    .join("\n\n---\n\n");

  return NextResponse.json({ context, count: relevant.length });
}
