import { describe, expect, it } from "vitest";
import supabaseImageLoader from "@/lib/supabaseImageLoader";

const BASE = "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/";

describe("public photo transformations", () => {
  it("serves a small web copy for the oversized blog cover", () => {
    const url = new URL(supabaseImageLoader({ src: `${BASE}grad-photos/blog/arisha-sfsu-cover.jpg`, width: 828, quality: 85 }));
    expect(url.pathname).toMatch(/\/render\/image\/public\/grad-photos\/web-optimized\/arisha-sfsu-cover-[a-f0-9]{12}\.webp$/);
    expect(url.searchParams.get("width")).toBe("828");
    expect(url.searchParams.get("quality")).toBe("85");
    expect(url.searchParams.get("resize")).toBe("contain");
  });

  it("keeps normal portfolio photos on their original paths", () => {
    const url = new URL(supabaseImageLoader({ src: `${BASE}grad-photos/cap-up.jpg`, width: 640, quality: 75 }));
    expect(url.pathname).toBe("/storage/v1/render/image/public/grad-photos/cap-up.jpg");
  });

  it("keeps local images and private signed URLs unchanged", () => {
    const local = "/images/about/chris-solorzano-photographer.webp";
    const signed = "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/sign/private/photo.jpg?token=example";
    expect(supabaseImageLoader({ src: local, width: 640 })).toBe(local);
    expect(supabaseImageLoader({ src: signed, width: 640 })).toBe(signed);
  });
});
