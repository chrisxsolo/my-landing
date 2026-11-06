// Dictation lifecycle for the facts textareas. Framework-free so the event
// ordering is testable without a browser: one recognition attempt at a time,
// phases reported from the browser's own events (listening only once the
// service says it started), failures kept on screen until the next deliberate
// start, and callbacks from a cancelled or superseded instance ignored. The
// controller also owns the latest text, so two final results that arrive
// before React re-renders chain onto each other instead of overwriting.

export type DictationPhase = "idle" | "starting" | "listening" | "stopping";
export interface DictationState { phase: DictationPhase; error: string | null }

// Minimal Web Speech API surface — not in every TS lib.dom yet.
export interface SpeechResultEvent {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
}
export interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
export type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(globalObject: unknown): RecognitionCtor | null {
  if (!globalObject || typeof globalObject !== "object") return null;
  const g = globalObject as Record<string, unknown>;
  const ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as RecognitionCtor) : null;
}

interface PolicyLike { allowsFeature?: (feature: string) => boolean }

/** Whether the document's Permissions-Policy lets this page use the microphone; null where the browser does not expose the policy. */
export function microphoneAllowedByPolicy(doc: unknown): boolean | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as { permissionsPolicy?: PolicyLike; featurePolicy?: PolicyLike };
  const policy = d.permissionsPolicy ?? d.featurePolicy;
  if (!policy || typeof policy.allowsFeature !== "function") return null;
  try { return policy.allowsFeature("microphone"); } catch { return null; }
}

export const DICTATION_MESSAGES = {
  unsupported: "Dictation isn't available in this browser — type here or use your system's dictation.",
  policyBlocked: "This page's permissions policy blocks the microphone, so dictation can't start here. Reload the page and try again.",
  didNotStart: "Dictation did not start — the browser never reported the microphone as live. Try again.",
  didNotStop: "Dictation stopped, but the browser never confirmed it; anything captured so far is kept.",
  noCapture: "Dictation stopped before capturing any speech. Try again and speak once the mic turns red.",
  busy: "Dictation is already running in another field. Stop it there first.",
} as const;

/** Faithful wording for the browser's SpeechRecognitionErrorEvent codes. */
export function describeRecognitionError(code: string | undefined): string {
  switch (code) {
    case "not-allowed": return "Microphone access was blocked for this site. Allow the microphone in the browser and try again.";
    case "service-not-allowed": return "The browser's speech service is not allowed here, so dictation can't run.";
    case "audio-capture": return "No microphone could be used. Check that one is connected and not in use elsewhere.";
    case "network": return "The speech service could not be reached (network error). Check the connection and try again.";
    case "no-speech": return "No speech was detected. Try again and speak once the mic turns red.";
    case "aborted": return "Dictation was interrupted before it finished.";
    case undefined:
    case "": return "Dictation failed. Try again.";
    default: return `Dictation failed (${code}). Try again.`;
  }
}

const couldNotStart = (err: unknown) =>
  `Dictation could not start${err instanceof Error && err.message ? ` (${err.message})` : ""}. Try again.`;

export function appendTranscript(current: string, spoken: string): string {
  const words = spoken.trim();
  if (!words) return current;
  const base = current.replace(/\s+$/, "");
  return base ? `${base} ${words}` : words;
}

/** The final segments of a result event from resultIndex on, space-joined and trimmed. */
export function finalTranscript(e: SpeechResultEvent): string {
  const segments: string[] = [];
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const words = e.results[i].isFinal ? e.results[i][0].transcript.trim() : "";
    if (words) segments.push(words);
  }
  return segments.join(" ");
}

/** One microphone per page: the field that claims the slot keeps it until its attempt ends. */
export interface DictationSlot { claim: (owner: object) => boolean; release: (owner: object) => void }
export function createDictationSlot(): DictationSlot {
  let holder: object | null = null;
  return {
    claim: (owner) => { if (holder && holder !== owner) return false; holder = owner; return true; },
    release: (owner) => { if (holder === owner) holder = null; },
  };
}
export const sharedDictationSlot = createDictationSlot();

export interface DictationDeps {
  getCtor: () => RecognitionCtor | null;
  /** Read once, when the controller is created; afterwards only setText and results change the text. */
  readText: () => string;
  writeText: (next: string) => void;
  onState: (state: DictationState) => void;
  microphoneAllowed?: () => boolean | null;
  slot?: DictationSlot;
  /** Bound on waiting for the browser's `start` after start() and its `end` after stop(). */
  startTimeoutMs?: number;
  lang?: string;
  /** Error reporting hook: event types and normalized codes only, never text or audio. */
  report?: (message: string, detail: Record<string, string | undefined>) => void;
}

export interface DictationController {
  start: () => void;
  stop: () => void;
  dismissError: () => void;
  setText: (text: string) => void;
  dispose: () => void;
}

interface Attempt {
  rec: RecognitionLike;
  started: boolean;
  gotResult: boolean;
  stopping: boolean;
  error: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createDictation(deps: DictationDeps): DictationController {
  const slot = deps.slot ?? createDictationSlot();
  const report = deps.report ?? ((message, detail) => console.error(message, detail));
  const token = {};
  let state: DictationState = { phase: "idle", error: null };
  let text = deps.readText();
  let current: Attempt | null = null;
  let disposed = false;

  const setState = (patch: Partial<DictationState>) => {
    const next = { ...state, ...patch };
    if (next.phase === state.phase && next.error === state.error) return;
    state = next;
    deps.onState(state);
  };
  const fail = (message: string) => setState({ phase: "idle", error: message });
  const clearTimer = (a: Attempt) => { if (a.timer !== null) { clearTimeout(a.timer); a.timer = null; } };

  /** Drops the attempt: later callbacks no longer match `current`, the browser is told to abort. */
  const cancel = (a: Attempt) => {
    clearTimer(a);
    if (current === a) current = null;
    slot.release(token);
    try { a.rec.abort(); } catch (err) { report("[dictation] abort failed", { reason: String(err) }); }
  };

  const onStart = (a: Attempt) => {
    clearTimer(a);
    a.started = true;
    setState({ phase: "listening" });
  };
  const onResult = (a: Attempt, e: SpeechResultEvent) => {
    const spoken = finalTranscript(e);
    if (!spoken) return;
    a.gotResult = true;
    text = appendTranscript(text, spoken);
    deps.writeText(text);
  };
  const onError = (a: Attempt, e: { error?: string }) => {
    a.error = describeRecognitionError(e.error);
    if (e.error !== "no-speech") report("[dictation] recognition error", { code: e.error });
  };
  const onEnd = (a: Attempt) => {
    clearTimer(a);
    current = null;
    slot.release(token);
    const quiet = a.stopping || a.gotResult;
    setState({ phase: "idle", error: a.error ?? (quiet ? null : DICTATION_MESSAGES.noCapture) });
  };

  const attach = (a: Attempt) => {
    const live = () => !disposed && current === a;
    a.rec.onstart = () => { if (live()) onStart(a); };
    a.rec.onresult = (e) => { if (live()) onResult(a, e); };
    a.rec.onerror = (e) => { if (live()) onError(a, e); };
    a.rec.onend = () => { if (live()) onEnd(a); };
  };

  const timeoutMs = () => deps.startTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  // Bounded waits: the browser owes us `start` after start() and `end` after
  // stop(); if either never comes, abort and let the user try again.
  const startupTimedOut = (a: Attempt) => {
    if (disposed || current !== a) return;
    cancel(a);
    report("[dictation] startup timed out", { timeoutMs: String(timeoutMs()) });
    fail(a.error ?? DICTATION_MESSAGES.didNotStart);
  };
  const stopTimedOut = (a: Attempt) => {
    if (disposed || current !== a) return;
    cancel(a);
    report("[dictation] stop never confirmed", { timeoutMs: String(timeoutMs()) });
    fail(a.error ?? DICTATION_MESSAGES.didNotStop);
  };

  const begin = (Ctor: RecognitionCtor) => {
    let rec: RecognitionLike;
    try { rec = new Ctor(); } catch (err) { slot.release(token); return fail(couldNotStart(err)); }
    rec.lang = deps.lang ?? "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    const attempt: Attempt = { rec, started: false, gotResult: false, stopping: false, error: null, timer: null };
    attach(attempt);
    current = attempt;
    // State and the bound go in before start(): an implementation that fires
    // events synchronously from start() must find the attempt already armed.
    attempt.timer = setTimeout(() => startupTimedOut(attempt), timeoutMs());
    setState({ phase: "starting", error: null });
    try { rec.start(); } catch (err) {
      clearTimer(attempt);
      current = null;
      slot.release(token);
      report("[dictation] start() threw", { reason: String(err) });
      fail(couldNotStart(err));
    }
  };

  const start = () => {
    if (disposed || state.phase !== "idle") return;
    if (deps.microphoneAllowed?.() === false) return fail(DICTATION_MESSAGES.policyBlocked);
    const Ctor = deps.getCtor();
    if (!Ctor) return fail(DICTATION_MESSAGES.unsupported);
    if (!slot.claim(token)) return fail(DICTATION_MESSAGES.busy);
    begin(Ctor);
  };

  const stop = () => {
    const a = current;
    if (disposed || !a || a.stopping) return;
    if (!a.started) { cancel(a); return setState({ phase: "idle", error: null }); }
    a.stopping = true;
    clearTimer(a);
    a.timer = setTimeout(() => stopTimedOut(a), timeoutMs());
    setState({ phase: "stopping" });
    try { a.rec.stop(); } catch (err) {
      report("[dictation] stop() threw", { reason: String(err) });
      cancel(a);
      setState({ phase: "idle", error: null });
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (current) cancel(current);
  };

  return {
    start, stop, dispose,
    dismissError: () => { if (!disposed) setState({ error: null }); },
    setText: (next) => { text = next; },
  };
}
