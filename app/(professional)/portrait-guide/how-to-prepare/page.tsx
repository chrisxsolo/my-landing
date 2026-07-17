import PortraitSupportingArticle, { buildSupportingMetadata } from "../PortraitSupportingArticle";
import { getSupportingTopic } from "@/lib/portraitGuide/supporting";

const topic = getSupportingTopic("how-to-prepare")!;

export const metadata = buildSupportingMetadata(topic);

export default function HowToPreparePage() {
  return <PortraitSupportingArticle topic={topic} />;
}
