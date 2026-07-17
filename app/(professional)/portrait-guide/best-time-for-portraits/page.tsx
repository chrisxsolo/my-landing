import PortraitSupportingArticle, { buildSupportingMetadata } from "../PortraitSupportingArticle";
import { getSupportingTopic } from "@/lib/portraitGuide/supporting";

const topic = getSupportingTopic("best-time-for-portraits")!;

export const metadata = buildSupportingMetadata(topic);

export default function BestTimeForPortraitsPage() {
  return <PortraitSupportingArticle topic={topic} />;
}
