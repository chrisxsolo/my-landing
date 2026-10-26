// Grad school gallery: real sessions from this campus, right under the hero.
// Photos come from the shared page-photo pool (lib/pagePhotos) — every public
// photo matched to this school, curated in the admin Page Photos tab. Renders
// nothing when the school has no eligible photos, so the page never shows an
// empty or broken gallery.
import Link from "next/link";
import type { CSSProperties } from "react";
import MasonryGallery from "@/app/components/photoGallery/MasonryGallery";
import { C } from "@/lib/colors";
import type { PagePhoto } from "@/lib/pagePhotos/publicPages";

const GALLERY_VARS = {
  "--mg-placeholder": C.proAccentSoft,
  "--mg-focus": C.proAccent,
} as CSSProperties;

type Props = {
  slug: string;
  schoolShort: string;
  photos: PagePhoto[];
  /** All eligible photos for this school (shown or not). */
  matchedCount: number;
};

export default function SchoolGallery({ slug, schoolShort, photos, matchedCount }: Props) {
  if (photos.length === 0) return null;
  const more = matchedCount > photos.length + 1;

  return (
    <section className="school-gallery" aria-labelledby="school-gallery-title" style={GALLERY_VARS}>
      <div className="school-shell">
        <p className="school-kicker">Recent work</p>
        <h2 id="school-gallery-title" className="school-section-title">Real {schoolShort} grad sessions</h2>
        <div style={{ marginTop: 28 }}>
          <MasonryGallery photos={photos} />
        </div>
        {more && (
          <p style={{ marginTop: 24 }}>
            <Link href={`/portfolio?category=grads&school=${slug}`} className="school-link school-link--ghost">
              See more {schoolShort} sessions in the portfolio
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
