import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePath = new URL("../app/(professional)/contact/page.tsx", import.meta.url);
const clientPath = new URL("../app/(professional)/contact/ContactClient.tsx", import.meta.url);

test("contact page keeps static booking content in the server component", async () => {
  const [pageSource, clientSource] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(clientPath, "utf8"),
  ]);

  assert.match(pageSource, /Tell me the date, location, and what this is for\./);
  assert.match(pageSource, /Within 24 hours\./);
  assert.match(pageSource, /What to expect/);
  assert.match(pageSource, /href="\/faq"/);
  assert.match(pageSource, /<OptimizedPhoto/);
  assert.match(pageSource, /<Suspense fallback=\{<ContactFormFallback \/>}/);

  assert.doesNotMatch(clientSource, /Tell me the date, location, and what this is for\./);
  assert.doesNotMatch(clientSource, /<OptimizedPhoto/);
  assert.doesNotMatch(clientSource, /<aside/);
  assert.match(clientSource, /useSearchParams\(\)/);
  assert.match(clientSource, /onSubmit=\{handleSubmit\}/);
});
