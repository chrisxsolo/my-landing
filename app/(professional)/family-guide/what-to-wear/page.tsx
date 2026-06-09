import FamilySupportingArticle, { buildSupportingMetadata } from "../FamilySupportingArticle";
import { getSupportingTopic } from "@/lib/familyGuide/supporting";

const topic = getSupportingTopic("what-to-wear")!;

export const metadata = buildSupportingMetadata(topic);

export default function WhatToWearPage() {
  return <FamilySupportingArticle topic={topic} />;
}
