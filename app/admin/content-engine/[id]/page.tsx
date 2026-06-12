import type { Metadata } from "next";
import Workspace from "@/app/admin/content-engine/[id]/Workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Content Engine Session" };

export default async function ContentEngineSessionPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return <Workspace sessionId={id} />;
}
