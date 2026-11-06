// Dictation lifecycle (Content Engine facts textareas): the controller owns
// one recognition attempt at a time, reports starting/listening/stopping
// honestly, keeps error messages until the next deliberate start, and never
// lets a stale instance touch newer text. A controllable double stands in for
// the browser's SpeechRecognition; no audio is involved.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendTranscript, createDictation, createDictationSlot, describeRecognitionError,
  finalTranscript, getRecognitionCtor, microphoneAllowedByPolicy,
  type DictationState, type RecognitionLike, type SpeechResultEvent,
} from "@/app/admin/content-engine/[id]/dictationLifecycle";

class FakeRecognition implements RecognitionLike {
  static instances: FakeRecognition[] = [];
  static throwOnConstruct = false;
  static throwOnStart = false;
  lang = ""; continuous = false; interimResults = true;
  onstart: (() => void) | null = null;
  onresult: ((e: SpeechResultEvent) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = 0; stopped = 0; aborted = 0;
  constructor() {
    if (FakeRecognition.throwOnConstruct) throw new Error("boom");
    FakeRecognition.instances.push(this);
  }
  start() { this.started++; if (FakeRecognition.throwOnStart) throw new Error("InvalidStateError"); }
  stop() { this.stopped++; }
  abort() { this.aborted++; }
  // Browser-side event helpers.
  fireStart() { this.onstart?.(); }
  fireEnd() { this.onend?.(); }
  fireError(code?: string) { this.onerror?.(code === undefined ? {} : { error: code }); }
  fireFinal(...segments: string[]) {
    const results = segments.map((transcript) => ({ isFinal: true, 0: { transcript } }));
    this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: results.length }) });
  }
  fireInterim(transcript: string) {
    const results = [{ isFinal: false, 0: { transcript } }];
    this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: 1 }) });
  }
}

function harness(overrides: Partial<Parameters<typeof createDictation>[0]> = {}) {
  let text = "";
  const states: DictationState[] = [];
  const controller = createDictation({
    getCtor: () => FakeRecognition,
    readText: () => text,
    writeText: (next) => { text = next; },
    onState: (s) => states.push(s),
    report: () => {},
    ...overrides,
  });
  return {
    controller, states,
    get text() { return text; },
    type(next: string) { text = next; controller.setText(next); },
    last: () => states[states.length - 1],
    rec: (i = FakeRecognition.instances.length - 1) => FakeRecognition.instances[i],
  };
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.throwOnConstruct = false;
  FakeRecognition.throwOnStart = false;
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

describe("capability detection", () => {
  it("prefers the standard constructor, falls back to the prefixed one, and reports neither", () => {
    const A = class {}; const B = class {};
    expect(getRecognitionCtor({ SpeechRecognition: A, webkitSpeechRecognition: B })).toBe(A);
    expect(getRecognitionCtor({ webkitSpeechRecognition: B })).toBe(B);
    expect(getRecognitionCtor({})).toBeNull();
    expect(getRecognitionCtor(undefined)).toBeNull();
  });

  it("reads the microphone permissions policy when the document exposes one", () => {
    expect(microphoneAllowedByPolicy({ permissionsPolicy: { allowsFeature: (f: string) => f === "microphone" } })).toBe(true);
    expect(microphoneAllowedByPolicy({ featurePolicy: { allowsFeature: () => false } })).toBe(false);
    expect(microphoneAllowedByPolicy({})).toBeNull();
    expect(microphoneAllowedByPolicy(undefined)).toBeNull();
  });

  it("start() without a constructor fails with a clear message and no instance", () => {
    const h = harness({ getCtor: () => null });
    h.controller.start();
    expect(FakeRecognition.instances).toHaveLength(0);
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/available in this browser/i) });
  });

  it("a permissions policy that blocks the microphone fails before touching the API", () => {
    const h = harness({ microphoneAllowed: () => false });
    h.controller.start();
    expect(FakeRecognition.instances).toHaveLength(0);
    expect(h.last().error).toMatch(/permissions policy/i);
    expect(h.last().phase).toBe("idle");
  });
});

describe("happy path", () => {
  it("starting → listening → results → graceful stop → idle, appending once per final result", () => {
    const h = harness();
    h.type("Existing note.  ");
    h.controller.start();
    expect(h.last()).toEqual({ phase: "starting", error: null });
    const rec = h.rec();
    expect(rec.started).toBe(1);
    expect(rec.lang).toBe("en-US");
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(false);

    rec.fireStart();
    expect(h.last().phase).toBe("listening");

    rec.fireFinal("Two people walking");
    expect(h.text).toBe("Existing note. Two people walking");
    rec.fireFinal("through a park at sunset.");
    expect(h.text).toBe("Existing note. Two people walking through a park at sunset.");

    h.controller.stop();
    expect(h.last().phase).toBe("stopping");
    expect(rec.stopped).toBe(1);
    expect(rec.aborted).toBe(0);
    // A final result that lands while the browser winds down is kept.
    rec.fireFinal("The end.");
    expect(h.text).toBe("Existing note. Two people walking through a park at sunset. The end.");

    rec.fireEnd();
    expect(h.last()).toEqual({ phase: "idle", error: null });
  });

  it("ignores interim and empty results and keeps manual edits made during dictation", () => {
    const h = harness();
    h.controller.start();
    const rec = h.rec();
    rec.fireStart();
    rec.fireInterim("partial");
    rec.fireFinal("   ");
    expect(h.text).toBe("");
    rec.fireFinal("first");
    h.type("first, then typed");
    rec.fireFinal("second");
    expect(h.text).toBe("first, then typed second");
  });

  it("successive result events before any re-render still chain onto each other", () => {
    // readText is deliberately never refreshed by the caller: the controller
    // must rely on its own latest text, not on React having rendered.
    const h = harness({ readText: () => "stale" });
    h.controller.setText("base");
    h.controller.start();
    const rec = h.rec();
    rec.fireStart();
    rec.fireFinal("one");
    rec.fireFinal("two", "three");
    expect(h.text).toBe("base one two three");
  });
});

describe("failures stay visible and recoverable", () => {
  it("an immediate error followed by end keeps the error and returns to idle", () => {
    const h = harness();
    h.controller.start();
    const rec = h.rec();
    rec.fireError("not-allowed");
    rec.fireEnd();
    expect(h.last().phase).toBe("idle");
    expect(h.last().error).toMatch(/microphone access/i);
  });

  it("an end before any start/result/error explains that nothing was captured", () => {
    const h = harness();
    h.controller.start();
    h.rec().fireEnd();
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/stopped before capturing any speech/i) });
  });

  it("a constructor that throws and a start() that throws both fail cleanly", () => {
    FakeRecognition.throwOnConstruct = true;
    const h = harness();
    h.controller.start();
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/could not start/i) });

    FakeRecognition.throwOnConstruct = false;
    FakeRecognition.throwOnStart = true;
    h.controller.start();
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/could not start/i) });
    // The instance whose start() threw is abandoned, so a late end does nothing.
    h.rec().fireEnd();
    expect(h.last().phase).toBe("idle");
  });

  it("maps the browser's error codes to faithful messages", () => {
    expect(describeRecognitionError("not-allowed")).toMatch(/microphone access/i);
    expect(describeRecognitionError("service-not-allowed")).toMatch(/speech service/i);
    expect(describeRecognitionError("audio-capture")).toMatch(/microphone/i);
    expect(describeRecognitionError("network")).toMatch(/network/i);
    expect(describeRecognitionError("no-speech")).toMatch(/no speech/i);
    expect(describeRecognitionError("aborted")).toMatch(/interrupted/i);
    expect(describeRecognitionError("language-not-supported")).toContain("language-not-supported");
    expect(describeRecognitionError(undefined)).toMatch(/dictation failed/i);
  });

  it("a manual retry after a failure clears the message and starts a fresh instance", () => {
    const h = harness();
    h.controller.start();
    h.rec().fireError("network");
    h.rec().fireEnd();
    expect(h.last().error).toMatch(/network/i);
    h.controller.start();
    expect(h.last()).toEqual({ phase: "starting", error: null });
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it("dismissError clears the message without starting anything", () => {
    const h = harness();
    h.controller.start();
    h.rec().fireError("no-speech");
    h.rec().fireEnd();
    h.controller.dismissError();
    expect(h.last()).toEqual({ phase: "idle", error: null });
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("a startup that never reports start or end is aborted after the bound", () => {
    const h = harness({ startTimeoutMs: 5000 });
    h.controller.start();
    vi.advanceTimersByTime(4999);
    expect(h.last().phase).toBe("starting");
    vi.advanceTimersByTime(1);
    expect(h.rec().aborted).toBe(1);
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/did not start/i) });
  });

  it("a specific error that arrives before the startup bound wins over the generic one", () => {
    const h = harness({ startTimeoutMs: 5000 });
    h.controller.start();
    h.rec().fireError("not-allowed");
    vi.advanceTimersByTime(5000);
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/microphone access/i) });
  });

  it("a graceful stop the browser never confirms is aborted after the bound, keeping captured text", () => {
    const h = harness({ startTimeoutMs: 5000 });
    h.controller.start();
    h.rec().fireStart();
    h.rec().fireFinal("kept words");
    h.controller.stop();
    vi.advanceTimersByTime(4999);
    expect(h.last().phase).toBe("stopping");
    vi.advanceTimersByTime(1);
    expect(h.rec().aborted).toBe(1);
    expect(h.last()).toEqual({ phase: "idle", error: expect.stringMatching(/never confirmed/i) });
    expect(h.text).toBe("kept words");
    h.controller.start(); // the slot was released, so a retry is possible
    expect(h.last().phase).toBe("starting");
  });

  it("an implementation that fires start synchronously from start() is not wedged", () => {
    class Eager extends FakeRecognition { start() { super.start(); this.fireStart(); } }
    const h = harness({ getCtor: () => Eager });
    h.controller.start();
    expect(h.last()).toEqual({ phase: "listening", error: null });
    vi.advanceTimersByTime(60_000);
    expect(h.last().phase).toBe("listening");
    expect(h.rec().aborted).toBe(0);
  });

  it("the startup bound is cleared once the service starts", () => {
    const h = harness({ startTimeoutMs: 5000 });
    h.controller.start();
    h.rec().fireStart();
    vi.advanceTimersByTime(10_000);
    expect(h.rec().aborted).toBe(0);
    expect(h.last().phase).toBe("listening");
  });
});

describe("instance ownership", () => {
  it("stop() during startup cancels (abort) without reporting an error", () => {
    const h = harness();
    h.controller.start();
    h.controller.stop();
    expect(h.rec().aborted).toBe(1);
    expect(h.last()).toEqual({ phase: "idle", error: null });
    // The browser still fires end (and sometimes an aborted error) for the cancelled attempt.
    h.rec().fireError("aborted");
    h.rec().fireEnd();
    expect(h.last()).toEqual({ phase: "idle", error: null });
  });

  it("rapid start/stop/start: callbacks from the superseded instance never touch the new attempt", () => {
    const h = harness();
    h.controller.start();
    const first = h.rec();
    h.controller.stop();
    h.controller.start();
    const second = h.rec();
    expect(second).not.toBe(first);
    second.fireStart();
    first.fireFinal("stale words");
    first.fireError("aborted");
    first.fireEnd();
    expect(h.text).toBe("");
    expect(h.last()).toEqual({ phase: "listening", error: null });
    second.fireFinal("fresh words");
    expect(h.text).toBe("fresh words");
  });

  it("start() while already starting or listening is a no-op", () => {
    const h = harness();
    h.controller.start();
    h.controller.start();
    expect(FakeRecognition.instances).toHaveLength(1);
    h.rec().fireStart();
    h.controller.start();
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("dispose() aborts the live attempt and silences every later callback", () => {
    const h = harness();
    h.controller.start();
    h.rec().fireStart();
    const before = h.states.length;
    h.controller.dispose();
    expect(h.rec().aborted).toBe(1);
    h.rec().fireFinal("after unmount");
    h.rec().fireError("aborted");
    h.rec().fireEnd();
    expect(h.text).toBe("");
    expect(h.states.length).toBe(before);
    h.controller.dispose(); // idempotent
    h.controller.start();   // disposed controllers stay inert
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("stop() when idle is harmless", () => {
    const h = harness();
    h.controller.stop();
    expect(h.states).toHaveLength(0);
  });
});

describe("two fields share one microphone", () => {
  it("the second field is blocked with a message while the first is active, then may start after it ends", () => {
    const slot = createDictationSlot();
    const summary = harness({ slot });
    const notes = harness({ slot });
    summary.controller.start();
    summary.rec().fireStart();
    notes.controller.start();
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(notes.last()).toEqual({ phase: "idle", error: expect.stringMatching(/another field/i) });
    expect(summary.last().phase).toBe("listening");

    summary.rec().fireFinal("public words");
    expect(summary.text).toBe("public words");
    expect(notes.text).toBe("");

    summary.controller.stop();
    summary.rec().fireEnd();
    notes.controller.start();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(notes.last().phase).toBe("starting");
    notes.rec().fireStart();
    notes.rec().fireFinal("private words");
    expect(notes.text).toBe("private words");
    expect(summary.text).toBe("public words");
  });

  it("a failed start releases the slot for the other field", () => {
    const slot = createDictationSlot();
    const summary = harness({ slot });
    const notes = harness({ slot });
    summary.controller.start();
    summary.rec().fireError("not-allowed");
    summary.rec().fireEnd();
    notes.controller.start();
    expect(notes.last().phase).toBe("starting");
  });

  it("disposing the active field frees the slot", () => {
    const slot = createDictationSlot();
    const summary = harness({ slot });
    const notes = harness({ slot });
    summary.controller.start();
    summary.controller.dispose();
    notes.controller.start();
    expect(notes.last().phase).toBe("starting");
  });
});

describe("pure helpers", () => {
  it("appendTranscript joins with a single space and respects empty text", () => {
    expect(appendTranscript("", "hello")).toBe("hello");
    expect(appendTranscript("hello", "world")).toBe("hello world");
    expect(appendTranscript("hello \n\t", "world")).toBe("hello world");
    expect(appendTranscript("hello", "  world  ")).toBe("hello world");
  });

  it("finalTranscript collects only final segments from resultIndex on", () => {
    const results = [
      { isFinal: true, 0: { transcript: "old " } },
      { isFinal: true, 0: { transcript: "new " } },
      { isFinal: false, 0: { transcript: "pending" } },
    ];
    expect(finalTranscript({ resultIndex: 1, results: Object.assign(results, { length: 3 }) })).toBe("new");
    expect(finalTranscript({ resultIndex: 2, results: Object.assign(results, { length: 3 }) })).toBe("");
  });
});
