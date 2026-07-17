import PortraitSupportingArticle, { buildSupportingMetadata } from "../PortraitSupportingArticle";
import { getSupportingTopic } from "@/lib/portraitGuide/supporting";

const topic = getSupportingTopic("what-to-wear")!;

export const metadata = buildSupportingMetadata(topic);

export default function WhatToWearPage() {
  return <PortraitSupportingArticle topic={topic} />;
}
