import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesPath = new URL("../app/components/ProNavHero.module.css", import.meta.url);

test("the homepage navbar keeps the brand and client login readable", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(
    styles,
    /\.hero\.hero\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--nav-hero-paper\)\s*88%,\s*transparent\);/s,
  );
  assert.doesNotMatch(styles, /:global\(\.pro-nav-/);
});
