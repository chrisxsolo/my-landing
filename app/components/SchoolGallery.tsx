// DB-backed school gallery (spec §3.5): async server component, renders
// nothing until published placements exist. Photos go through OptimizedPhoto
// so Supabase serves resized WebP variants instead of full-res originals.
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSchoolGalleryPhotos } from "@/lib/contentEngine/schoolGalleryData";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";

export default async function SchoolGallery({ slug, school }: { slug: string; school: string }) {
  const photos = await getSchoolGalleryPhotos(createSupabaseServerClient(), slug);
  if (photos.length === 0) return null;

  return (
    <section className="school-gallery" aria-label={`${school} graduation photo gallery`}>
      <div className="school-shell">
        <p className="school-kicker">Recent work</p>
        <h2 className="school-section-title">Recent {school} sessions</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
          marginTop: 32,
        }}>
          {photos.map((photo) => (
            <figure key={photo.id} style={{ margin: 0 }}>
              <div style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: 12, overflow: "hidden" }}>
                <OptimizedPhoto
                  src={photo.url}
                  alt={photo.alt}
                  sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 33vw"
                  quality={75}
                />
              </div>
              {photo.caption && (
                <figcaption style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>{photo.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
