"use client";
// Workspace (spec §7.4): sticky header (name, type, state, permissions),
// guided stepper, single-scroll sections gating top-to-bottom, sticky bottom
// action bar. All durable state is server rows; refresh() refetches everything.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { checkAuth } from "@/lib/adminAuth";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { STATE_BADGES } from "@/app/admin/content-engine/stateBadge";
import EngineShell from "@/app/admin/content-engine/EngineShell";
import WorkflowStepper from "@/app/admin/content-engine/WorkflowStepper";
import type { EnginePhoto, WorkspaceData } from "@/app/admin/content-engine/engineTypes";
import { chip } from "./ui";
import FactsSection from "./FactsSection";
import PermissionsBar from "./PermissionsBar";
import PhotosSection from "./PhotosSection";
import GenerationSection from "./GenerationSection";
import ItemsSection from "./ItemsSection";
import ActionBar from "./ActionBar";
import PublicationHistory from "./PublicationHistory";
import ReconcileBanner from "./ReconcileBanner";

export default function Workspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [photos, setPhotos] = useState<EnginePhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<{ views: number; ctaClicks: number; perItem: Record<string, number> } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [workspace, photoList] = await Promise.all([
        engineApi.getWorkspace(sessionId),
        engineApi.listPhotos(sessionId),
      ]);
      setData(workspace);
      setPhotos(photoList.photos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load session");
    }
    engineApi.analytics(sessionId).then(setAnalytics).catch(() => setAnalytics(null));
  }, [sessionId]);

  useEffect(() => {
    if (!checkAuth()) {
      router.replace("/admin");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount; pattern matches EngineDashboard
    void refresh();
  }, [router, refresh]);

  if (error) {
    return <EngineShell><main style={{ padding: 24, color: T.red }}>{error}</main></EngineShell>;
  }
  if (!data) {
    return <EngineShell><main style={{ padding: 24, color: T.inkSoft }}>Loading…</main></EngineShell>;
  }

  const badge = STATE_BADGES[data.state];
  const session = data.session;

  return (
    <EngineShell>
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "0 24px 96px", color: T.ink }}>
      <header style={{
        position: "sticky", top: 56, zIndex: 20,
        background: "rgba(19,17,20,0.88)", backdropFilter: "blur(16px)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 0", borderBottom: `1px solid ${T.border}`, marginBottom: 16,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", minWidth: 0 }}>
          <h1 style={{ fontSize: 19, margin: 0, fontFamily: T.display, fontWeight: 600 }}>
            {(session.public_display_name as string) ?? "Untitled session"}
          </h1>
          <span style={{ color: T.inkSoft, fontSize: 13 }}>
            {session.service_type as string}
            {session.school_slug ? ` · ${session.school_slug as string}` : ""}
            {data.activePackage ? ` · package #${data.activePackage.generation_number}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {analytics !== null && (
            <span style={{ color: T.inkFaint, fontSize: 12, fontFamily: T.mono }}>{analytics.views} views · {analytics.ctaClicks} CTA</span>
          )}
          <span style={chip(badge.color, badge.bg)}>{badge.label}</span>
        </div>
      </header>

      <WorkflowStepper state={data.state} />
      <ReconcileBanner sessionId={sessionId} onChanged={refresh} />
      <PermissionsBar session={session} sessionId={sessionId} onChanged={refresh} />
      <FactsSection session={session} sessionId={sessionId} onSaved={refresh} />
      <PhotosSection sessionId={sessionId} photos={photos}
        aiAllowed={session.ai_processing_allowed as boolean} onChanged={refresh} />
      <GenerationSection sessionId={sessionId} activePackage={data.activePackage}
        items={data.items} aiAllowed={session.ai_processing_allowed as boolean}
        photos={photos} onChanged={refresh} />
      <ItemsSection items={data.items} photos={photos} onChanged={refresh} />
      <PublicationHistory published={data.published} onChanged={refresh} viewCounts={analytics?.perItem ?? {}} />
      <ActionBar items={data.items}
        marketingPermission={session.marketing_permission as boolean} onChanged={refresh} />
    </main>
    </EngineShell>
  );
}
