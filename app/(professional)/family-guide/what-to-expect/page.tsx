import FamilySupportingArticle, { buildSupportingMetadata } from "../FamilySupportingArticle";
import { getSupportingTopic } from "@/lib/familyGuide/supporting";

const topic = getSupportingTopic("what-to-expect")!;

export const metadata = buildSupportingMetadata(topic);

export default function WhatToExpectPage() {
  return <FamilySupportingArticle topic={topic} />;
}
