"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/colors";
import {
  DEFAULT_NAV_CONFIG,
  type NavConfig,
  type NavItem,
  type NavGroup,
  type NavChild,
} from "@/lib/navConfig";

type Props = { showToast: (msg: string, ok?: boolean) => void };

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  padding: "7px 10px",
  border: `1px solid ${C.borderSubtle}`,
  borderRadius: 8,
  background: C.white,
  color: C.ink,
  fontSize: 13,
  fontWeight: 600,
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 3 };

function btn(active = false): React.CSSProperties {
  return {
    padding: "6px 11px",
    border: `1px solid ${C.borderSubtle}`,
    borderRadius: 8,
    background: active ? C.p1_10 : C.white,
    color: active ? C.ink : C.inkSoft,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <span style={labelStyle}>{label}</span>
      <input style={inputStyle} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function clone(c: NavConfig): NavConfig {
  return JSON.parse(JSON.stringify(c));
}

export default function NavigationTab({ showToast }: Props) {
  const [config, setConfig] = useState<NavConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/nav-config");
        const json = await res.json();
        if (!res.ok) { showToast(json.error ?? "Failed to load navigation", false); return; }
        setConfig(json.config);
      } catch {
        showToast("Failed to load navigation", false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !config) {
    return <p style={{ color: C.muted, fontSize: 14, padding: 20 }}>Loading navigation…</p>;
  }

  const primary = config.primary;
  const setPrimary = (next: NavItem[]) => setConfig({ ...config, primary: next });

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= primary.length) return;
    const next = [...primary];
    [next[index], next[j]] = [next[j], next[index]];
    setPrimary(next);
  }
  function patchItem(id: string, patch: Partial<NavItem>) {
    setPrimary(primary.map((it) => (it.id === id ? ({ ...it, ...patch } as NavItem) : it)));
  }
  function removeItem(id: string) {
    setPrimary(primary.filter((it) => it.id !== id));
  }
  function addLink() {
    const id = `link-${Date.now()}`;
    setPrimary([...primary, { id, type: "link", label: "New link", href: "/", visible: true }]);
  }
  function addGroup() {
    const id = `group-${Date.now()}`;
    setPrimary([...primary, { id, type: "group", label: "New menu", href: null, visible: true, children: [] }]);
  }
  function patchGroup(groupId: string, updater: (g: NavGroup) => NavGroup) {
    setPrimary(primary.map((it) => (it.id === groupId && it.type === "group" ? updater(it) : it)));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/nav-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Save failed", false); return; }
      setConfig(json.config); // reflect server-side normalization
      showToast("Navigation saved ✓");
      fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
    } catch {
      showToast("Save failed", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.ink, margin: 0 }}>Navigation bar</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn()} onClick={() => setConfig(clone(DEFAULT_NAV_CONFIG))}>Reset to default</button>
          <button style={{ ...btn(), background: C.p1, color: C.white, borderColor: C.p1, opacity: saving ? 0.6 : 1 }}
            disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </div>
      <p style={{ color: C.muted, fontSize: 13, margin: "0 0 18px" }}>
        Reorder, rename, hide, or relink the items in the top nav. Use a menu for dropdowns.
        Links must be on-site paths starting with “/”. Changes go live after you save.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {primary.map((item, i) => (
          <div key={item.id} style={{
            border: `1px solid ${C.borderSubtle}`, borderRadius: 12, padding: 12,
            background: item.visible ? C.surface : C.p1_04,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button style={{ ...btn(), padding: "1px 7px", opacity: i === 0 ? 0.35 : 1 }}
                  disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button>
                <button style={{ ...btn(), padding: "1px 7px", opacity: i === primary.length - 1 ? 0.35 : 1 }}
                  disabled={i === primary.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase",
                letterSpacing: 0.5, minWidth: 44,
              }}>
                {item.type === "group" ? "Menu" : "Link"}
              </span>
              <Field label="Label" value={item.label} onChange={(v) => patchItem(item.id, { label: v })} />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
                <input type="checkbox" checked={item.visible}
                  onChange={(e) => patchItem(item.id, { visible: e.target.checked })} />
                Shown
              </label>
              <button style={{ ...btn(), color: C.danger, borderColor: C.danger }}
                onClick={() => removeItem(item.id)}>Remove</button>
            </div>

            {item.type === "link" ? (
              <Field label="Link (path)" value={item.href} placeholder="/about"
                onChange={(v) => patchItem(item.id, { href: v })} />
            ) : (
              <GroupEditor group={item} patchGroup={patchGroup} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={btn()} onClick={addLink}>+ Add link</button>
        <button style={btn()} onClick={addGroup}>+ Add menu</button>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 800, color: C.ink, margin: "28px 0 10px" }}>Right-side actions</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <ActionEditor title="Client login link" action={config.clientLogin}
          onChange={(patch) => setConfig({ ...config, clientLogin: { ...config.clientLogin, ...patch } })} />
        <ActionEditor title="Call-to-action button" action={config.cta}
          onChange={(patch) => setConfig({ ...config, cta: { ...config.cta, ...patch } })} />
      </div>
    </div>
  );
}

// ── Dropdown menu editor (header link + children) ────────────────────────────
function GroupEditor({ group, patchGroup }: {
  group: NavGroup; patchGroup: (id: string, updater: (g: NavGroup) => NavGroup) => void;
}) {
  const hasHeaderLink = group.href != null;

  const setChildren = (children: NavChild[]) => patchGroup(group.id, (g) => ({ ...g, children }));
  const moveChild = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= group.children.length) return;
    const next = [...group.children];
    [next[index], next[j]] = [next[j], next[index]];
    setChildren(next);
  };
  const patchChild = (id: string, patch: Partial<NavChild>) =>
    setChildren(group.children.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
        <input type="checkbox" checked={hasHeaderLink}
          onChange={(e) => patchGroup(group.id, (g) => ({ ...g, href: e.target.checked ? "/" : null }))} />
        Menu title is also a clickable link
      </label>
      {hasHeaderLink && (
        <Field label="Menu link (path)" value={group.href ?? ""} placeholder="/portfolio"
          onChange={(v) => patchGroup(group.id, (g) => ({ ...g, href: v }))} />
      )}

      <div style={{ borderLeft: `2px solid ${C.borderSubtle}`, paddingLeft: 10, display: "grid", gap: 8 }}>
        {group.children.map((child, i) => (
          <div key={child.id} style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button style={{ ...btn(), padding: "1px 6px", opacity: i === 0 ? 0.35 : 1 }}
                disabled={i === 0} onClick={() => moveChild(i, -1)} aria-label="Move up">▲</button>
              <button style={{ ...btn(), padding: "1px 6px", opacity: i === group.children.length - 1 ? 0.35 : 1 }}
                disabled={i === group.children.length - 1} onClick={() => moveChild(i, 1)} aria-label="Move down">▼</button>
            </div>
            <Field label="Label" value={child.label} onChange={(v) => patchChild(child.id, { label: v })} />
            <Field label="Link (path)" value={child.href} placeholder="/pricing/grads"
              onChange={(v) => patchChild(child.id, { href: v })} />
            <button style={{ ...btn(), color: C.danger, borderColor: C.danger }}
              onClick={() => setChildren(group.children.filter((c) => c.id !== child.id))}>✕</button>
          </div>
        ))}
        <button style={{ ...btn(), justifySelf: "start" }}
          onClick={() => setChildren([
            ...group.children,
            { id: `child-${Date.now()}`, label: "New item", href: "/" },
          ])}>
          + Add dropdown item
        </button>
      </div>
    </div>
  );
}

// ── Right-side action editor (client login / CTA) ────────────────────────────
function ActionEditor({ title, action, onChange }: {
  title: string;
  action: { label: string; href: string; visible: boolean };
  onChange: (patch: Partial<{ label: string; href: string; visible: boolean }>) => void;
}) {
  return (
    <div style={{ border: `1px solid ${C.borderSubtle}`, borderRadius: 12, padding: 12, background: C.surface }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{title}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: C.inkSoft }}>
          <input type="checkbox" checked={action.visible}
            onChange={(e) => onChange({ visible: e.target.checked })} />
          Shown
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="Label" value={action.label} onChange={(v) => onChange({ label: v })} />
        <Field label="Link (path)" value={action.href} placeholder="/contact"
          onChange={(v) => onChange({ href: v })} />
      </div>
    </div>
  );
}
