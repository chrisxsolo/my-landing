// Server-rendered body for the couples guide hub — "The Ultimate Bay Area
// Couples Photography Guide". Every heading, paragraph, and internal link is in
// the initial HTML for search engines. Sections live in ./_sections; copy and
// business facts in lib/couplesGuide/hubContent. Reuses the fg-* guide design
// system plus the hub-only cg-* styles.

import { COUPLES_GUIDE_CSS } from "@/lib/couplesGuide/styles";
import type { FeaturedCouplesLocation } from "@/lib/couplesGuide/featuredLocations";
import { COUPLES_HUB_CSS } from "./hubStyles";
import CouplesJournalStrip from "./CouplesJournalStrip";
import { ApproachSection, ExpectSection, GuideHero, type GuidePhoto } from "./_sections/GuideIntro";
import { BestTimeSection, LocationsSection, PosingSection, WearSection } from "./_sections/GuidePlanning";
import { BookingCta, FaqSection, PricingSection } from "./_sections/GuideBooking";

export default function CouplesGuideContent({
  locations,
  photos,
}: {
  locations: FeaturedCouplesLocation[];
  photos: GuidePhoto[];
}) {
  return (
    <main className="fg-page">
      <style>{COUPLES_GUIDE_CSS}</style>
      <style>{COUPLES_HUB_CSS}</style>
      <GuideHero />
      <ApproachSection photos={photos} />
      <ExpectSection />
      <LocationsSection locations={locations} />
      <WearSection />
      <BestTimeSection />
      <PosingSection />
      <PricingSection />
      <FaqSection />
      <CouplesJournalStrip heading="Couples session stories" />
      <BookingCta />
    </main>
  );
}
