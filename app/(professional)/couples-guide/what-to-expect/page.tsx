import CouplesSupportingArticle, { buildSupportingMetadata } from "../CouplesSupportingArticle";
import { getSupportingTopic } from "@/lib/couplesGuide/supporting";

const topic = getSupportingTopic("what-to-expect")!;

export const metadata = buildSupportingMetadata(topic);

export default function WhatToExpectPage() {
  return <CouplesSupportingArticle topic={topic} />;
}
