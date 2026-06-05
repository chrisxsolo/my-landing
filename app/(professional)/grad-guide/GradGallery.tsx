"use client";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";

// Client island for the "Recent grad shoots" gallery. This is the ONLY part of
// the grad-guide hub that needs the browser — it reads published photos from
// Supabase after hydration. Everything else on the page is server-rendered so
// the article text, headings, and internal links exist in the initial HTML.

type GradPhoto = { id: number; image_url: string; caption: string | null };

const GRAD_PHOTOS_TABLE = "grad_photos";

export default function GradGallery() {
  const [photos, setPhotos] = useState<GradPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const { data, error } = await supabase
          .from(GRAD_PHOTOS_TABLE)
          .select("*")
          .order("created_at", { ascending: false });
        if (error) console.error("grad_photos load failed", error);
        if (data) setPhotos(data);
      } catch (err) {
        console.error("grad_photos load threw", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPhotos();
  }, []);

  if (loading) {
    return (
      <div className="gg-gallery">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="gg-gallery-skel" />
        ))}
      </div>
    );
  }

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
