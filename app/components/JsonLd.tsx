import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/schema";

/** One JSON-LD script tag, escaped so page data can never close the script. */
export default function JsonLd({ data }: { data: JsonLdNode }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
