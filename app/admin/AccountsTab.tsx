"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/colors";

type AuthUser = {
  id: string;
  email: string | null;
  provider: string;
  created_at: string;
  confirmed_at: string | null;
};

type Props = {
  showToast: (msg: string, ok?: boolean) => void;
};

export default function AccountsTab({ showToast }: Props) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Failed to load users", false); return; }
      setUsers(json.users ?? []);
    } catch {
      showToast("Failed to load users", false);
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id: string) {
    setDeleting(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Delete failed", false); return; }
      setUsers(prev => prev.filter(u => u.id !== id));
      setDeleteConfirm(null);
      showToast("Account deleted");
    } catch {
      showToast("Delete failed", false);
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>User Accounts</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            {users.length} account{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={fetchUsers}
          style={{ fontSize: 12, fontWeight: 600, color: "#64748b", background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading…</div>
      ) : users.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 14, padding: "40px 0", textAlign: "center" }}>No accounts yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map(user => (
            <div
              key={user.id}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email ?? "(no email)"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    background: user.provider === "email" ? "#f0fdf4" : "#f0f9ff",
                    color: user.provider === "email" ? "#16a34a" : "#0369a1",
                    border: `1px solid ${user.provider === "email" ? "#bbf7d0" : "#bae6fd"}`,
                    borderRadius: 6, padding: "2px 6px",
                  }}>
                    {user.provider}
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {!user.confirmed_at && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      background: "#fefce8", color: "#ca8a04", border: "1px solid #fde68a",
                      borderRadius: 6, padding: "2px 6px",
                    }}>
                      Unconfirmed
                    </span>
                  )}
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                {deleteConfirm === user.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Delete?</span>
                    <button
                      onClick={() => deleteUser(user.id)}
                      disabled={deleting === user.id}
                      style={{
                        fontSize: 12, fontWeight: 700, color: "#fff",
                        background: C.danger, border: "none", borderRadius: 8,
                        padding: "6px 12px", cursor: "pointer", opacity: deleting === user.id ? 0.6 : 1,
                      }}
                    >
                      {deleting === user.id ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      style={{ fontSize: 12, color: "#64748b", background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(user.id)}
                    style={{
                      fontSize: 12, fontWeight: 600, color: C.danger,
                      background: "none", border: `1px solid ${C.danger}30`,
                      borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
