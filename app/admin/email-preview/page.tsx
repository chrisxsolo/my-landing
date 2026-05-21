"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/colors";

export default function EmailPreviewPage() {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("email_preview_html");
      if (stored) setHtml(stored);
    } catch { /* ignore */ }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f0f0", fontFamily: "inherit" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 py-3 sticky top-0 z-10"
        style={{
          background: "#fff",
          borderBottom: `1px solid ${C.p1_15}`,
          boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
        }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.close()}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: C.p1_08, color: C.p1 }}>
            ← Close
          </button>
          <div>
            <p className="text-sm font-black text-slate-900">Email Preview</p>
            <p className="text-[11px] text-slate-400">This is exactly what your client will see</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.10)", color: "#059669" }}>
            ✓ HTML email
          </span>
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: C.p1_08, color: C.p1 }}>
            Plain-text fallback included
          </span>
        </div>
      </div>

      {/* Preview area — simulates an email client */}
      <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 16px 64px" }}>
        {/* Email client chrome mockup */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}>
          {/* Fake email client header */}
          <div style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e7eb", padding: "14px 18px" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
              <div className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
              <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">
              From: Chris Solorzano &lt;your@gmail.com&gt;
            </p>
          </div>

          {/* The actual email HTML */}
          {html ? (
            <iframe
              srcDoc={html}
              title="Email preview"
              style={{ width: "100%", height: 700, border: "none", display: "block", background: "#fffaf5" }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div style={{ padding: 48, textAlign: "center", background: "#fff" }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
              <p style={{ color: "#64748b", fontWeight: 600 }}>No email to preview</p>
              <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
                Open this page from the reminders panel by clicking "👁 Preview"
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
