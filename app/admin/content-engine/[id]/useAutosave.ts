"use client";
// Debounced (~1.5s) server-backed autosave over autosaveCore (spec §7.4).
// localStorage draft_${itemId} is a TEMPORARY fallback: written while a save is
// pending or failed, cleared on confirmed save.
import { useCallback, useEffect, useRef, useState } from "react";
import { engineApi, EngineApiError } from "@/app/admin/content-engine/engineApi";
import {
  autosaveReducer, initialAutosaveState, draftStorageKey,
  type AutosaveState, type ServerCopy,
} from "./autosaveCore";

export const AUTOSAVE_DEBOUNCE_MS = 1500;

export interface UseAutosaveResult {
  state: AutosaveState;
  payload: Record<string, unknown>;
  edit: (next: Record<string, unknown>) => void;
  saveNow: () => void;
  resolveConflict: (adopt: "server" | "mine") => void;
}

export function useAutosave(
  itemId: string,
  initialPayload: Record<string, unknown>,
  initialRevision: number,
  onStatusReset?: () => void,
): UseAutosaveResult {
  const [payload, setPayload] = useState(initialPayload);
  const [state, setState] = useState<AutosaveState>(() => initialAutosaveState(initialRevision));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef(payload);
  const stateRef = useRef(state);

  useEffect(() => { payloadRef.current = payload; }, [payload]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const dispatch = useCallback((event: Parameters<typeof autosaveReducer>[1]) => {
    setState((s) => autosaveReducer(s, event));
  }, []);

  const persistLocal = useCallback((p: Record<string, unknown>) => {
    try {
      localStorage.setItem(draftStorageKey(itemId), JSON.stringify(p));
    } catch { /* quota errors are non-fatal: the server copy is authoritative */ }
  }, [itemId]);

  const clearLocal = useCallback(() => {
    try { localStorage.removeItem(draftStorageKey(itemId)); } catch { /* ignore */ }
  }, [itemId]);

  const runSave = useCallback(async () => {
    const current = stateRef.current;
    if (current.status === "saving" || current.status === "conflict") return;
    dispatch({ type: "save_started" });
    try {
      const result = await engineApi.autosaveItem(itemId, payloadRef.current, current.revision);
      dispatch({
        type: "save_succeeded",
        payloadRevision: result.payloadRevision,
        at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
      if (!stateRef.current.dirty) clearLocal();
      onStatusReset?.(); // editing an approved item reverts it to draft server-side
    } catch (err) {
      if (err instanceof EngineApiError && err.status === 409 && err.body.outcome === "conflict") {
        dispatch({ type: "conflict", server: err.body.server as ServerCopy });
        return;
      }
      const message = err instanceof Error ? err.message : "save failed";
      dispatch({ type: "save_failed", message });
      persistLocal(payloadRef.current); // local backup preserved
    }
  }, [itemId, dispatch, clearLocal, persistLocal, onStatusReset]);

  const edit = useCallback((next: Record<string, unknown>) => {
    setPayload(next);
    dispatch({ type: "edited" });
    persistLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void runSave(); }, AUTOSAVE_DEBOUNCE_MS);
  }, [dispatch, persistLocal, runSave]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void runSave();
  }, [runSave]);

  const resolveConflict = useCallback((adopt: "server" | "mine") => {
    const server = stateRef.current.conflict;
    dispatch({ type: "conflict_resolved", adopt });
    if (adopt === "server" && server) {
      setPayload(server.payload);
      clearLocal();
    } else if (adopt === "mine") {
      // stay dirty: schedule an immediate deliberate overwrite at the rebased revision
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void runSave(); }, 0);
    }
  }, [dispatch, clearLocal, runSave]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { state, payload, edit, saveNow, resolveConflict };
}
