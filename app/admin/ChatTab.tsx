"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How should I price a 2-hour family session?",
  "Write 3 Instagram caption ideas for grad season",
  "What's a good follow-up cadence for unresponsive inquiries?",
  "Give me 5 blog post ideas for SJSU grads",
];

export default function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    // Placeholder assistant message filled via stream
    setMessages(p => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
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
            } else if (event.type === "error") {
              setMessages(p => {
                const updated = [...p];
                updated[updated.length - 1] = { role: "assistant", content: event.message ?? "Something went wrong." };
                return updated;
              });
            }
          } catch { /* ignore malformed lines */ }
        }
      }
    } catch (err) {
      console.error("[ChatTab] send error", err);
      setMessages(p => {
        const updated = [...p];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Try again." };
        return updated;
      });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([]);
    setInput("");
  }

  const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
  const isEmpty = messages.length === 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900">AI Chat</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Ask Claude anything about your business — strategy, content, pricing, clients.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border"
            style={{ background: "#fff", color: "#64748b", borderColor: "rgba(0,0,0,0.08)" }}>
            Clear
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg,${C.grad12 ?? "#6366f1"},#8b5cf6)` }} />

        <div className="p-4 space-y-3 min-h-[260px] max-h-[520px] overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-40 gap-4 text-center">
              <p className="text-sm text-slate-400">
                Ask me anything about your photography business.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-md">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs px-3 py-2 rounded-xl border transition-colors hover:border-indigo-200 hover:bg-indigo-50"
                    style={{ borderColor: "rgba(0,0,0,0.08)", color: "#475569" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[82%] px-3 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={m.role === "user"
                    ? { background: C.grad12, color: "#fff" }
                    : { background: "rgba(99,102,241,0.07)", color: "#1e1b4b", border: "1px solid rgba(99,102,241,0.12)" }}>
                  {m.content || (
                    <span className="opacity-50 animate-pulse">Thinking…</span>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(99,102,241,0.07)", color: "#6366f1" }}>
                <span className="animate-spin inline-block mr-1">◌</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Shift+Enter for new line)"
            disabled={loading}
            rows={1}
            className="flex-1 text-sm px-3 py-2.5 rounded-xl outline-none disabled:opacity-50 resize-none overflow-hidden"
            style={{
              border: `1px solid ${C.p1_20}`,
              background: "#fff",
              fontFamily: "inherit",
              maxHeight: "120px",
              lineHeight: "1.5",
            }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${t.scrollHeight}px`;
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-30 flex-shrink-0 self-end"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
            Send
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-300 text-center">
        Powered by Claude Opus 4.7 · Context resets when you clear the chat
      </p>
    </div>
  );
}
