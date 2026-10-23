"use client";
// "Auto-fill from email": the button, the Gmail/AI round trip, and the states
// it can land in (no linked client, no conversation, several conversations to
// choose between, or a reviewable set of suggestions).
//
// It owns none of the facts. Accepted values are handed back to the form; the
// form still owns saving.
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import type { EmailFactsResult, ThreadSummary } from "@/app/admin/content-engine/engineTypes";
import { planFactMerge, type FactSuggestion } from "@/lib/contentEngine/emailFacts/merge";
import type { EmailFactField } from "@/lib/contentEngine/emailFacts/fields";
import type { DroppedFact } from "@/lib/contentEngine/emailFacts/extract";
import { btn } from "./ui";
import EmailFactsPanel from "./EmailFactsPanel";

interface Props {
  sessionId: string;
  aiAllowed: boolean;
  /** The form as it stands — conflicts are judged against what is on screen. */
  currentValues: Partial<Record<EmailFactField, string>>;
  onApply: (values: Partial<Record<EmailFactField, string>>) => void;
}

interface Review {
  suggestions: FactSuggestion[];
  threads: ThreadSummary[];
  messageCount: number;
  dropped: DroppedFact[];
}

export default function AutoFillFromEmail({ sessionId, aiAllowed, currentValues, onApply }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [choices, setChoices] = useState<ThreadSummary[] | null>(null);
  const [newMail, setNewMail] = useState<string | null>(null);

  // Cheap, metadata-only check: it answers "never_extracted" for a session
  // that has never used this, so no Gmail work happens for most sessions.
  useEffect(() => {
    let live = true;
    engineApi.checkEmailFacts(sessionId)
      .then((result) => {
        if (live && result.outcome === "new_messages") setNewMail(result.newest);
      })
      .catch(() => { /* best-effort indicator */ });
    return () => { live = false; };
  }, [sessionId]);

  const run = useCallback(async (threadId?: string) => {
    setBusy(true);
    setNotice(null);
    setChoices(null);
    setReview(null);
    try {
      const result: EmailFactsResult = await engineApi.extractEmailFacts(sessionId, threadId);
      if (result.outcome === "no_contact") {
        setNotice("No client email address is linked to this session — link an inquiry or client session first.");
        return;
      }
      if (result.outcome === "no_conversation") {
        setNotice(`No email conversation found for ${result.contact.email}.`);
        return;
      }
      if (result.outcome === "ambiguous") {
        setChoices(result.threads);
        setNotice("This client has more than one conversation — pick the one for this photoshoot.");
        return;
      }
      setNewMail(null);
      setReview({
        suggestions: planFactMerge(result.facts, currentValues),
        threads: result.threads,
        messageCount: result.messageCount,
        dropped: result.dropped,
      });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not read the email conversation");
    } finally {
      setBusy(false);
    }
  }, [sessionId, currentValues]);

  const apply = (values: Partial<Record<EmailFactField, string>>) => {
    onApply(values);
    setReview(null);
    setNotice("Applied to the form — press Save facts to commit.");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn()} onClick={() => void run()} disabled={busy || !aiAllowed}
          title={aiAllowed ? undefined : "AI processing is not enabled for this session"}>
          {busy ? "Analyzing client email conversation…" : "✨ Auto-fill from email"}
        </button>
        {notice && (
          <span style={{ fontSize: 13, color: T.inkSoft, maxWidth: 520 }}>{notice}</span>
        )}
      </div>

      {newMail && !review && !busy && (
        <div style={{
          marginTop: 10, padding: "8px 12px", borderRadius: 10,
          border: `1px solid ${T.blueBorder}`, background: T.blueBg,
          display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
        }}>
          <strong style={{ fontSize: 13 }}>New email details available</strong>
          <span style={{ fontSize: 12, color: T.inkSoft }}>
            This client wrote on {new Date(newMail).toLocaleDateString()} after the last extraction.
          </span>
          <button style={btn()} onClick={() => void run()}>Review updates</button>
        </div>
      )}

      {choices && (
        <div style={{
          marginTop: 10, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10,
        }}>
          {choices.map((thread) => (
            <div key={thread.threadId} style={{
              display: "flex", justifyContent: "space-between", gap: 10,
              alignItems: "center", padding: "6px 0",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>{thread.subject}</div>
                <div style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.mono }}>
                  {new Date(thread.firstAt).toLocaleDateString()} – {new Date(thread.lastAt).toLocaleDateString()}
                  {" · "}{thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}
                </div>
              </div>
              <button style={btn()} onClick={() => void run(thread.threadId)}>
                Use this conversation
              </button>
            </div>
          ))}
        </div>
      )}

      {review && (
        <EmailFactsPanel {...review} onApply={apply} onDismiss={() => setReview(null)} />
      )}
    </div>
  );
}
