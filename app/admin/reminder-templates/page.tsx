"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/colors";
import { checkAuth, useAdminAuthed } from "@/lib/adminAuth";

// ── Types ──────────────────────────────────────────────────────────────────────

type TemplateId = "48hr" | "day-before" | "morning-of" | "thank-you" | "gallery-delivery";

type TemplateConfig = {
  id: TemplateId;
  label: string;
  emoji: string;
  defaultSubject: string;
  defaultInstructions: string;
  tip: string;
};

type TemplateDraft = {
  subject: string;
  instructions: string;
  saved: boolean;   // whether this field differs from what's in the DB
  saving: boolean;
};

// ── Static config (labels, defaults, tips) ────────────────────────────────────

const TEMPLATES: TemplateConfig[] = [
  {
    id: "48hr",
    label: "48-Hour Reminder",
    emoji: "⏰",
    defaultSubject: "2 days until your shoot",
    defaultInstructions: "Write a 48-hour heads-up. Cover: (1) excitement for the shoot in 2 days, (2) any prep tips you know from the email thread (what to wear, arrive a bit early, etc.), (3) tell them to text you if anything comes up. Keep it short and easy to read.",
    tip: "Sent 2 days before. Good place to mention outfit tips, parking, what to bring.",
  },
  {
    id: "day-before",
    label: "Day-Before Check-In",
    emoji: "🌅",
    defaultSubject: "See you tomorrow",
    defaultInstructions: "Write a day-before reminder. Cover: (1) excited for tomorrow, (2) confirm meeting time and location if found in email thread — if not found, say you'll send details shortly, (3) your number if they need anything. 3–4 sentences max.",
    tip: "Sent the evening before. Keep it short — just confirm the plan and your number.",
  },
  {
    id: "morning-of",
    label: "Morning-Of Text",
    emoji: "☀️",
    defaultSubject: "Morning of your shoot",
    defaultInstructions: "Write a brief morning-of message. Super short — 2–3 sentences. Just: hyped for today, confirm meeting spot/time if known from thread, your number. This reads like a text message, not an email. Casual and real.",
    tip: "Reads like a text. Should feel like a friend checking in, not a formal email.",
  },
  {
    id: "thank-you",
    label: "Post-Session Thank-You",
    emoji: "🙏",
    defaultSubject: "Thank you — it was so fun",
    defaultInstructions: "Write a post-session thank-you. Cover: (1) genuinely loved shooting with them, (2) briefly mention something authentic about the session type or location if you know it, (3) let them know you'll be editing and will send a gallery link soon, (4) ask them to tag you on IG @soloxsnaps when they post. Keep it real, not generic. Do NOT mention any time reference to when the shoot happened — no \"this morning\", \"today\", \"yesterday\", \"last week\", or any similar phrase.",
    tip: "Sent right after the shoot. This is where you set the timeline expectation for gallery delivery.",
  },
  {
    id: "gallery-delivery",
    label: "Gallery Delivery",
    emoji: "🖼️",
    defaultSubject: "Your photos are ready",
    defaultInstructions: "Write a gallery delivery message. DO NOT include any gallery link or download instructions — Chris will paste the link separately. Cover: (1) just sent your gallery, (2) loved how they turned out / a genuine compliment about the session, (3) ask them to tag @soloxsnaps on IG when they post. 3 sentences max. Super short and real.",
    tip: "Chris pastes the actual gallery link manually before sending — don't include a link placeholder.",
  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReminderTemplatesPage() {
  const router = useRouter();
  const authed = useAdminAuthed();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Drafts keyed by template id
  const [drafts, setDrafts] = useState<Record<TemplateId, TemplateDraft>>(() =>
    Object.fromEntries(
      TEMPLATES.map(t => [t.id, { subject: "", instructions: "", saved: false, saving: false }])
    ) as Record<TemplateId, TemplateDraft>
  );

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // Redirect away if not authed (live check — runs only on the client).
  useEffect(() => {
    if (!checkAuth()) router.push("/admin");
  }, [router]);

  // Load saved templates
  useEffect(() => {
    if (!authed) return;
    fetch("/api/reminder-templates")
      .then(r => r.json())
      .then(json => {
        if (!json.templates) return;
        setDrafts(prev => {
          const next = { ...prev };
          for (const t of TEMPLATES) {
            const saved = json.templates[t.id];
            next[t.id] = {
              subject:      saved?.subject      ?? t.defaultSubject,
              instructions: saved?.instructions ?? t.defaultInstructions,
              saved: false,
              saving: false,
            };
          }
          return next;
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authed]);

  function setField(id: TemplateId, field: "subject" | "instructions", value: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value, saved: false } }));
  }

  async function saveTemplate(id: TemplateId) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }));
    try {
      const res = await fetch("/api/reminder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: [{ id, subject: drafts[id].subject, instructions: drafts[id].instructions }],
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Save failed", false); return; }
      setDrafts(prev => ({ ...prev, [id]: { ...prev[id], saved: true, saving: false } }));
      showToast(`${TEMPLATES.find(t => t.id === id)?.label} saved ✓`);
    } catch {
      showToast("Save failed", false);
      setDrafts(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }));
    }
  }

  async function saveAll() {
    const allTemplates = TEMPLATES.map(t => ({
      id: t.id, subject: drafts[t.id].subject, instructions: drafts[t.id].instructions,
    }));
    // Mark all saving
    setDrafts(prev => Object.fromEntries(
      TEMPLATES.map(t => [t.id, { ...prev[t.id], saving: true }])
    ) as Record<TemplateId, TemplateDraft>);
    try {
      const res = await fetch("/api/reminder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: allTemplates }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Save failed", false); return; }
      setDrafts(prev => Object.fromEntries(
        TEMPLATES.map(t => [t.id, { ...prev[t.id], saved: true, saving: false }])
      ) as Record<TemplateId, TemplateDraft>);
      showToast("All templates saved ✓");
    } catch {
      showToast("Save failed", false);
      setDrafts(prev => Object.fromEntries(
        TEMPLATES.map(t => [t.id, { ...prev[t.id], saving: false }])
      ) as Record<TemplateId, TemplateDraft>);
    }
  }

  function resetToDefault(id: TemplateId) {
    const t = TEMPLATES.find(x => x.id === id)!;
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], subject: t.defaultSubject, instructions: t.defaultInstructions, saved: false } }));
  }

  if (!authed) return null;

  const inp = "w-full px-3 py-2 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors font-sans";
  const ta  = `${inp} resize-none leading-relaxed`;

  return (
    <div className="min-h-screen font-sans" style={{ background: "#f8f7ff" }}>
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl"
          style={{ background: toast.ok ? C.grad12 : "#be123c" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: C.p1_08, color: C.p1 }}>
              ← Back
            </button>
            <div>
              <p className="text-sm font-black text-slate-900">✉️ Reminder Templates</p>
              <p className="text-[11px] text-slate-400">AI uses these as style guides when generating future emails</p>
            </div>
          </div>
          <button
            onClick={saveAll}
            className="text-sm font-black px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: C.grad12 }}>
            Save All ✓
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-5">

        {/* How it works */}
        <div className="rounded-2xl p-4 text-sm" style={{ background: C.p1_06, border: `1px solid ${C.p1_15}` }}>
          <p className="font-black text-slate-800 mb-1">How this works</p>
          <p className="text-slate-600 leading-relaxed text-xs">
            Edit the <strong>instructions</strong> below to change how the AI writes each email. Be specific — include exact phrases, things to mention, things to avoid, timing notes (&ldquo;within two weeks&rdquo;), or your personal style. The AI will follow your notes on top of the base behavior. Changes save to the database and apply to every future reminder generated.
          </p>
        </div>

        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl animate-pulse h-48" style={{ background: C.p1_06 }} />
          ))
        ) : (
          TEMPLATES.map(t => {
            const d = drafts[t.id];
            const isDirty = !d.saved;
            return (
              <div key={t.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                {/* Card top bar */}
                <div className="h-[3px]" style={{ background: C.grad12 }} />

                {/* Card header */}
                <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{t.emoji}</span>
                    <div>
                      <p className="text-sm font-black text-slate-900">{t.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t.tip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => resetToDefault(t.id)}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                      style={{ background: "rgba(0,0,0,0.04)", color: "#94a3b8" }}>
                      Reset
                    </button>
                    <button
                      onClick={() => saveTemplate(t.id)}
                      disabled={d.saving}
                      className="text-[11px] font-black px-3 py-1 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: d.saved ? "#10b981" : C.p1 }}>
                      {d.saving ? "Saving…" : d.saved ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                </div>

                <div className="px-5 pb-5 space-y-3">
                  {/* Subject line */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Subject line
                    </label>
                    <input
                      className={inp}
                      value={d.subject}
                      onChange={e => setField(t.id, "subject", e.target.value)}
                      placeholder={t.defaultSubject}
                    />
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                      Style instructions for AI
                      {isDirty && <span className="ml-2 text-amber-500">● unsaved</span>}
                    </label>
                    <textarea
                      className={ta}
                      rows={5}
                      value={d.instructions}
                      onChange={e => setField(t.id, "instructions", e.target.value)}
                      placeholder={t.defaultInstructions}
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      Write exactly what you want the AI to say, avoid, or include. Example: <em>&ldquo;Say I&rsquo;ll be backing up and editing your photos, and that the gallery will be ready within two weeks.&rdquo;</em>
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
