// Up to three photos for one campus spot on a school location guide: the
// featured photo large, the rest beside it (stacked below on phones). Renders
// nothing when the spot has no photo yet.
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { PagePhoto } from "@/lib/pagePhotos/publicPages";

export default function SchoolSpotPhotos({ photos }: { photos: PagePhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <div className={`spg-photos spg-photos--${Math.min(photos.length, 3)}`}>
      {photos.slice(0, 3).map((photo, i) => (
        <div key={photo.id} className="spg-photo">
          <OptimizedPhoto
            src={photo.image_url}
            alt={photo.alt}
            sizes={i === 0 ? "(max-width: 760px) 92vw, 560px" : "(max-width: 760px) 46vw, 280px"}
            loading="lazy"
            objectPosition="50% 35%"
          />
        </div>
      ))}
    </div>
  );
}
