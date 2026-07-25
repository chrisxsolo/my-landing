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
import { cachePublicContent } from "@/lib/publicContentCache";
import CouplesPosingGuideClient from "./CouplesPosingGuideClient";
import ContextualTestimonials from "@/app/components/ContextualTestimonials";
import { getContextualTestimonials } from "@/lib/testimonialsData";
import styles from "./couplesPosingGuide.module.css";

export const dynamic = "force-dynamic";

// Public visitors read the gallery + prompts through the shared content cache
// (busted by /api/admin/revalidate). Admin preview keeps calling the uncached
// lib functions so just-saved edits show up immediately — which is also why
// the lib functions themselves stay uncached: the admin editor routes reuse
// them and must read fresh after writes.
const listInspirationImagesCached = cachePublicContent(
  listCouplesInspirationImages,
  ["couples-inspiration-images"],
);
const listPosingPromptsCached = cachePublicContent(
  listCouplesPosingPrompts,
  ["couples-posing-prompts"],
);

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
    const loaded = isAdmin
      ? await listCouplesInspirationImages(dataMode)
      : await listInspirationImagesCached(dataMode);
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

  const [testimonials, loadedPrompts] = await Promise.all([
    getContextualTestimonials({ category: "couples", tag: "nervous" }, 1),
    isAdmin ? listCouplesPosingPrompts(dataMode, true) : listPosingPromptsCached(dataMode, true),
  ]);
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
      {/* Reassurance for couples worried about feeling awkward while posing. */}
      <ContextualTestimonials
        testimonials={testimonials}
        eyebrow="Worried it'll feel awkward?"
        heading="No experience needed — I guide every pose"
        subheading="How the session felt for a couple who wasn't used to being in front of a camera."
        tint
      />
    </main>
  );
}
