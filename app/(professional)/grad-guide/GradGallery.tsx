// "Recent grad shoots" gallery — async server component. Photos come from the
// cached grad_photos read (lib/gradGuideData.ts), so they're in the initial
// HTML instead of arriving after hydration + a browser-side Supabase fetch.
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getGradPhotos } from "@/lib/gradGuideData";

export default async function GradGallery() {
  const photos = await getGradPhotos();

  if (photos.length === 0) {
    return (
      <div className="gg-empty" data-reveal>
        <p style={{ fontSize: 34, margin: "0 0 10px" }}>📷</p>
        <p style={{ margin: 0, fontWeight: 760, color: "var(--ink)" }}>
          Recent sessions appear here soon.
        </p>
      </div>
    );
  }

  return (
    <div className="gg-gallery">
      {photos.map((photo) => (
        <div key={photo.id} className="gg-photo" data-reveal data-delay="1">
          <OptimizedPhoto
            src={photo.image_url}
            alt={photo.caption || "Graduation photo"}
            sizes="(max-width: 760px) 50vw, 25vw"
            quality={75}
          />
          {photo.caption && (
            <div className="gg-photo-cap">
              <span>{photo.caption}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
