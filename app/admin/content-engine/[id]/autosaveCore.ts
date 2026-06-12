// Pure autosave state machine (spec §7.4 Autosave): Editing… / Saving… /
// Saved <time> / Save failed — local backup preserved / conflict (409 with the
// server copy for an explicit comparison prompt). The hook owns timers and IO;
// this reducer owns every transition so it is unit-testable.
export interface ServerCopy {
  payload: Record<string, unknown>;
  payload_revision: number;
  status: string;
}

export type AutosaveStatus = "idle" | "editing" | "saving" | "saved" | "save_failed" | "conflict";

export interface AutosaveState {
  status: AutosaveStatus;
  revision: number;
  dirty: boolean;
  savedAt: string | null;
  error: string | null;
  conflict: ServerCopy | null;
}

export type AutosaveEvent =
  | { type: "edited" }
  | { type: "save_started" }
  | { type: "save_succeeded"; payloadRevision: number; at: string }
  | { type: "save_failed"; message: string }
  | { type: "conflict"; server: ServerCopy }
  | { type: "conflict_resolved"; adopt: "server" | "mine" };

export function initialAutosaveState(revision: number): AutosaveState {
  return { status: "idle", revision, dirty: false, savedAt: null, error: null, conflict: null };
}

export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (event.type) {
    case "edited":
      // a keystroke during an in-flight save must leave dirty=true afterwards
      return { ...state, dirty: true, status: state.status === "saving" ? "saving" : "editing" };
    case "save_started":
      return { ...state, status: "saving", dirty: false, error: null };
    case "save_succeeded":
      return {
        ...state,
        status: state.dirty ? "editing" : "saved",
        revision: event.payloadRevision,
        savedAt: event.at,
        error: null,
      };
    case "save_failed":
      return { ...state, status: "save_failed", dirty: true, error: event.message };
    case "conflict":
      return { ...state, status: "conflict", dirty: true, conflict: event.server };
    case "conflict_resolved": {
      const revision = state.conflict?.payload_revision ?? state.revision;
      if (event.adopt === "server") {
        return { ...state, status: "idle", revision, dirty: false, conflict: null, error: null };
      }
      // keep mine: rebase onto the server revision; stay dirty so the next
      // debounce tick overwrites deliberately (user confirmed via the prompt)
      return { ...state, status: "editing", revision, dirty: true, conflict: null, error: null };
    }
  }
}

// spec §7.4: localStorage fallback key pattern (AGENTS.md convention)
export function draftStorageKey(itemId: string): string {
  return `draft_${itemId}`;
}
