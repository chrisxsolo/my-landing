import CouplesSupportingArticle, { buildSupportingMetadata } from "../CouplesSupportingArticle";
import { getSupportingTopic } from "@/lib/couplesGuide/supporting";

const topic = getSupportingTopic("what-to-wear")!;

export const metadata = buildSupportingMetadata(topic);

export default function WhatToWearPage() {
  return <CouplesSupportingArticle topic={topic} />;
}
