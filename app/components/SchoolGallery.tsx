// DB-backed school gallery (spec §3.5): async server component, renders
// nothing until published placements exist. Plain <img> like the rest of the
// site's Supabase-hosted public images (remote loader not configured).
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getSchoolGalleryPhotos } from "@/lib/contentEngine/schoolGalleryData";

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
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; matches site convention */}
              <img src={photo.url} alt={photo.alt} loading="lazy"
                style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 12, display: "block" }} />
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
