"use client";
import { useEffect, useState, useMemo } from "react";
import { C } from "@/lib/colors";
import type { VaultFolder, VaultNote } from "@/app/api/vault/route";

export default function VaultTab() {
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<VaultNote | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  function loadVault() {
    setLoading(true);
    fetch("/api/vault", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setFolders(d.folders ?? []);
        if (d.folders?.length) {
          const first = d.folders[0];
          setOpenFolders(new Set([first.name]));
          if (first.notes.length) setSelectedNote(first.notes[0]);
        }
      })
      .catch(() => setError("Could not load vault"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadVault(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch("/api/vault/sync", { method: "POST", credentials: "include" });
      const d = await r.json();
      if (d.error) { setSyncMsg(`Error: ${d.error}`); return; }
      setSyncMsg(`Synced ${d.synced} notes`);
      loadVault();
    } catch {
      setSyncMsg("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredFolders = useMemo(() => {
    if (!search.trim()) return folders;
    const q = search.toLowerCase();
    return folders
      .map(f => ({
        ...f,
        notes: f.notes.filter(n =>
          n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
        ),
      }))
      .filter(f => f.notes.length > 0);
  }, [folders, search]);

  function toggleFolder(name: string) {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (loading) return <div style={{ padding: 32, color: "#94a3b8" }}>Loading vault...</div>;
  if (error) return <div style={{ padding: 32, color: "#ef4444" }}>{error}</div>;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", gap: 0 }}>
      {/* Sidebar */}
      <div style={{
        width: 260,
        flexShrink: 0,
        borderRight: `1px solid ${C.borderSubtle}`,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        background: C.surface,
      }}>
        {/* Sync */}
        <div style={{ padding: "12px 12px 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: `1px solid ${C.borderSubtle}`,
              background: syncing ? "#e2e8f0" : C.p1,
              color: syncing ? "#94a3b8" : "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: syncing ? "not-allowed" : "pointer",
            }}
          >
            {syncing ? "Syncing…" : "Sync Vault"}
          </button>
          {syncMsg && (
            <span style={{ fontSize: 12, color: syncMsg.startsWith("Error") ? "#ef4444" : "#22c55e" }}>
              {syncMsg}
            </span>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "4px 12px 8px" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vault..."
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 8,
              border: `1px solid ${C.borderSubtle}`,
              background: "#fff",
              color: "#1e293b",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Folder tree */}
        {filteredFolders.map(folder => (
          <div key={folder.name}>
            <button
              onClick={() => toggleFolder(folder.name)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "6px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 9 }}>{openFolders.has(folder.name) ? "▼" : "▶"}</span>
              {folder.name}
            </button>
            {openFolders.has(folder.name) && folder.notes.map(note => (
              <button
                key={note.id}
                onClick={() => setSelectedNote(note)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 12px 5px 24px",
                  background: selectedNote?.id === note.id ? C.p1_08 : "none",
                  border: "none",
                  cursor: "pointer",
                  color: selectedNote?.id === note.id ? C.p1 : "#1e293b",
                  fontSize: 13,
                  borderRadius: 0,
                }}
              >
                {note.title}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Note viewer */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {selectedNote ? (
          <>
            <div style={{ marginBottom: 6, fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {selectedNote.folder}
            </div>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, color: "#1e293b" }}>{selectedNote.title}</h2>
            <MarkdownRenderer content={selectedNote.content} />
          </>
        ) : (
          <div style={{ color: "#94a3b8", paddingTop: 40 }}>Select a note to read it</div>
        )}
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} style={{ fontSize: 20, margin: "16px 0 8px", color: "#1e293b" }}>{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} style={{ fontSize: 17, margin: "14px 0 6px", color: "#1e293b" }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} style={{ fontSize: 15, margin: "12px 0 4px", color: "#1e293b" }}>{line.slice(4)}</h3>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
          <span style={{ color: C.p1, flexShrink: 0 }}>•</span>
          <span style={{ color: "#1e293b", fontSize: 14, lineHeight: 1.6 }}>{line.slice(2)}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 8 }} />);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} style={{ border: "none", borderTop: `1px solid ${C.borderSubtle}`, margin: "12px 0" }} />);
    } else {
      elements.push(<p key={i} style={{ margin: "0 0 6px", color: "#1e293b", fontSize: 14, lineHeight: 1.6 }}>{line}</p>);
    }
    i++;
  }

  return <div>{elements}</div>;
}
