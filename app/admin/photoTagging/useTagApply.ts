"use client";
// Preview → confirm → apply → undo for tag writes, shared by the bulk bar, the
// tag editor and the review queue.
//   · every write is previewed first; it waits for the admin's confirmation
//     when asked to, or whenever it reaches photos beyond the chosen ones (a
//     university on a Content Engine photo sets the whole session) or holds
//     back conflicts
//   · the result toast is red whenever any field failed — never "success"
//     for a failed write
//   · after a write, Undo replays each updated field's previous value
import { useCallback, useState } from "react";
import { undoRequests, type UndoRequest } from "@/lib/photoTagging/undo";
import { applySummary, taggingApi, type PreviewResponse, type TagRequest } from "./taggingApi";

export interface Toast { text: string; ok: boolean }
export interface PendingPreview { request: TagRequest; result: PreviewResponse }
export type ConfirmMode = "always" | "when-wide";

export interface TagApply {
  busy: boolean;
  toast: Toast | null;
  pending: PendingPreview | null;
  canUndo: boolean;
  submit: (request: TagRequest, mode?: ConfirmMode) => Promise<void>;
  confirm: () => Promise<void>;
  cancel: () => void;
  undo: () => Promise<void>;
  /** Any other admin action, with the same busy state and toasts. */
  run: (action: () => Promise<string>) => Promise<void>;
  showToast: (text: string, ok?: boolean) => void;
}

const needsConfirmation = (r: PreviewResponse) => r.conflicts > 0 || r.sessionImpact.some((s) => s.otherPhotos > 0);

export function useTagApply(onChanged: () => Promise<void> | void): TagApply {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pending, setPending] = useState<PendingPreview | null>(null);
  const [undoList, setUndoList] = useState<UndoRequest[]>([]);
  const showToast = useCallback((text: string, ok = true) => setToast({ text, ok }), []);

  const guard = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setToast(null);
    try {
      await action();
    } catch (err) {
      console.error("[photo-tagging] action failed", err);
      showToast(err instanceof Error ? err.message : "update failed", false);
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const write = useCallback(async (request: TagRequest) => {
    const result = await taggingApi.write(request);
    const summary = applySummary(result);
    showToast(summary.text, summary.ok);
    setUndoList(undoRequests(result.outcomes));
    await onChanged();
  }, [onChanged, showToast]);

  const submit = useCallback((request: TagRequest, mode: ConfirmMode = "when-wide") => guard(async () => {
    setPending(null);
    const result = await taggingApi.preview(request);
    if (result.updated === 0) {
      showToast(`Nothing to change · ${result.kept} kept · ${result.skipped} skipped · ${result.conflicts} held back`, result.conflicts === 0);
      return;
    }
    if (mode === "always" || needsConfirmation(result)) setPending({ request, result });
    else await write(request);
  }), [guard, showToast, write]);

  const confirm = useCallback(() => guard(async () => {
    if (!pending) return;
    setPending(null);
    await write(pending.request);
  }), [guard, pending, write]);

  const undo = useCallback(() => guard(async () => {
    const list = undoList;
    setUndoList([]);
    let restored = 0;
    for (const req of list) {
      const r = await taggingApi.write({ kind: "changes", keys: req.keys, changes: req.changes, replace: true, reason: "undo" });
      restored += r.updated;
      if (r.failed > 0) throw new Error(`Undo stopped: ${r.failures[0] ?? "a write failed"} (${restored} restored)`);
    }
    showToast(`Undone · ${restored} field(s) restored`);
    await onChanged();
  }), [guard, onChanged, showToast, undoList]);

  const run = useCallback((action: () => Promise<string>) => guard(async () => {
    showToast(await action());
    await onChanged();
  }), [guard, onChanged, showToast]);

  return {
    busy, toast, pending, canUndo: undoList.length > 0 && !busy,
    submit, confirm, cancel: () => setPending(null), undo, run, showToast,
  };
}
