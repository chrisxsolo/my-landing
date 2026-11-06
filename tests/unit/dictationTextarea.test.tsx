// @vitest-environment jsdom
// The two facts textareas (public summary, internal notes) wired through the
// real FactsSection: dictated text lands in the form the same way typing does,
// so Save facts and Run all's registered flush commit it; failures are shown
// in the field and survive the browser's trailing end event; the two fields
// never share a recognition instance. A controllable double replaces the
// browser's SpeechRecognition — nothing here touches audio or the network.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { RecognitionLike, SpeechResultEvent } from "@/app/admin/content-engine/[id]/dictationLifecycle";

const patchFacts = vi.fn(async () => ({ updated: true, locationSync: { updated: 0, failed: 0, error: null } }));
vi.mock("@/app/admin/content-engine/engineApi", () => ({ engineApi: { patchFacts: (...args: unknown[]) => patchFacts(...(args as [])) } }));
vi.mock("@/app/admin/content-engine/[id]/AutoFillFromEmail", () => ({ default: () => null }));
vi.mock("@/app/admin/content-engine/[id]/SchoolPicker", () => ({ default: () => null }));

const { default: FactsSection } = await import("@/app/admin/content-engine/[id]/FactsSection");

class FakeRecognition implements RecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = ""; continuous = false; interimResults = true;
  onstart: (() => void) | null = null;
  onresult: ((e: SpeechResultEvent) => void) | null = null;
  onerror: ((e: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  stopped = 0; aborted = 0;
  constructor() { FakeRecognition.instances.push(this); }
  start() {}
  stop() { this.stopped++; }
  abort() { this.aborted++; }
  fireFinal(transcript: string) {
    const results = [{ isFinal: true, 0: { transcript } }];
    this.onresult?.({ resultIndex: 0, results: Object.assign(results, { length: 1 }) });
  }
}

const SUMMARY = /public session summary/i;
const NOTES = /internal notes/i;
const SUMMARY_LABEL = "Public session summary (may be sent to AI)";
const NOTES_LABEL = "Internal notes (never sent to AI, never published)";
const SPOKEN = "Two people walking through a park at sunset.";

function mount(strict = false) {
  let flush: (() => Promise<void>) | null = null;
  const section = (
    <FactsSection session={{ service_type: "couples" }} sessionId="session-test" onSaved={() => {}}
      onRegisterFlush={(f) => { flush = f; }} />
  );
  const utils = render(strict ? <StrictMode>{section}</StrictMode> : section);
  return { ...utils, flush: () => flush!() };
}

const lastRec = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];
const field = (label: string) => screen.getByLabelText(label) as HTMLTextAreaElement;
// Each field has its own live region; at most one is ever non-empty.
const statusText = () => screen.getAllByRole("status").map((s) => s.textContent).join("");
const startButton = (field: RegExp) => screen.getByRole("button", { name: (n) => /^start dictation/i.test(n) && field.test(n) });

beforeEach(() => {
  FakeRecognition.instances = [];
  patchFacts.mockClear();
  (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("no network in this test"); });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
});

describe("without the Web Speech API", () => {
  it("renders both labelled textareas, no mic, and a typed fallback note", () => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    mount();
    const summary = field(SUMMARY_LABEL);
    expect(summary.tagName).toBe("TEXTAREA");
    expect(field(NOTES_LABEL).tagName).toBe("TEXTAREA");
    expect(screen.queryAllByRole("button", { name: /dictation/i })).toHaveLength(0);
    expect(screen.getAllByText(/dictation isn't available in this browser/i).length).toBeGreaterThan(0);
    fireEvent.change(summary, { target: { value: "typed instead" } });
    expect(summary).toHaveProperty("value", "typed instead");
  });
});

describe("dictating into the public summary", () => {
  it("shows starting then listening, appends final results around typing, and reaches Save facts and the flush", async () => {
    const { flush } = mount();
    const summary = field(SUMMARY_LABEL);
    fireEvent.change(summary, { target: { value: "Golden hour." } });

    fireEvent.click(startButton(SUMMARY));
    expect(statusText()).toMatch(/starting/i);
    const rec = lastRec();
    expect(rec.continuous).toBe(true);

    act(() => rec.onstart?.());
    expect(statusText()).toMatch(/listening/i);
    expect(screen.getByRole("button", { name: (n) => /^stop dictation/i.test(n) && SUMMARY.test(n) })).toBeTruthy();

    act(() => rec.fireFinal(SPOKEN));
    expect(summary.value).toBe(`Golden hour. ${SPOKEN}`);
    fireEvent.change(summary, { target: { value: `${summary.value} Fog later.` } });
    act(() => rec.fireFinal("Soft light."));
    expect(summary.value).toBe(`Golden hour. ${SPOKEN} Fog later. Soft light.`);

    fireEvent.click(screen.getByRole("button", { name: (n) => /^stop dictation/i.test(n) && SUMMARY.test(n) }));
    expect(rec.stopped).toBe(1);
    act(() => rec.onend?.());
    expect(statusText()).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /save facts/i }));
    await act(async () => { await Promise.resolve(); });
    expect(patchFacts).toHaveBeenCalledTimes(1);
    const saved = patchFacts.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(saved[0]).toBe("session-test");
    expect(saved[1].public_session_summary).toBe(`Golden hour. ${SPOKEN} Fog later. Soft light.`);
    expect(saved[1].internal_notes).toBe("");

    await act(async () => { await flush(); });
    const flushed = patchFacts.mock.calls[1] as unknown as [string, Record<string, unknown>];
    expect(flushed[1].public_session_summary).toBe(`Golden hour. ${SPOKEN} Fog later. Soft light.`);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("keeps a denied-permission message after the trailing end event and lets the mic retry", () => {
    mount();
    fireEvent.click(startButton(SUMMARY));
    const first = lastRec();
    act(() => { first.onerror?.({ error: "not-allowed" }); first.onend?.(); });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/microphone access/i);
    expect(statusText()).toBe("");
    expect((field(SUMMARY_LABEL)).value).toBe("");

    fireEvent.click(startButton(SUMMARY));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(lastRec()).not.toBe(first);
  });

  it("explains an end with no speech captured instead of flashing silently", () => {
    mount();
    fireEvent.click(startButton(SUMMARY));
    act(() => lastRec().onend?.());
    expect(screen.getByRole("alert").textContent).toMatch(/stopped before capturing any speech/i);
    expect(startButton(SUMMARY)).toBeTruthy();
  });

  it("cancel during startup aborts the attempt without an error", () => {
    mount();
    fireEvent.click(startButton(SUMMARY));
    fireEvent.click(screen.getByRole("button", { name: (n) => /^cancel dictation/i.test(n) && SUMMARY.test(n) }));
    expect(lastRec().aborted).toBe(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(statusText()).toBe("");
  });
});

describe("the two fields", () => {
  it("block the second mic while the first is live and never mix text", () => {
    mount();
    fireEvent.click(startButton(SUMMARY));
    const rec = lastRec();
    act(() => rec.onstart?.());
    fireEvent.click(startButton(NOTES));
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toMatch(/another field/i);

    act(() => rec.fireFinal(SPOKEN));
    expect((field(SUMMARY_LABEL)).value).toBe(SPOKEN);
    expect((field(NOTES_LABEL)).value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: (n) => /^stop dictation/i.test(n) && SUMMARY.test(n) }));
    act(() => rec.onend?.());
    fireEvent.click(startButton(NOTES));
    expect(FakeRecognition.instances).toHaveLength(2);
    act(() => { lastRec().onstart?.(); lastRec().fireFinal("private only"); });
    expect((field(NOTES_LABEL)).value).toBe("private only");
    expect((field(SUMMARY_LABEL)).value).toBe(SPOKEN);
  });

  it("survive Strict Mode's double effect run and an outside value change while listening", () => {
    const { rerender } = mount(true);
    fireEvent.click(startButton(SUMMARY));
    expect(FakeRecognition.instances).toHaveLength(1);
    const rec = lastRec();
    act(() => rec.onstart?.());
    expect(statusText()).toMatch(/listening/i);
    // Auto-fill style outside edit: the parent re-renders with new text while the mic is live.
    fireEvent.change(field(SUMMARY_LABEL), { target: { value: "Filled from email." } });
    rerender(<StrictMode><FactsSection session={{ service_type: "couples" }} sessionId="session-test" onSaved={() => {}} /></StrictMode>);
    act(() => rec.fireFinal(SPOKEN));
    expect(field(SUMMARY_LABEL).value).toBe(`Filled from email. ${SPOKEN}`);
  });

  it("abort recognition when the section unmounts mid-dictation", () => {
    const { unmount } = mount();
    fireEvent.click(startButton(NOTES));
    act(() => lastRec().onstart?.());
    unmount();
    expect(lastRec().aborted).toBe(1);
  });
});
