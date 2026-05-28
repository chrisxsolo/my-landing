"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";

type Message = { role: "user" | "assistant"; content: string };

type Conversation = {
  id: string;
  title: string;
  archived: boolean;
  created_at: string;
};

const STARTERS = [
  "How should I price a 2-hour family session?",
  "Write 3 Instagram caption ideas for grad season",
  "What's a good follow-up cadence for unresponsive inquiries?",
  "Give me 5 blog post ideas for SJSU grads",
];

export default function ChatTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadConversations() {
    setLoadingConvs(true);
    try {
      const res = await fetch("/api/admin/chat/conversations");
      const data: Conversation[] = await res.json();
      setConversations(data);
      const active = data.find(c => !c.archived);
      if (active) {
        setActiveId(active.id);
        await loadMessages(active.id);
      }
    } catch (err) {
      console.error("[ChatTab] loadConversations", err);
    } finally {
      setLoadingConvs(false);
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/admin/chat/conversations/${convId}`);
      const data: { role: "user" | "assistant"; content: string }[] = await res.json();
      setMessages(data.map(m => ({ role: m.role, content: m.content })));
    } catch (err) {
      console.error("[ChatTab] loadMessages", err);
    }
  }

  async function switchConversation(conv: Conversation) {
    if (conv.id === activeId) { setShowHistory(false); return; }
    setActiveId(conv.id);
    setMessages([]);
    setShowHistory(false);
    await loadMessages(conv.id);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function startNewChat() {
    if (loading) return;
    // Archive the current conversation if it has messages
    if (activeId && messages.length > 0) {
      await fetch(`/api/admin/chat/conversations/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, archived: true } : c));
    }
    const res = await fetch("/api/admin/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const newConv: Conversation = await res.json();
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
    setMessages([]);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function ensureConversation(): Promise<string> {
    if (activeId) return activeId;
    const res = await fetch("/api/admin/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const newConv: Conversation = await res.json();
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
    return newConv.id;
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const convId = await ensureConversation();
    const userMsg: Message = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setMessages(p => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, messages: next }),
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
            } else if (event.type === "done") {
              // Auto-title the conversation from the first message
              if (next.filter(m => m.role === "user").length === 1) {
                const newTitle = content.slice(0, 60);
                setConversations(prev =>
                  prev.map(c => c.id === convId ? { ...c, title: newTitle } : c)
                );
              }
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
  const isEmpty = messages.length === 0;
  const archivedConvs = conversations.filter(c => c.archived);
  const activeConv = conversations.find(c => c.id === activeId);
  const isViewingArchived = activeConv?.archived ?? false;

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
        <button
          onClick={startNewChat}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
          + New Chat
        </button>
      </div>

      {/* Past chats collapsible */}
      {archivedConvs.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 transition-colors">
            {showHistory ? "▾" : "▸"} Past chats ({archivedConvs.length})
          </button>
          {showHistory && (
            <div className="mt-2 flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
              {archivedConvs.map(c => (
                <button
                  key={c.id}
                  onClick={() => switchConversation(c)}
                  className="text-left text-xs px-3 py-2 rounded-xl border transition-colors"
                  style={{
                    borderColor: c.id === activeId ? "#6366f1" : "rgba(0,0,0,0.07)",
                    background: c.id === activeId ? "rgba(99,102,241,0.07)" : "#fff",
                    color: c.id === activeId ? "#4f46e5" : "#475569",
                  }}>
                  <span className="truncate block">{c.title}</span>
                  <span className="opacity-40">
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat card */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg,${C.grad12 ?? "#6366f1"},#8b5cf6)` }} />

        {/* Active conversation title bar */}
        {activeConv && (
          <div className="px-4 py-2.5 border-b border-slate-50 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 truncate">{activeConv.title}</span>
            {isViewingArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-medium shrink-0">
                archived
              </span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="p-4 space-y-3 min-h-[260px] max-h-[520px] overflow-y-auto">
          {isEmpty ? (
            loadingConvs ? (
              <div className="flex items-center justify-center h-40">
                <span className="text-sm text-slate-300 animate-pulse">Loading…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 gap-4 text-center">
                <p className="text-sm text-slate-400">Ask me anything about your photography business.</p>
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
            )
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[82%] px-3 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={m.role === "user"
                    ? { background: C.grad12, color: "#fff" }
                    : { background: "rgba(99,102,241,0.07)", color: "#1e1b4b", border: "1px solid rgba(99,102,241,0.12)" }}>
                  {m.content || <span className="opacity-50 animate-pulse">Thinking…</span>}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input or archived CTA */}
        {isViewingArchived ? (
          <div className="p-3 border-t border-slate-100 text-center">
            <button
              onClick={startNewChat}
              className="text-xs font-bold px-4 py-2 rounded-xl"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
              + Start New Chat
            </button>
          </div>
        ) : (
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
        )}
      </div>

      <p className="text-xs text-slate-300 text-center">
        Powered by Claude Opus 4.7 · Chats are saved automatically
      </p>
    </div>
  );
}
