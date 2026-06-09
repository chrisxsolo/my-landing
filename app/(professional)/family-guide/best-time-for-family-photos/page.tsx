import FamilySupportingArticle, { buildSupportingMetadata } from "../FamilySupportingArticle";
import { getSupportingTopic } from "@/lib/familyGuide/supporting";

const topic = getSupportingTopic("best-time-for-family-photos")!;

export const metadata = buildSupportingMetadata(topic);

export default function BestTimePage() {
  return <FamilySupportingArticle topic={topic} />;
}
