"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";

type Message = { role: "user" | "assistant"; content: string };

type RulesData = {
  content: string;
  updated_at: string | null;
  rule_count: number;
};

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

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load most recent training session on mount
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
    try {
      const res = await fetch("/api/train-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, session_id: sessionId }),
      });
      const json = await res.json() as {
        reply: string;
        new_rules: string[];
        saved_to_vault: boolean;
        session_id: string;
      };
      setMessages(p => [...p, { role: "assistant", content: json.reply }]);
      if (json.session_id) setSessionId(json.session_id);
      if (json.new_rules?.length) {
        setSavedRules(json.new_rules);
        setTimeout(() => setSavedRules([]), 5000);
        if (showRules) loadRules();
      }
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
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
    } catch {
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

        {/* Chat history */}
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
                  className="max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                  style={m.role === "user"
                    ? { background: C.grad12, color: "#fff" }
                    : { background: "rgba(99,102,241,0.08)", color: "#3730a3", border: "1px solid rgba(99,102,241,0.15)" }}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
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

        {/* Input */}
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

      {/* How it works */}
      <div className="rounded-2xl p-4 text-xs text-slate-400 leading-relaxed"
        style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)" }}>
        <p className="font-bold text-slate-600 mb-1">How it works</p>
        <p>Every rule you teach here is saved to your vault and injected into Claude&apos;s system prompt before every draft. Rules are timestamped — newer rules always win over older ones. You can also teach Claude by clicking &quot;Analyze &amp; Learn&quot; on any inquiry after you edit an AI draft.</p>
      </div>

    </div>
  );
}
