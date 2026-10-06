import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { getPublicPhotoHref } from "@/lib/publicPhotoWarmup";

const CURRENT = "https://www.soloxsnaps.com/portfolio?category=grads";

describe("public photo destinations", () => {
  it.each(["/", "/about", "/blog/a-session", "/grads/sjsu/spots", "/family-guide/locations/lovers-lane"])(
    "prepares public destination %s", (href) => expect(getPublicPhotoHref(href, CURRENT)).toBe(href),
  );
  it("keeps category and school filters distinct", () => {
    expect(getPublicPhotoHref("?category=families", CURRENT)).toBe("/portfolio?category=families");
    expect(getPublicPhotoHref("?category=grads&school=sjsu", CURRENT)).toBe("/portfolio?category=grads&school=sjsu");
  });
  it.each(["#photos", CURRENT, "/admin", "/api/admin/logout", "/dashboard", "/login", "/admin-login", "/contact-other", "https://example.com/about", "javascript:alert(1)", "mailto:chris@example.com"])(
    "does not prefetch current, private, or external destination %s", (href) => {
      expect(getPublicPhotoHref(href, CURRENT)).toBeNull();
    },
  );
});

describe("photo warming", () => {
  const created: { src: string; srcset: string; sizes: string; fetchPriority: string }[] = [];
  let decode: Mock<() => Promise<void>>;
  beforeEach(() => {
    vi.resetModules();
    created.length = 0;
    decode = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {
      location: new URL("https://www.soloxsnaps.com/"),
      Image: class {
        src = ""; srcset = ""; sizes = ""; fetchPriority = "";
        constructor() { created.push(this); }
        decode() { return decode(); }
      },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("reuses the displayed responsive sources and decodes each variant once", async () => {
    const { warmPhoto } = await import("@/lib/photoWarmup");
    const request = { src: "/photo-large.jpg", srcSet: "/photo-small.jpg 640w, /photo-large.jpg 1200w", sizes: "50vw" };
    await Promise.all([warmPhoto(request), warmPhoto(request)]);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ src: request.src, sizes: request.sizes, srcset: request.srcSet, fetchPriority: "low" });
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("retries a failed image instead of caching its failure", async () => {
    const { warmPhoto } = await import("@/lib/photoWarmup");
    decode.mockRejectedValueOnce(new Error("Temporary network failure"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await warmPhoto({ src: "/retry.jpg" });
    await warmPhoto({ src: "/retry.jpg" });
    expect(created).toHaveLength(2);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("limits simultaneous background downloads so galleries do not flood the image service", async () => {
    const { warmPhoto } = await import("@/lib/photoWarmup");
    const finish: (() => void)[] = [];
    decode.mockImplementation(() => new Promise<void>((resolve) => finish.push(resolve)));
    const requests = Array.from({ length: 5 }, (_, index) => warmPhoto({ src: `/queued-${index}.jpg` }));
    expect(created).toHaveLength(3);
    finish.shift()!(); finish.shift()!();
    await vi.waitFor(() => expect(created).toHaveLength(5));
    finish.forEach((resolve) => resolve());
    await Promise.all(requests);
  });

  it("bounds decoded-image retention when browsing many galleries", async () => {
    const { warmPhoto } = await import("@/lib/photoWarmup");
    for (let index = 0; index < 80; index++) await warmPhoto({ src: `/photo-${index}.jpg` });
    await warmPhoto({ src: "/photo-0.jpg" });
    expect(created).toHaveLength(81);
  });

  it("fetches a destination once without authentication and warms its real photos", async () => {
    const attributes: Record<string, string> = { src: "/photo.jpg", srcset: "/photo.jpg 640w", sizes: "50vw" };
    vi.stubGlobal("document", { createElement: () => ({
      innerHTML: "", content: { querySelectorAll: () => [{ getAttribute: (key: string) => attributes[key] }] },
    }) });
    const fetchMock = vi.fn().mockResolvedValue(new Response("<main>Photos</main>", {
      headers: { "content-type": "text/html" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { warmPublicPage } = await import("@/lib/publicPhotoWarmup");
    await Promise.all([warmPublicPage("/about"), warmPublicPage("/about")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://www.soloxsnaps.com/about"), {
      credentials: "omit", priority: "low",
    });
    expect(created[0]).toMatchObject({ src: "https://www.soloxsnaps.com/photo.jpg", srcset: "/photo.jpg 640w", sizes: "50vw" });
  });
});
