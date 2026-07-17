import PortraitSupportingArticle, { buildSupportingMetadata } from "../PortraitSupportingArticle";
import { getSupportingTopic } from "@/lib/portraitGuide/supporting";

const topic = getSupportingTopic("what-to-expect")!;

export const metadata = buildSupportingMetadata(topic);

export default function WhatToExpectPage() {
  return <PortraitSupportingArticle topic={topic} />;
}
