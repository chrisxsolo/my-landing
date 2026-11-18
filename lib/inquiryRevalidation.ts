// ─────────────────────────────────────────────────────────────────────────────
// Keeps an open conversation's progress in step with the database.
//
// Sync All runs from the dashboard, often in another tab, while a conversation
// stays open. This re-reads the inquiry when the conversation regains focus and
// folds in ONLY the server-owned progress fields — never the compose draft,
// subject, or anything else the admin may be editing.
//
// The controller is framework-free so its guarantees are testable:
//   • one request at a time, and no more often than `minIntervalMs`;
//   • a response that started before a local edit is dropped, so a stale read
//     can never undo a milestone the admin just toggled.
// ─────────────────────────────────────────────────────────────────────────────

/** Fields the timeline sync writes. Nothing else is ever merged from a refresh. */
export const INQUIRY_PROGRESS_FIELDS = [
  "reply_sent_at",
  "invoice_sent_at",
  "contract_sent_at",
  "deposit_paid_at",
  "gallery_delivered_at",
  "session_date",
  "preferred_time",
  "booking_confirmed",
  "payment_status",
  "payment_note",
  "payment_detected_at",
] as const;

type ProgressField = (typeof INQUIRY_PROGRESS_FIELDS)[number];
type WithProgress = { [K in ProgressField]?: unknown };

/**
 * `current` with the progress fields of `fresh`. Returns `current` itself when
 * nothing differs, so React state does not churn on a no-op refresh.
 */
export function mergeProgressFields<T extends WithProgress>(current: T, fresh: WithProgress): T {
  const changed = INQUIRY_PROGRESS_FIELDS.filter(field => fresh[field] !== undefined && fresh[field] !== current[field]);
  if (!changed.length) return current;
  return { ...current, ...Object.fromEntries(changed.map(field => [field, fresh[field]])) };
}

export type Revalidator = {
  /**
   * Re-read and apply, unless one is in flight or one just ran. `force` skips
   * the interval (a sync just finished) and, if a read is already in flight,
   * runs once more after it — that read may predate the sync's writes.
   */
  trigger: (options?: { force?: boolean }) => Promise<void>;
  /** Call when the admin changes progress locally; in-flight reads are discarded. */
  noteLocalEdit: () => void;
  dispose: () => void;
};

export function createRevalidator<T>(options: {
  load: () => Promise<T | null>;
  apply: (fresh: T) => void;
  minIntervalMs: number;
  now?: () => number;
  onError?: (error: unknown) => void;
}): Revalidator {
  const now = options.now ?? Date.now;
  let inFlight = false;
  let disposed = false;
  let rerunQueued = false;
  let editSeq = 0;
  let lastStartedAt = -Infinity;

  async function trigger(triggerOptions: { force?: boolean } = {}) {
    if (disposed) return;
    if (inFlight) {
      rerunQueued = rerunQueued || triggerOptions.force === true;
      return;
    }
    if (!triggerOptions.force && now() - lastStartedAt < options.minIntervalMs) return;
    inFlight = true;
    lastStartedAt = now();
    const seqAtStart = editSeq;
    try {
      const fresh = await options.load();
      if (fresh && !disposed && editSeq === seqAtStart) options.apply(fresh);
    } catch (error) {
      options.onError?.(error);
    } finally {
      inFlight = false;
    }
    if (rerunQueued) {
      rerunQueued = false;
      await trigger({ force: true });
    }
  }

  return {
    trigger,
    noteLocalEdit: () => { editSeq++; },
    dispose: () => { disposed = true; },
  };
}

// ─── Cross-tab "a sync just finished" signal ─────────────────────────────────
// Focus events alone miss the common case: the admin starts Sync All, switches
// to the conversation while it runs, and is already looking at it when the
// sync finishes. The dashboard announces completion; open conversations listen.

const TIMELINE_SYNC_CHANNEL = "soloxsnaps-timeline-sync";

/** Tell other open admin tabs that a timeline sync finished. No payload. */
export function announceTimelineSync(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(TIMELINE_SYNC_CHANNEL);
  channel.postMessage("done");
  channel.close();
}

/** Runs `onSync` whenever another tab announces a finished sync. Returns cleanup. */
export function onTimelineSync(onSync: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(TIMELINE_SYNC_CHANNEL);
  channel.onmessage = () => onSync();
  return () => channel.close();
}
