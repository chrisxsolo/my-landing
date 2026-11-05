// Grad landing hero: headline + booking actions, with the page's hero photo
// beside it (stacked below on phones). The photo is preloaded at high fetch
// priority — it is the largest above-the-fold element. Without a photo the
// hero renders exactly as it did before (text only).
import Link from "next/link";
import LcpPhoto from "@/app/components/LcpPhoto";
import { C } from "@/lib/colors";
import type { PagePhoto } from "@/lib/pagePhotos/publicPages";

const HERO_CSS = `
  .school-hero-grid { display: grid; gap: 48px; align-items: center; }
  .school-hero--photo .school-hero-grid { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
  .school-hero-photo { margin: 0; justify-self: end; width: min(100%, 470px); }
  .school-hero-frame {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    background: ${C.proAccentSoft};
    box-shadow: ${C.proShadow};
    max-height: 640px;
  }
  @media (max-width: 900px) {
    .school-hero--photo .school-hero-grid { grid-template-columns: 1fr; gap: 32px; }
    .school-hero-photo { justify-self: center; width: min(100%, 520px); }
    .school-hero-frame { max-height: 70vh; }
  }
`;

type Props = {
  school: string;
  aliases?: string[];
  tagline: string;
  contactHref: string;
  photo: PagePhoto | null;
};

export default function SchoolHero({ school, aliases, tagline, contactHref, photo }: Props) {
  // The full name leads the H1; an acronym that is ambiguous on its own
  // ("USF" is also South Florida) follows as a secondary cue.
  const kicker = aliases?.length
    ? `Bay Area graduation photography · ${aliases.join(" · ")}`
    : "Bay Area graduation photography";
  return (
    <section className={`school-hero${photo ? " school-hero--photo" : ""}`}>
      <style>{HERO_CSS}</style>
      <div className="school-shell school-hero-grid">
        <div>
          <p className="school-kicker">{kicker}</p>
          <h1 className="school-hero-title">{school} Graduation Photographer</h1>
          <p className="school-hero-sub">{tagline}</p>
          <div className="school-hero-actions">
            <Link href={contactHref} className="school-link school-link--primary">Book your session</Link>
            <Link href="/pricing/grads" className="school-link school-link--ghost">See pricing</Link>
          </div>
        </div>
        {photo && (
          <figure className="school-hero-photo">
            <div className="school-hero-frame" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
              <LcpPhoto
                src={photo.image_url}
                alt={photo.alt}
                sizes="(max-width: 900px) 92vw, 470px"
                phoneSizes="92vw"
                quality={85}
                objectPosition="50% 35%"
              />
            </div>
          </figure>
        )}
      </div>
    </section>
  );
}
