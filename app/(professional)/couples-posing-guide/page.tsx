import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isValidAdminSession } from "@/lib/adminAuthShared";
import { listCouplesInspirationImages } from "@/lib/couplesInspiration";
import { listCouplesPosingPrompts } from "@/lib/couplesPrompts";
import {
  COUPLES_INSPIRATION_CATEGORIES,
  COUPLES_PROMPT_CATEGORIES,
  filterInspirationImagesForMode,
  type CouplesGuideMode,
  type CouplesInspirationImage,
} from "@/lib/couplesPosingGuide";
import { C } from "@/lib/colors";
import CouplesPosingGuideClient from "./CouplesPosingGuideClient";
import styles from "./couplesPosingGuide.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Couples Posing Guide",
  description:
    "Explore the natural, playful, and documentary-inspired posing approach used during SoloXSnaps couples photography sessions in the San Francisco Bay Area",
  alternates: { canonical: "/couples-posing-guide" },
  openGraph: {
    title: "Couples Posing Guide | SoloXSnaps Photography",
    description:
      "Natural movement, connection, and storytelling for Bay Area couples sessions.",
    type: "article",
  },
};

type PageProps = {
  searchParams: Promise<{ preview?: string }>;
};

function guideStyle(): CSSProperties {
  return {
    "--guide-page": C.proPage,
    "--guide-surface": C.white,
    "--guide-ink": C.ink,
    "--guide-ink-soft": C.inkSoft,
    "--guide-muted": C.muted,
    "--guide-accent": C.proAccent,
    "--guide-accent-dark": C.proAccentDark,
    "--guide-accent-soft": C.proAccentSoft,
    "--guide-accent-border": C.proAccentBorder,
    "--guide-border": C.proBorder,
    "--guide-shadow": C.proShadow,
    "--guide-danger": C.danger,
    "--guide-success": C.success,
    "--guide-overlay": C.modalOverlay,
  } as CSSProperties;
}

export default async function CouplesPosingGuidePage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const isAdmin = isValidAdminSession(
    cookieStore.get("admin_session")?.value,
    process.env.ADMIN_SESSION_SECRET,
  );
  const { preview } = await searchParams;
  const displayMode = isAdmin && preview !== "client" ? "photographer" : "client";
  const dataMode: CouplesGuideMode = isAdmin
    ? (preview === "client" ? "client" : "photographer")
    : "public";

  let images: CouplesInspirationImage[] = [];
  try {
    const loaded = await listCouplesInspirationImages(dataMode);
    images = filterInspirationImagesForMode(
      loaded as CouplesInspirationImage[],
      dataMode,
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
    if (code !== "PGRST205") {
      console.error("[couples-posing-guide] inspiration gallery unavailable", error);
    }
  }

  const loadedPrompts = await listCouplesPosingPrompts(dataMode, true);
  const prompts = displayMode === "photographer"
    ? loadedPrompts
    : loadedPrompts.map(({ number, slug, title, category, keywords }) => ({
        number,
        slug,
        title,
        category,
        keywords,
      }));

  return (
    <main className={styles.page} style={guideStyle()}>
      <CouplesPosingGuideClient
        mode={displayMode}
        isAdmin={isAdmin}
        prompts={prompts}
        images={images}
        promptCategories={[...COUPLES_PROMPT_CATEGORIES]}
        inspirationCategories={[...COUPLES_INSPIRATION_CATEGORIES]}
      />
    </main>
  );
}
