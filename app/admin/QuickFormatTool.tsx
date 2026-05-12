"use client";
import { useState, useCallback } from "react";
import { C } from "@/lib/colors";

type Channel = "email" | "imessage" | "instagram" | "general";

const CHANNEL_META: Record<Channel, { label: string; emoji: string; placeholder: string }> = {
  email:     { label: "Email",     emoji: "✉️",  placeholder: "Jot rough notes, bullet points, or voice-to-text — AI will polish it into a proper email." },
  imessage:  { label: "iMessage",  emoji: "💬",  placeholder: "Type what you want to say — AI will keep it conversational and text-friendly." },
  instagram: { label: "Instagram", emoji: "📸",  placeholder: "Write your rough reply — AI will make it warm and on-brand for IG DMs." },
  general:   { label: "General",   emoji: "📝",  placeholder: "Anything — AI will clean it up and make it clear." },
};

type Props = {
  clients?: { name: string; email: string }[];
};

export default function QuickFormatTool({ clients = [] }: Props) {
  const [channel, setChannel]         = useState<Channel>("email");
  const [clientName, setClientName]   = useState("");
  const [rawText, setRawText]         = useState("");
  const [result, setResult]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [copied, setCopied]           = useState(false);
  const [error, setError]             = useState("");
  const [showClients, setShowClients] = useState(false);

  const filteredClients = clients.filter(c =>
    clientName.trim().length > 0 &&
    c.name.toLowerCase().includes(clientName.toLowerCase())
  ).slice(0, 6);

  const polish = useCallback(async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setError("");
    setResult("");

    const channelHint: Record<Channel, string> = {
      email:     "Format this as a clean professional email.",
      imessage:  "Format this as a casual, friendly iMessage/text — keep it short, warm, conversational. No formal greetings needed.",
      instagram: "Format this as a warm Instagram DM reply — friendly, personal, on-brand. Short paragraphs, no stiff language.",
      general:   "Clean up and format this message clearly.",
    };

    try {
      const res = await fetch("/api/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      clientName.trim() || "them",
          email:     "unknown@unknown.com",
          message:   rawText,
          raw_draft: rawText,
          session_type: channelHint[channel],
        }),
      });
      const json = await res.json();
      if (json.draft) setResult(json.draft);
      else setError(json.error ?? "Polish failed");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }, [rawText, clientName, channel]);

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function reset() {
    setRawText("");
    setResult("");
    setError("");
    setClientName("");
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
      <div className="h-[3px]" style={{ background: C.grad12 }} />
      <div className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>Quick Format</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Paste rough notes or voice-to-text — AI polishes it instantly.</p>
          </div>
          {(rawText || result) && (
            <button onClick={reset} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">
              Clear
            </button>
          )}
        </div>

        {/* Channel picker */}
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(CHANNEL_META) as Channel[]).map(ch => {
            const meta = CHANNEL_META[ch];
            const active = channel === ch;
            return (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                style={active
                  ? { background: C.grad12, color: "#fff" }
                  : { background: "rgba(148,163,184,0.08)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.15)" }
                }
              >
                <span>{meta.emoji}</span> {meta.label}
              </button>
            );
          })}
        </div>

        {/* Client name (optional) */}
        <div className="relative">
          <input
            className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50 text-slate-700"
            placeholder="Client name (optional — helps personalize the message)"
            value={clientName}
            onChange={e => { setClientName(e.target.value); setShowClients(true); }}
            onFocus={() => setShowClients(true)}
            onBlur={() => setTimeout(() => setShowClients(false), 150)}
            style={{ fontFamily: "inherit" }}
          />
          {showClients && filteredClients.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              {filteredClients.map(c => (
                <button
                  key={c.email}
                  onMouseDown={() => { setClientName(c.name); setShowClients(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="text-xs text-slate-400">{c.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Raw input */}
        <textarea
          rows={5}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50 text-slate-700 resize-none"
          placeholder={CHANNEL_META[channel].placeholder}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          style={{ fontFamily: "inherit" }}
        />

        {/* Polish button */}
        <button
          onClick={polish}
          disabled={loading || !rawText.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
          style={{ background: C.grad12 }}
        >
          {loading ? "Polishing…" : "✨ AI Polish"}
        </button>

        {error && (
          <p className="text-xs text-red-500 font-semibold">{error}</p>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Polished</p>
              <button
                onClick={copy}
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
                style={copied
                  ? { background: "rgba(16,185,129,0.12)", color: "#10b981" }
                  : { background: C.p1_08, color: C.p1 }
                }
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-3">
              <textarea
                rows={6}
                className="w-full text-sm text-slate-700 bg-transparent outline-none resize-none"
                value={result}
                onChange={e => setResult(e.target.value)}
                style={{ fontFamily: "inherit" }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
