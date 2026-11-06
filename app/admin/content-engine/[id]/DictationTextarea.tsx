"use client";
// Labelled textarea with a dictation mic (Web Speech API). Click the mic, talk,
// final transcript appends to the field; click again to stop. The browser
// runs recognition itself and may send audio to its vendor's speech service;
// this component never uploads audio or text. Phases and failures come from
// the lifecycle controller (dictationLifecycle.ts) so the UI only says
// "listening" once the browser does, and an error stays readable until the
// next deliberate start. Renders a plain textarea where unsupported.
import { useEffect, useId, useRef, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { input as inputStyle, label as labelStyle } from "./ui";
import {
  createDictation, DICTATION_MESSAGES, getRecognitionCtor, microphoneAllowedByPolicy, sharedDictationSlot,
  type DictationController, type DictationPhase, type DictationState,
} from "./dictationLifecycle";

interface Props {
  value: string;
  onValueChange: (next: string) => void;
  /** Visible field label, also the accessible name of the textarea and its mic. */
  label: string;
  minHeight?: number;
  placeholder?: string;
}

const STATUS_TEXT: Record<DictationPhase, string> = {
  idle: "", starting: "starting…", listening: "● listening…", stopping: "finishing…",
};
const MIC_VERB: Record<DictationPhase, string> = {
  idle: "Start", starting: "Cancel", listening: "Stop", stopping: "Stop",
};

export default function DictationTextarea({ value, onValueChange, label, minHeight = 56, placeholder }: Props) {
  const id = useId();
  const statusId = `${id}-status`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // null until the post-mount probe: SSR and the first client render agree on "no mic".
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<DictationState>({ phase: "idle", error: null });
  const controllerRef = useRef<DictationController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => { onValueChangeRef.current = onValueChange; }, [onValueChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-capability probe must run post-mount (SSR renders without the mic; setting state here avoids a hydration mismatch)
    setSupported(getRecognitionCtor(window) !== null);
    const controller = createDictation({
      getCtor: () => getRecognitionCtor(window),
      microphoneAllowed: () => microphoneAllowedByPolicy(document),
      readText: () => valueRef.current,
      writeText: (next) => { valueRef.current = next; onValueChangeRef.current(next); },
      onState: setState,
      slot: sharedDictationSlot,
    });
    controllerRef.current = controller;
    return () => { controller.dispose(); controllerRef.current = null; };
  }, []);

  // Typing and outside edits (auto-fill) keep the controller's text current so
  // the next final result appends to what is really in the field.
  useEffect(() => {
    valueRef.current = value;
    controllerRef.current?.setText(value);
  }, [value]);

  const { phase, error } = state;
  const statusText = STATUS_TEXT[phase];
  const describedBy = [error ? errorId : null, statusText ? statusId : null, supported === false ? hintId : null]
    .filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <textarea
          id={id}
          ref={textareaRef}
          style={{ ...inputStyle, minHeight, paddingRight: supported ? 40 : undefined }}
          value={value}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(e) => {
            valueRef.current = e.target.value;
            controllerRef.current?.setText(e.target.value);
            onValueChange(e.target.value);
          }}
        />
        {supported && (
          <MicButton phase={phase} label={label}
            onClick={() => (phase === "idle" ? controllerRef.current?.start() : controllerRef.current?.stop())} />
        )}
      </div>
      {/* Always mounted (empty when idle) so screen readers announce changes; sits below the field so it never covers text. */}
      <span id={statusId} role="status" aria-live="polite" style={{
        display: "block", fontSize: 11, fontWeight: 700, color: T.red, fontFamily: T.mono, textAlign: "right",
      }}>
        {statusText}
      </span>
      {error && (
        <div id={errorId} role="alert" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 12, color: T.red }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" aria-label={`Dismiss dictation message for ${label}`} title="Dismiss"
            onClick={() => { controllerRef.current?.dismissError(); textareaRef.current?.focus(); }}
            style={{
              width: 28, height: 28, flex: "none", borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.inset, color: T.inkSoft, cursor: "pointer", fontSize: 12, lineHeight: 1,
            }}>
            ✕
          </button>
        </div>
      )}
      {supported === false && (
        <span id={hintId} style={{ display: "block", marginTop: 4, fontSize: 11, color: T.inkSoft }}>
          {DICTATION_MESSAGES.unsupported}
        </span>
      )}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ce-mic-pulse { 0%,100% { box-shadow: 0 0 0 0 ${T.redBg}; } 50% { box-shadow: 0 0 0 5px ${T.redBg}; } }
        }
      `}</style>
    </div>
  );
}

function MicButton({ phase, label, onClick }: { phase: DictationPhase; label: string; onClick: () => void }) {
  const live = phase !== "idle";
  const finishing = phase === "stopping";
  const name = `${MIC_VERB[phase]} dictation for ${label}`;
  return (
    <button
      type="button"
      // aria-disabled rather than disabled: the button keeps focus and its place in the tab order while the browser winds down.
      onClick={() => { if (!finishing) onClick(); }}
      aria-disabled={finishing || undefined}
      title={name}
      aria-label={name}
      style={{
        position: "absolute", top: 6, right: 6, width: 28, height: 28,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 8, cursor: finishing ? "wait" : "pointer", fontSize: 14, lineHeight: 1,
        opacity: finishing ? 0.6 : 1,
        border: `1px solid ${live ? T.redBorder : T.border}`,
        background: live ? T.redBg : T.inset,
        color: live ? T.red : T.inkSoft,
        animation: phase === "listening" ? "ce-mic-pulse 1.2s ease-in-out infinite" : undefined,
      }}>
      {phase === "idle" ? "🎙️" : phase === "starting" ? "…" : "■"}
    </button>
  );
}
