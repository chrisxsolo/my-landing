import type { Metadata } from "next";
import TestimonialForm from "./TestimonialForm";

export const metadata: Metadata = {
  title: "Share Your Experience | SoloXSnaps",
  description: "Share feedback about your SoloXSnaps photography experience.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function TestimonialPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <TestimonialForm
      source={firstValue(params.source)}
      galleryId={firstValue(params.galleryId)}
      sessionType={firstValue(params.sessionType)}
    />
  );
}
