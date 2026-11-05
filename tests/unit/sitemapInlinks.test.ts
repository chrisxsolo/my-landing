// Every indexable static page in the sitemap must be reachable through a real
// internal link, or it quietly becomes an orphan (as /pricing/events did). The
// check reads the source for href usages outside the page's own folder. The
// admin-editable primary nav (lib/navConfig.ts) does not count: the saved nav
// in production can lag behind the default, so a page linked only from there
// is not reliably linked at all.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROFESSIONAL = "app/(professional)";

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") sourceFiles(relative, out);
    } else if (/\.(tsx?|mjs)$/.test(entry.name)) {
      out.push(relative);
    }
  }
  return out;
}

const SOURCES = [...sourceFiles("app"), ...sourceFiles("lib")]
  .filter((file) => !file.startsWith("app/admin") && !file.startsWith("app/api") && file !== "lib/navConfig.ts")
  .map((file) => ({ file, text: readFileSync(path.join(ROOT, file), "utf8") }));

const STATIC_ROUTES = [...readFileSync(path.join(ROOT, "app/sitemap.ts"), "utf8").matchAll(/path: "([^"]+)"/g)]
  .map((match) => match[1]);

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Files (outside the page's own folder) that link to `route`. */
function inlinkSources(route: string): string[] {
  const own = route === "/" ? `${PROFESSIONAL}/page.tsx` : `${PROFESSIONAL}${route}`;
  const literal = new RegExp(`href(?:=|:\\s*|=\\{)["\`]${escape(route)}(?:["\`?#])`);
  // Supporting articles link as href={`/<guide>/${topic.slug}`} with the slug in a data file.
  const parent = route.split("/").slice(0, -1).join("/");
  const segment = route.split("/").pop() ?? "";
  const template = new RegExp(`href=\\{\`${escape(parent)}/\\$\\{`);
  const slugDefined = SOURCES.some(({ text }) => text.includes(`slug: "${segment}"`));
  // Rates pages are linked from the registry: href={service.pricingPath}.
  const registryPricing = SOURCES.some(({ file, text }) => file === "lib/serviceRegistry.ts" && text.includes(`pricingPath: "${route}"`));
  return SOURCES
    .filter(({ file }) => file !== own && !file.startsWith(`${own}/`))
    .filter(({ text }) => literal.test(text) || (template.test(text) && slugDefined)
      || (registryPricing && text.includes("href={service.pricingPath}")))
    .map(({ file }) => file);
}

describe("sitemap pages are linked from somewhere on the site", () => {
  it("reads the static routes from the sitemap", () => {
    expect(STATIC_ROUTES.length).toBeGreaterThan(40);
    expect(STATIC_ROUTES).toContain("/pricing/events");
    expect(STATIC_ROUTES).toContain("/portrait-guide");
  });

  it.each(STATIC_ROUTES.filter((route) => route !== "/"))("%s has at least one internal link", (route) => {
    expect(inlinkSources(route), `${route} is an orphan: add a link or remove it from the sitemap`).not.toEqual([]);
  });

  it("the footer alone reaches every guide hub, whatever the saved nav holds", () => {
    const footer = readFileSync(path.join(ROOT, "lib/footerLinks.ts"), "utf8");
    const nav = readFileSync(path.join(ROOT, "lib/navConfig.ts"), "utf8");
    expect(footer).toContain("DEFAULT_NAV_CONFIG");
    for (const hub of ["/grad-guide", "/couples-guide", "/family-guide", "/portrait-guide", "/bay-area-locations", "/faq"]) {
      expect(nav, `${hub} missing from the default Guides group`).toContain(`href: "${hub}"`);
    }
  });
});
