import FamilySupportingArticle, { buildSupportingMetadata } from "../FamilySupportingArticle";
import { getSupportingTopic } from "@/lib/familyGuide/supporting";

const topic = getSupportingTopic("how-to-prepare")!;

export const metadata = buildSupportingMetadata(topic);

export default function HowToPreparePage() {
  return <FamilySupportingArticle topic={topic} />;
}
