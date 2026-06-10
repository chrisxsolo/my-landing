import CouplesSupportingArticle, { buildSupportingMetadata } from "../CouplesSupportingArticle";
import { getSupportingTopic } from "@/lib/couplesGuide/supporting";

const topic = getSupportingTopic("how-to-prepare")!;

export const metadata = buildSupportingMetadata(topic);

export default function HowToPreparePage() {
  return <CouplesSupportingArticle topic={topic} />;
}
