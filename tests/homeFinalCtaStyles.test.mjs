import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("../app/components/HomeFinalCTA.tsx", import.meta.url);
const stylesPath = new URL("../app/(professional)/homeDetails.module.css", import.meta.url);

test("the final CTA pricing button keeps light text over the photo", async () => {
  const [component, styles] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(
    component,
    /className=\{`\$\{styles\.button\} \$\{styles\.buttonGhost\} \$\{details\.finalSecondaryButton\}`\}[\s\S]*?>\s*View Pricing/,
  );
  assert.match(
    styles,
    /\.finalCopy \.finalSecondaryButton\s*\{[^}]*color:\s*var\(--home-paper\);/s,
  );
});
