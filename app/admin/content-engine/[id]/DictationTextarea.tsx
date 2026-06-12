"use client";
// Textarea with a dictation mic (Web Speech API — Apple's speech engine in
// Safari, Google's in Chrome). Click the mic, talk, transcript appends to the
// field; click again to stop. Renders a plain textarea where unsupported.
import { useEffect, useRef, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { input as inputStyle } from "./ui";

// Minimal Web Speech API surface — not in every TS lib.dom yet.
interface SpeechResultEvent { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void; stop: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

interface Props {
  value: string;
  onValueChange: (next: string) => void;
  minHeight?: number;
  placeholder?: string;
}

export default function DictationTextarea({ value, onValueChange, minHeight = 56, placeholder }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Live value ref so recognition callbacks append to the latest text, not a stale closure.
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-capability probe must run post-mount (SSR renders without the mic; setting state here avoids a hydration mismatch)
    setSupported(getRecognitionCtor() !== null);
    return () => { recRef.current?.stop(); };
  }, []);

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) spoken += e.results[i][0].transcript;
      }
      spoken = spoken.trim();
      if (!spoken) return;
      const current = valueRef.current;
      const joined = current ? `${current.replace(/\s+$/, "")} ${spoken}` : spoken;
      onValueChange(joined);
    };
    rec.onend = () => { recRef.current = null; setListening(false); };
    rec.onerror = () => { recRef.current = null; setListening(false); };
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div style={{ position: "relative" }}>
      <textarea
        style={{ ...inputStyle, minHeight, paddingRight: supported ? 40 : undefined }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
      />
      {supported && (
        <button
          type="button"
          onClick={listening ? stop : start}
          title={listening ? "Stop dictation" : "Dictate (speech-to-text)"}
          aria-label={listening ? "Stop dictation" : "Start dictation"}
          style={{
            position: "absolute", top: 6, right: 6, width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 8, cursor: "pointer", fontSize: 14, lineHeight: 1,
            border: `1px solid ${listening ? T.redBorder : T.border}`,
            background: listening ? T.redBg : T.inset,
            color: listening ? T.red : T.inkSoft,
            animation: listening ? "ce-mic-pulse 1.2s ease-in-out infinite" : undefined,
          }}>
          {listening ? "■" : "🎙️"}
        </button>
      )}
      {listening && (
        <span style={{
          position: "absolute", bottom: 6, right: 8, fontSize: 10, fontWeight: 700,
          color: T.red, fontFamily: T.mono, pointerEvents: "none",
        }}>
          ● listening…
        </span>
      )}
      <style>{`@keyframes ce-mic-pulse { 0%,100% { box-shadow: 0 0 0 0 ${T.redBg}; } 50% { box-shadow: 0 0 0 5px ${T.redBg}; } }`}</style>
    </div>
  );
}
