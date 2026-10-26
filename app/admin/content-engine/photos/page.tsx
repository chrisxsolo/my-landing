import type { Metadata } from "next";
import EngineShell from "@/app/admin/content-engine/EngineShell";
import { TAG_FILTERS, type TagFilter } from "@/lib/photoTagging/types";
import PhotoLibrary from "./PhotoLibrary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Photo Tagging · Content Engine",
  description: "Every Portfolio and Content Engine photo with its tagging status.",
  robots: { index: false, follow: false },
};

export default async function PhotoTaggingPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const initial: TagFilter = (TAG_FILTERS as readonly string[]).includes(filter ?? "") ? (filter as TagFilter) : "all";
  return (
    <EngineShell>
      <PhotoLibrary initialFilter={initial} />
    </EngineShell>
  );
}
