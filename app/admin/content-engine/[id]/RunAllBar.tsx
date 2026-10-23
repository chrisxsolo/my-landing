"use client";
// One-click run, executed by the background worker.
//
// The button enqueues a job (content_engine_jobs) and this component only
// WATCHES it — the server does the work, so the tab can be closed at any point
// and reopening the workspace picks the run back up wherever it got to. The
// enqueue is idempotent server-side, so a double-click adopts the live run
// instead of starting a second one.
//
// A run produces drafts only. Publishing stays an explicit action downstream.
import { useCallback, useEffect, useRef, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { AUTO_CURATE_THRESHOLD, TOP_PICK_COUNT } from "@/lib/contentEngine/curationConfig";
import {
  isJobLive, jobPercent, jobProgressLabel, jobStageLabel,
} from "@/lib/contentEngine/jobProgress";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import {
  mergePhotoStatuses, pendingAnalysisCount, pendingGenerationTypes, includedCount,
} from "@/app/admin/content-engine/pipeline";
import type {
  EngineJob, EnginePackage, EnginePhoto, PhotoStatusRow,
} from "@/app/admin/content-engine/engineTypes";
import { btn, card } from "./ui";
import AnalysisProgress from "./AnalysisProgress";

interface Props {
  sessionId: string;
  photos: EnginePhoto[];
  activePackage: EnginePackage | null;
  aiAllowed: boolean;
  flushFacts: () => Promise<void>;
  onChanged: () => void;
  /** Folds live photo statuses into the grid without a thumbnail-re-signing refetch. */
  onPhotosMutated: (updater: (prev: EnginePhoto[]) => EnginePhoto[]) => void;
}

// Analysis commits a photo every second or two, so the counts poll briskly.
const POLL_MS = 2_000;
// How long a finished run keeps its outcome on screen.
const RECENT_FINISH_MS = 10 * 60_000;

export default function RunAllBar({
  sessionId, photos, activePackage, aiAllowed, flushFacts, onChanged, onPhotosMutated,
}: Props) {
  const [job, setJob] = useState<EngineJob | null>(null);
  const [statuses, setStatuses] = useState<PhotoStatusRow[]>([]);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped when a run starts, to restart the watch loop below: it stops itself
  // once a run is no longer live, and its deps are otherwise stable.
  const [watchToken, setWatchToken] = useState(0);
  // Lets the poll loop refresh the workspace exactly once, on the transition
  // out of a live run — not on every tick (a refresh re-signs every thumbnail).
  const wasLive = useRef(false);

  const poll = useCallback(async () => {
    try {
      const { job: latest, photoStatuses, serverNow } = await engineApi.getRun(sessionId);
      setJob(latest);
      setStatuses(photoStatuses);
      setClockOffsetMs(serverNow - Date.now());
      const live = latest !== null && isJobLive(latest);
      if (live) onPhotosMutated((prev) => mergePhotoStatuses(prev, photoStatuses));
      if (wasLive.current && !live) onChanged();
      wasLive.current = live;
      return live;
    } catch {
      return false; // transient; the next tick tries again
    }
  }, [sessionId, onChanged, onPhotosMutated]);

  // Adopt whatever is already running when the workspace opens, then follow it.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const live = await poll();
      if (cancelled) return;
      if (live) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [poll, watchToken]);

  const start = useCallback(async () => {
    setStarting(true);
    setNotice(null);
    try {
      // Facts first: the package step freezes them into its snapshot, and the
      // worker cannot read an unsaved form.
      await flushFacts();
      const { job: started, adopted, kicked } = await engineApi.startRun(sessionId);
      setJob(started);
      wasLive.current = started !== null && isJobLive(started);
      if (adopted) setNotice("A run was already going for this session — following that one.");
      else if (!kicked) setNotice("Queued, but ANTHROPIC_API_KEY isn't set, so no worker can run it.");
      setWatchToken((t) => t + 1); // restart the watch loop
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not start the run");
    } finally {
      setStarting(false);
    }
  }, [sessionId, flushFacts]);

  const cancel = useCallback(async () => {
    setNotice(null);
    try {
      await engineApi.cancelRun(sessionId);
      await poll();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not cancel the run");
    }
  }, [sessionId, poll]);

  if (!aiAllowed) return null;

  const live = job !== null && isJobLive(job);
  const percent = job ? jobPercent(job) : null;

  const pendingPhotos = pendingAnalysisCount(photos);
  const included = includedCount(photos);
  const pendingTypes = pendingGenerationTypes(activePackage);
  const steps: string[] = [];
  if (pendingPhotos > 0) steps.push(`analyze ${pendingPhotos} photo(s)`);
  if (included >= AUTO_CURATE_THRESHOLD) steps.push(`keep the best ${TOP_PICK_COUNT}`);
  if (!activePackage) steps.push("create the content package", "write every content type");
  else if (pendingTypes.length > 0) steps.push(`write ${pendingTypes.length} remaining type(s)`);
  const hasWork = included > 0 && steps.length > 0;

  if (photos.length === 0 && !job) {
    return (
      <section style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: T.inkSoft }}>
          Drop this session&rsquo;s edited photos below (a whole folder works) — then one
          click hands the whole run to the server: it analyzes them, writes the journal
          post and every placement, and leaves drafts waiting for your review. You can
          close the tab while it works.
        </span>
      </section>
    );
  }

  // Worth showing while something is running or runnable, while there is a
  // problem to read, and for a while after a finish so the run doesn't just
  // vanish the moment it completes — but not forever on an old session.
  const needsAttention = job?.status === "failed" || (job?.soft_errors.length ?? 0) > 0;
  const recentlyFinished = job?.finished_at != null
    && Date.now() - Date.parse(job.finished_at) < RECENT_FINISH_MS;
  if (!live && !hasWork && !needsAttention && !recentlyFinished && notice === null) return null;

  const accent = job?.status === "failed" ? T.red
    : live ? T.blue
    : job?.status === "succeeded" ? T.green
    : T.borderStrong;

  return (
    <section style={{ ...card, borderColor: accent }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.18em",
            textTransform: "uppercase", fontFamily: T.mono,
            color: job?.status === "failed" ? T.red : live ? T.blue : T.action,
          }}>
            {(live || !hasWork) && job ? jobStageLabel(job) : hasWork ? "One click" : "Run"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.inkSoft }}>
            {/* A live run speaks for itself; otherwise work still to do comes
                first, and only then the last run's outcome. */}
            {live && job
              ? jobProgressLabel(job)
              : hasWork
                ? `Will ${steps.join(", then ")} — on the server, so you can close the tab. Nothing publishes without your approval.`
                : job
                  ? jobProgressLabel(job)
                  : "Nothing left to run for this session."}
          </p>
          {job && job.attempts > 1 && live && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: T.inkFaint }}>
              Recovered and resumed after an interrupted attempt ({job.attempts} so far).
            </p>
          )}
        </div>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {live ? (
            <button style={btn(false, true)} onClick={() => void cancel()}>Cancel run</button>
          ) : hasWork ? (
            <button style={{ ...btn(true), padding: "9px 18px", fontSize: 14 }}
              disabled={starting} onClick={() => void start()}>
              {starting ? "Starting…"
                : job?.status === "failed" ? "Run what's left"
                : activePackage ? "Run what's left" : "Generate everything"}
            </button>
          ) : null}
        </span>
      </div>

      {live && job?.status === "running" && job.phase === "analyze" ? (
        <AnalysisProgress statuses={statuses} runStartedAt={job.started_at}
          startedAtMs={job.started_at ? Date.parse(job.started_at) : null}
          clockOffsetMs={clockOffsetMs} live />
      ) : live && percent !== null && (
        <div style={{
          marginTop: 10, height: 4, borderRadius: 999, background: T.inset, overflow: "hidden",
        }}>
          <div style={{
            width: `${percent}%`, height: "100%", background: T.blue,
            transition: "width 400ms ease",
          }} />
        </div>
      )}

      {notice && <p style={{ margin: "10px 0 0", fontSize: 12, color: T.amber }}>{notice}</p>}
      {job && job.soft_errors.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: T.amber }}>
          {job.soft_errors.map((e, i) => <li key={`${i}-${e}`}>{e}</li>)}
        </ul>
      )}
    </section>
  );
}
