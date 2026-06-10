import CouplesSupportingArticle, { buildSupportingMetadata } from "../CouplesSupportingArticle";
import { getSupportingTopic } from "@/lib/couplesGuide/supporting";

const topic = getSupportingTopic("best-time-for-couples-photos")!;

export const metadata = buildSupportingMetadata(topic);

export default function BestTimePage() {
  return <CouplesSupportingArticle topic={topic} />;
}
