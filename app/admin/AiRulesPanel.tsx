"use client";
// Rules queue and usage panel for the AI tab.
//
// Replaces the old "Live Email Rules" inspector, which rendered one markdown
// note as a read-only <pre>. There was no way to approve, reject, or retire
// anything, so contradictory rules just piled up in the note.
//
// Three things live here: the permanent profile (fixed, in code), the learned
// rules grouped by status with approve/reject, and month-to-date spend.

import { useCallback, useEffect, useState } from "react";
import { C } from "@/lib/colors";

type Rule = {
  id: string;
  rule: string;
  category: "style" | "policy" | "factual";
  status: "pending" | "approved" | "rejected" | "superseded";
  source: string;
  createdAt: string;
};

type ConflictInfo = { id: string; rule: string; reason: string };

type RulesResponse = {
  permanent: { hardRules: string[]; styleNotes: string[]; bannedPhrases: string[]; source: string };
  learned: { pending: Rule[]; approved: Rule[]; rejected: Rule[]; superseded: Rule[] };
  activeInPrompt: Rule[];
};

type UsageResponse = {
  summary: {
    month: string;
    estimatedSpendUsd: number;
    unknownModels: string[];
    draftsGenerated: number;
    regenerations: number;
    failures: number;
    avgCostPerDraftUsd: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    avgDurationMs: number;
    cacheHitRate: number;
    topModel: string | null;
  };
  budget: { spentUsd: number; budgetUsd: number; percentUsed: number; state: string; message: string | null };
  config: { model: string; effort: string; unpricedModel: boolean; monthlyBudgetUsd: number; enforceLimit: boolean };
  disclaimer: string;
};

const card = "bg-white rounded-2xl border overflow-hidden";
const cardStyle = { borderColor: "rgba(0,0,0,0.08)" };

export default function AiRulesPanel() {
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showPermanent, setShowPermanent] = useState(false);
  // Conflicts the server refused to approve over, keyed by the rule that hit
  // them. Resolved by retiring the old rule in the same write.
  const [conflicts, setConflicts] = useState<Record<string, ConflictInfo[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, usageRes] = await Promise.all([
        fetch("/api/ai/rules", { credentials: "include" }),
        fetch("/api/ai/usage", { credentials: "include" }),
      ]);
      setRules(await rulesRes.json() as RulesResponse);
      setUsage(await usageRes.json() as UsageResponse);
    } catch (err) {
      console.error("[AiRulesPanel] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * Approve or reject a rule.
   *
   * A 409 means approving it would contradict a rule already in use. The
   * server refuses rather than letting both go live; passing `supersedes`
   * approves the new rule and retires the old one in one write.
   */
  async function act(
    id: string,
    action: "approve" | "reject",
    supersedes?: string[],
  ) {
    setBusyId(id);
    try {
      const res = await fetch("/api/ai/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, action, ...(supersedes ? { supersedes } : {}) }),
      });

      if (res.status === 409) {
        const json = await res.json() as { conflicts?: ConflictInfo[] };
        setConflicts(prev => ({ ...prev, [id]: json.conflicts ?? [] }));
        return;
      }

      setConflicts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      console.error("[AiRulesPanel] action failed", err);
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !rules) {
    return (
      <div className={card} style={cardStyle}>
        <div className="h-24 flex items-center justify-center text-slate-400 text-sm animate-pulse">
          Loading rules…
        </div>
      </div>
    );
  }

  const pending = rules?.learned.pending ?? [];
  const approved = rules?.learned.approved ?? [];
  const activeCount = rules?.activeInPrompt.length ?? 0;

  return (
    <div className="space-y-4">
      {/* ── Usage ──────────────────────────────────────────────────────────── */}
      {usage && (
        <div className={card} style={cardStyle}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#10b981,#059669)" }} />
          <div className="p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="text-sm font-black text-slate-900">Claude usage this month</p>
              <p className="text-xs text-slate-400">{usage.config.model} · effort {usage.config.effort}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="Estimated spend"
                value={`$${usage.summary.estimatedSpendUsd.toFixed(2)}`}
                sub={`of $${usage.config.monthlyBudgetUsd} target`}
              />
              <Stat label="Drafts" value={String(usage.summary.draftsGenerated)}
                sub={`${usage.summary.regenerations} regenerated`} />
              <Stat
                label="Per draft"
                value={usage.summary.draftsGenerated ? `$${usage.summary.avgCostPerDraftUsd.toFixed(4)}` : "—"}
                sub={`${Math.round(usage.summary.avgInputTokens)} in / ${Math.round(usage.summary.avgOutputTokens)} out`}
              />
              <Stat
                label="Cache hits"
                value={`${Math.round(usage.summary.cacheHitRate * 100)}%`}
                sub={`${(usage.summary.avgDurationMs / 1000).toFixed(1)}s avg`}
              />
            </div>

            {/* Budget bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, usage.budget.percentUsed)}%`,
                  background: usage.budget.state === "over" ? "#ef4444"
                    : usage.budget.state === "warning" ? "#f59e0b" : "#10b981",
                }} />
            </div>

            {usage.budget.message && (
              <p className="text-xs font-semibold"
                style={{ color: usage.budget.state === "over" ? "#dc2626" : "#b45309" }}>
                {usage.budget.message}
              </p>
            )}
            {usage.summary.failures > 0 && (
              <p className="text-xs text-slate-400">{usage.summary.failures} failed request{usage.summary.failures === 1 ? "" : "s"} this month.</p>
            )}
            {usage.config.unpricedModel && (
              <p className="text-xs font-semibold" style={{ color: "#dc2626" }}>
                {usage.config.model} is not in the rate card, so spend for it cannot be estimated.
              </p>
            )}
            <p className="text-[10px] leading-snug text-slate-400">{usage.disclaimer}</p>
          </div>
        </div>
      )}

      {/* ── Pending approval ───────────────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#f59e0b,#d97706)" }} />
        <div className="p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-black text-slate-900">
                Waiting for approval {pending.length > 0 ? `(${pending.length})` : ""}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Nothing here affects a draft until you approve it.
              </p>
            </div>
            <button onClick={load} disabled={loading}
              className="text-xs font-bold px-2 py-1 rounded-lg border disabled:opacity-40"
              style={{ borderColor: C.p1_20, color: C.p1 }}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {pending.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-5">
              Nothing pending. Rules show up here from Learn from edit and from training chat.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map(rule => (
                <li key={rule.id} className="p-3 rounded-xl space-y-2"
                  style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)" }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug text-slate-700">{rule.rule}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {rule.category}
                        {/* A factual rule is kept for reference but can never reach a prompt. */}
                        {rule.category === "factual" ? " · never sent to Claude" : ""}
                        {" · from "}{rule.source}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => act(rule.id, "approve")} disabled={busyId === rule.id}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
                        style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}>
                        Approve
                      </button>
                      <button onClick={() => act(rule.id, "reject")} disabled={busyId === rule.id}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
                        style={{ background: "rgba(0,0,0,0.04)", color: "#64748b" }}>
                        Reject
                      </button>
                    </div>
                  </div>

                  {conflicts[rule.id]?.length > 0 && (
                    <div className="rounded-lg p-2.5 space-y-1.5"
                      style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#dc2626" }}>
                        Contradicts a rule already in use
                      </p>
                      {conflicts[rule.id].map(conflict => (
                        <p key={conflict.id} className="text-[11px] leading-snug text-slate-600">
                          &ldquo;{conflict.rule}&rdquo;
                        </p>
                      ))}
                      <button
                        onClick={() => act(rule.id, "approve", conflicts[rule.id].map(c => c.id))}
                        disabled={busyId === rule.id}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg disabled:opacity-40"
                        style={{ background: "rgba(16,185,129,0.12)", color: "#047857" }}>
                        Approve this and retire the old one
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Active in the prompt ───────────────────────────────────────────── */}
      <div className={card} style={cardStyle}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-black text-slate-900">
              Learned rules Claude uses {activeCount > 0 ? `(${activeCount})` : ""}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Exactly what gets sent with the next draft, on top of your permanent profile.
            </p>
          </div>

          {approved.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-5">
              No learned rules approved yet. Your permanent profile is doing the work.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {approved.map(rule => (
                <li key={rule.id} className="flex items-start gap-2">
                  <span className="mt-1 flex-shrink-0 text-[10px]" style={{ color: C.p1 }}>●</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs leading-snug text-slate-600">{rule.rule}</span>
                    {rule.category !== "style" && (
                      <span className="text-[10px] text-slate-400 ml-1.5">({rule.category}, not sent)</span>
                    )}
                  </div>
                  <button onClick={() => act(rule.id, "reject")} disabled={busyId === rule.id}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 disabled:opacity-40"
                    style={{ background: "rgba(0,0,0,0.04)", color: "#94a3b8" }}>
                    Retire
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Permanent profile ─────────────────────────────────────────────── */}
      {rules && (
        <div className={card} style={cardStyle}>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">Your permanent writing profile</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Always active, and always wins over a learned rule. Lives in code, not in the database.
                </p>
              </div>
              <button onClick={() => setShowPermanent(p => !p)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg border flex-shrink-0"
                style={{ borderColor: "rgba(0,0,0,0.08)", color: "#64748b" }}>
                {showPermanent ? "Hide" : "Show"}
              </button>
            </div>

            {showPermanent && (
              <div className="mt-3 space-y-3">
                <RuleList title="Hard rules" items={rules.permanent.hardRules} />
                <RuleList title="Style" items={rules.permanent.styleNotes} />
                <RuleList title="Phrases never used" items={rules.permanent.bannedPhrases} />
                <p className="text-[10px] text-slate-400 font-mono">{rules.permanent.source}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
      <p className="text-lg font-black text-slate-900 leading-tight">{value}</p>
      <p className="text-[10px] text-slate-400">{sub}</p>
    </div>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-1">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-slate-600 leading-snug">· {item}</li>
        ))}
      </ul>
    </div>
  );
}
