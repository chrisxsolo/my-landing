// PRIVATE couples posing reference → /admin/guides/couples-posing
// Phone-first tool for use during shoots. The full directing language never
// reaches a signed-out visitor: the admin session cookie is checked here on the
// server before any prompt is loaded (the admin layout also gates on the client).
// Prompts are managed in Admin → Couples Posing Guide (couples_posing_prompts).

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidAdminSession } from "@/lib/adminAuthShared";
import { listCouplesPosingPrompts } from "@/lib/couplesPrompts";
import { COUPLES_PROMPT_CATEGORIES } from "@/lib/couplesPosingGuide";
import { C } from "@/lib/colors";
import CouplesPosingReference, { type ReferencePrompt } from "./CouplesPosingReference";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Couples Posing Reference",
  robots: { index: false, follow: false },
};

function referenceVars(): CSSProperties {
  return {
    "--pr-page": C.proPage,
    "--pr-surface": C.white,
    "--pr-ink": C.ink,
    "--pr-ink-soft": C.inkSoft,
    "--pr-muted": C.muted,
    "--pr-accent": C.proAccent,
    "--pr-accent-dark": C.proAccentDark,
    "--pr-accent-soft": C.proAccentSoft,
    "--pr-accent-border": C.proAccentBorder,
    "--pr-border": C.proBorder,
    "--pr-shadow": C.proShadow,
    "--pr-star": C.proFilmEdge,
  } as CSSProperties;
}

export default async function CouplesPosingReferencePage() {
  const cookieStore = await cookies();
  const isAdmin = isValidAdminSession(cookieStore.get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET);
  if (!isAdmin) redirect("/admin");

  let prompts: ReferencePrompt[] = [];
  let loadError = false;
  try {
    const rows = await listCouplesPosingPrompts("photographer", true);
    prompts = rows.map((row) => ({
      number: row.number,
      title: row.title,
      category: row.category,
      instructions: row.instructions,
      variation: row.variation ?? null,
      keywords: row.keywords,
    }));
  } catch (error) {
    console.error("[couples posing reference] prompts unavailable", error);
    loadError = true;
  }

  return (
    <div style={referenceVars()}>
      <CouplesPosingReference prompts={prompts} categories={[...COUPLES_PROMPT_CATEGORIES]} loadError={loadError} />
    </div>
  );
}
