"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";

type Message = { role: "user" | "assistant"; content: string };

type RulesData = {
  content: string;
  updated_at: string | null;
  rule_count: number;
};

type DraftResult = { inquiry_id: number; inquiry_name: string; draft: string };

export default function AiTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedRules, setSavedRules] = useState<string[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [rulesData, setRulesData] = useState<RulesData | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Tone sync state
  const [toneLoading, setToneLoading] = useState(false);
  const [toneResult, setToneResult] = useState<{ rules: string[]; written: number; emails_analyzed: number; message?: string } | null>(null);

  // Batch drafts state
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<DraftResult[]>([]);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchSaved, setBatchSaved] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/session/latest", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.messages?.length) {
          setMessages(d.messages as Message[]);
          setSessionId(String(d.id));
        }
      })
      .catch(() => {/* no prior session */})
      .finally(() => setSessionLoading(false));

    fetch("/api/ai/rules", { credentials: "include" })
      .then(r => r.json())
      .then(d => setRulesData(d as RulesData))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    // Add a placeholder assistant message that we'll fill via streaming
    setMessages(p => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/train-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, session_id: sessionId }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let streamText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: "text" | "done" | "error";
              text?: string;
              new_rules?: string[];
              saved_to_vault?: boolean;
              session_id?: string;
              message?: string;
            };

            if (event.type === "text" && event.text) {
              streamText += event.text;
              const captured = streamText;
              setMessages(p => {
                const updated = [...p];
                updated[updated.length - 1] = { role: "assistant", content: captured };
                return updated;
              });
            } else if (event.type === "done") {
              if (event.session_id) setSessionId(event.session_id);
              if (event.new_rules?.length) {
                setSavedRules(event.new_rules);
                setTimeout(() => setSavedRules([]), 5000);
                if (showRules) loadRules();
              }
            } else if (event.type === "error") {
              const errMsg = event.message ?? "Something went wrong. Try again.";
              setMessages(p => {
                const updated = [...p];
                updated[updated.length - 1] = { role: "assistant", content: errMsg };
                return updated;
              });
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch (err) {
      console.error("[AiTab] send error", err);
      setMessages(p => {
        const updated = [...p];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Try again." };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadRules() {
    setRulesLoading(true);
    try {
      const res = await fetch("/api/ai/rules", { credentials: "include" });
      const d = await res.json() as RulesData;
      setRulesData(d);
    } catch (err) {
      console.error("[AiTab] loadRules error", err);
      setRulesData(null);
    } finally {
      setRulesLoading(false);
    }
  }

  function toggleRules() {
    if (!showRules && !rulesData) loadRules();
    setShowRules(p => !p);
  }

  function startNewSession() {
    setMessages([]);
    setSessionId(null);
    setSavedRules([]);
  }

  // ── Batch drafts ──────────────────────────────────────────────────────────

  async function syncToneFromSent() {
    setToneLoading(true);
    setToneResult(null);
    try {
      const res = await fetch("/api/admin/sync-tone-from-sent", { method: "POST" });
      const json = await res.json() as { rules?: string[]; written?: number; emails_analyzed?: number; message?: string; error?: string };
      if (!res.ok || json.error) {
        setToneResult({ rules: [], written: 0, emails_analyzed: 0, message: json.error ?? "Sync failed" });
        return;
      }
      setToneResult({
        rules: json.rules ?? [],
        written: json.written ?? 0,
        emails_analyzed: json.emails_analyzed ?? 0,
        message: json.message,
      });
      if ((json.written ?? 0) > 0 && showRules) loadRules();
    } catch {
      setToneResult({ rules: [], written: 0, emails_analyzed: 0, message: "Sync failed — try again" });
    } finally {
      setToneLoading(false);
    }
  }

  async function startBatch() {
    setBatchLoading(true);
    setBatchMsg(null);
    setBatchResults([]);
    setBatchSaved(false);
    try {
      // Synchronous route: drafts come back in this response, no polling.
      const res = await fetch("/api/admin/batch-drafts", { method: "POST" });
      const json = await res.json() as { results?: DraftResult[]; request_count?: number; error?: string; message?: string };
      if (!res.ok || json.error) {
        setBatchMsg(json.error ?? json.message ?? "Failed to generate drafts");
        return;
      }
      const results = json.results ?? [];
      setBatchResults(results);
      if (results.length === 0) {
        setBatchMsg(json.message ?? "No unanswered inquiries found");
      } else {
        const failed = (json.request_count ?? results.length) - results.length;
        setBatchMsg(`${results.length} draft${results.length !== 1 ? "s" : ""} generated${failed > 0 ? ` (${failed} failed)` : ""}.`);
      }
    } catch {
      setBatchMsg("Failed to generate drafts");
    } finally {
      setBatchLoading(false);
    }
  }

  function saveDraftsToLocalStorage() {
    for (const r of batchResults) {
      localStorage.setItem(`draft_${r.inquiry_id}`, r.draft);
      localStorage.setItem(`ai_draft_${r.inquiry_id}`, r.draft);
    }
    setBatchSaved(true);
    setBatchMsg(`${batchResults.length} drafts saved — open the Inquiries tab to use them.`);
  }

  const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900">AI Training</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Chat to teach Claude how to write your emails. Rules save automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleRules}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors"
            style={showRules
              ? { background: "rgba(99,102,241,0.1)", color: "#6366f1", borderColor: "rgba(99,102,241,0.3)" }
              : { background: "#fff", color: "#64748b", borderColor: "rgba(0,0,0,0.08)" }}>
            {showRules ? "Hide Rules" : "View Live Rules"}
            {rulesData ? ` (${rulesData.rule_count})` : ""}
          </button>
          <button
            onClick={startNewSession}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border"
            style={{ background: "#fff", color: "#64748b", borderColor: "rgba(0,0,0,0.08)" }}>
            New Session
          </button>
        </div>
      </div>

      {/* Rules summary bar */}
      {rulesData && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: "#6366f1" }}>⚡</span>
            <span className="font-semibold" style={{ color: "#4338ca" }}>
              Claude knows {rulesData.rule_count} rule{rulesData.rule_count !== 1 ? "s" : ""}
            </span>
            {rulesData.updated_at && (
              <span className="text-slate-400">
                · last updated {new Date(rulesData.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            onClick={toggleRules}
            className="text-xs font-bold px-2.5 py-1 rounded-lg border"
            style={{ borderColor: "rgba(99,102,241,0.25)", color: "#6366f1", background: "#fff" }}>
            {showRules ? "Hide" : "See all"}
          </button>
        </div>
      )}

      {/* Rules Inspector */}
      {showRules && (
        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-slate-900">Live Email Rules</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  This is the exact note Claude reads before every draft.
                  {rulesData?.updated_at
                    ? ` Last updated ${new Date(rulesData.updated_at).toLocaleDateString()}.`
                    : ""}
                </p>
              </div>
              <button
                onClick={loadRules}
                disabled={rulesLoading}
                className="text-xs font-bold px-2 py-1 rounded-lg border disabled:opacity-40"
                style={{ borderColor: C.p1_20, color: C.p1 }}>
                {rulesLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {rulesLoading && !rulesData ? (
              <div className="h-24 flex items-center justify-center text-slate-400 text-sm animate-pulse">
                Loading rules…
              </div>
            ) : rulesData?.content ? (
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 rounded-xl p-3 max-h-72 overflow-y-auto border"
                style={{ borderColor: C.p1_15 }}>
                {rulesData.content}
              </pre>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">
                No rules saved yet — start chatting to teach Claude your style.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Training Chat */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />

        <div className="p-4 space-y-3 min-h-[200px] max-h-[480px] overflow-y-auto">
          {sessionLoading ? (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm animate-pulse">
              Loading session…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <p className="text-sm text-slate-400">
                Tell Claude how you want your emails written.
              </p>
              <p className="text-xs text-slate-300">
                e.g. &quot;Never add a travel fee for South Bay shoots&quot; · &quot;Keep replies under 4 sentences&quot; · &quot;Always mention the turnaround time upfront&quot;
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={m.role === "user"
                    ? { background: C.grad12, color: "#fff" }
                    : { background: "rgba(99,102,241,0.08)", color: "#3730a3", border: "1px solid rgba(99,102,241,0.15)" }}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>
                <span className="animate-spin inline-block mr-1">◌</span> Thinking…
              </div>
            </div>
          )}
          {savedRules.length > 0 && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
              ✓ {savedRules.length} rule{savedRules.length > 1 ? "s" : ""} saved — Claude will use {savedRules.length > 1 ? "them" : "it"} in future drafts
              <ul className="mt-1 space-y-0.5 list-none">
                {savedRules.map((r, i) => <li key={i} className="truncate opacity-80">· {r}</li>)}
              </ul>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="e.g. Don't add travel fees for South Bay shoots…"
            disabled={loading || sessionLoading}
            className="flex-1 text-sm px-3 py-2.5 rounded-xl outline-none disabled:opacity-50"
            style={{ border: `1px solid ${C.p1_20}`, background: "#fff", fontFamily: "inherit" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || sessionLoading}
            className="text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-30 flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
            Send
          </button>
        </div>
      </div>

      {/* Sync Tone from Sent Emails */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#06b6d4,#3b82f6)" }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-black text-slate-900">Sync Tone from Sent Mail</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Reads your last 7 days of sent emails, extracts style rules, and saves them to the vault automatically.
              </p>
            </div>
            <button
              onClick={syncToneFromSent}
              disabled={toneLoading}
              className="text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-40 flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#06b6d4,#3b82f6)", color: "#fff" }}>
              {toneLoading ? "Analyzing…" : "Sync Now"}
            </button>
          </div>

          {toneLoading && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", color: "#0891b2" }}>
              <span className="animate-spin inline-block">◌</span>
              Fetching sent emails and analyzing your writing style…
            </div>
          )}

          {toneResult && !toneLoading && (
            <div className="mt-3 space-y-2">
              {toneResult.message && !toneResult.rules.length ? (
                <p className="text-xs text-slate-400 px-1">{toneResult.message}</p>
              ) : (
                <div className="px-3 py-2.5 rounded-xl text-xs space-y-1"
                  style={{ background: toneResult.written > 0 ? "rgba(16,185,129,0.06)" : "rgba(99,102,241,0.06)", border: `1px solid ${toneResult.written > 0 ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.15)"}` }}>
                  <p className="font-semibold" style={{ color: toneResult.written > 0 ? "#059669" : "#4338ca" }}>
                    {toneResult.written > 0
                      ? `✓ ${toneResult.written} new rule${toneResult.written !== 1 ? "s" : ""} saved from ${toneResult.emails_analyzed} emails`
                      : `Analyzed ${toneResult.emails_analyzed} emails — all rules already in vault`}
                  </p>
                  {toneResult.rules.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-slate-500">
                      {toneResult.rules.map((r, i) => <li key={i}>· {r}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Batch Draft Generation */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#f59e0b,#f97316)" }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-black text-slate-900">Batch Draft All Inquiries</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates reply drafts for every unanswered inquiry in one go. Takes a minute or two.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={startBatch}
                disabled={batchLoading}
                className="text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)", color: "#fff" }}>
                {batchLoading ? "Generating…" : "Generate Drafts"}
              </button>
            </div>
          </div>

          {/* Results */}
          {batchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">{batchResults.length} drafts ready</p>
                <button
                  onClick={saveDraftsToLocalStorage}
                  disabled={batchSaved}
                  className="text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-50"
                  style={{ background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {batchSaved ? "Saved to Inquiries ✓" : "Load into Inquiries tab"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {batchResults.map(r => (
                  <div key={r.inquiry_id} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 mb-1">{r.inquiry_name}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{r.draft}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback message */}
          {batchMsg && (
            <p className="mt-2 text-xs" style={{ color: batchMsg.includes("Failed") ? "#ef4444" : "#64748b" }}>
              {batchMsg}
            </p>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-4 text-xs text-slate-400 leading-relaxed"
        style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)" }}>
        <p className="font-bold text-slate-600 mb-1">How it works</p>
        <p>Every rule you teach here is saved to your vault and injected into Claude&apos;s system prompt before every draft. Rules are timestamped — newer rules always win over older ones. You can also teach Claude by clicking &quot;Analyze &amp; Learn&quot; on any inquiry after you edit an AI draft.</p>
      </div>

    </div>
  );
}
