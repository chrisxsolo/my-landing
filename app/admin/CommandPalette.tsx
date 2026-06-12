"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/app/admin/adminTheme";

export type PaletteTab = { key: string; icon: string; label: string };
export type PaletteAction = { key: string; icon: string; label: string; run: () => void };
export type PaletteClient = { id: number; name: string; email: string; sessionType: string | null; paid: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  tabs: PaletteTab[];
  actions: PaletteAction[];
  clients: PaletteClient[];
  onGo: (tabKey: string) => void;
  onOpenClient: (id: number) => void;
};

type Item =
  | { kind: "tab"; tab: PaletteTab }
  | { kind: "action"; action: PaletteAction }
  | { kind: "client"; client: PaletteClient };

const MAX_CLIENTS = 6;

export default function CommandPalette(props: Props) {
  // Mount the inner palette fresh each time it opens so query/selection reset
  // without effects.
  if (!props.open) return null;
  return <PaletteInner {...props} />;
}

function PaletteInner({ onClose, tabs, actions, clients, onGo, onOpenClient }: Props) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // focus after the pop-in animation starts
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const items = useMemo<Item[]>(() => {
    const q = query.toLowerCase().trim();
    const tabHits = tabs.filter(t => !q || t.label.toLowerCase().includes(q));
    const actionHits = actions.filter(a => !q || a.label.toLowerCase().includes(q));
    const clientHits = q
      ? clients.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, MAX_CLIENTS)
      : [];
    return [
      ...clientHits.map(client => ({ kind: "client" as const, client })),
      ...tabHits.map(tab => ({ kind: "tab" as const, tab })),
      ...actionHits.map(action => ({ kind: "action" as const, action })),
    ];
  }, [query, tabs, actions, clients]);

  function execute(item: Item) {
    if (item.kind === "tab") onGo(item.tab.key);
    else if (item.kind === "action") item.action.run();
    else onOpenClient(item.client.id);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && items[idx]) { e.preventDefault(); execute(items[idx]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  const groupLabel = (kind: Item["kind"]) =>
    kind === "client" ? "Clients" : kind === "tab" ? "Go to" : "Actions";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh]"
         style={{ background: T.scrim, backdropFilter: "blur(6px)" }}
         onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden adm-pop"
           style={{ background: T.panelSolid, border: `1px solid ${T.borderStrong}`, boxShadow: T.shadowHover }}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: `1px solid ${T.rowBorder}` }}>
          <span style={{ color: T.action }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setIdx(0); }}
            onKeyDown={onKeyDown}
            placeholder="Jump to a tab, find a client, run an action…"
            className="flex-1 py-3.5 bg-transparent outline-none text-sm font-medium"
            style={{ color: T.ink, fontFamily: "inherit" }}
          />
          <kbd className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: T.inset, color: T.inkFaint, fontFamily: T.mono }}>esc</kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm" style={{ color: T.inkFaint }}>Nothing matches “{query}”.</p>
          )}
          {items.map((item, i) => {
            const active = i === idx;
            const showHeader = i === 0 || items[i - 1].kind !== item.kind;
            return (
              <div key={item.kind === "tab" ? `t-${item.tab.key}` : item.kind === "action" ? `a-${item.action.key}` : `c-${item.client.id}`}>
                {showHeader && (
                  <p className="px-4 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.2em]"
                     style={{ color: T.inkFaint, fontFamily: T.mono }}>
                    {groupLabel(item.kind)}
                  </p>
                )}
                <button
                  onClick={() => execute(item)}
                  onMouseEnter={() => setIdx(i)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                  style={{ background: active ? T.inset : "transparent" }}>
                  {item.kind === "client" ? (
                    <>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                            style={{ background: item.client.paid ? T.greenBg : T.insetStrong, color: item.client.paid ? T.green : T.inkSoft }}>
                        {item.client.name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold truncate" style={{ color: T.ink }}>{item.client.name}</span>
                        <span className="block text-[11px] truncate" style={{ color: T.inkFaint }}>
                          {item.client.sessionType || "Session"} · {item.client.email}
                        </span>
                      </span>
                      {item.client.paid && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: T.greenBg, color: T.green }}>PAID</span>}
                    </>
                  ) : (
                    <>
                      <span className="w-7 text-center flex-shrink-0">{item.kind === "tab" ? item.tab.icon : item.action.icon}</span>
                      <span className="flex-1 text-sm font-semibold" style={{ color: T.ink }}>
                        {item.kind === "tab" ? item.tab.label : item.action.label}
                      </span>
                    </>
                  )}
                  {active && <span className="text-[10px] flex-shrink-0" style={{ color: T.action, fontFamily: T.mono }}>↵</span>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 text-[10px]" style={{ borderTop: `1px solid ${T.rowBorder}`, color: T.inkFaint, fontFamily: T.mono }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto" style={{ color: T.action }}>⌘K</span>
        </div>
      </div>
    </div>
  );
}
