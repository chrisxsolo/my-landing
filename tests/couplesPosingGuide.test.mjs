import test from "node:test";
import assert from "node:assert/strict";

import {
  COUPLES_POSING_PROMPTS,
  filterCouplesPosingPrompts,
  filterInspirationImagesForMode,
  getOwnedStoragePaths,
  validateInspirationImageInput,
  validateInspirationUpload,
} from "../lib/couplesPosingGuide.ts";

const EXPECTED_PROMPTS = [
  ["High Arm Swing Walk", "Have them slowly walk toward the camera while looking at each other and swinging their arms really high"],
  ["Drunk Walk", "Have them act like they’re drunk while walking in place or slowly walking toward the camera\n\nThey should hold hands, lean into each other, and bump hips as they walk"],
  ["She Leads Him", "Have them hold hands and let her take the lead\n\nShe should walk ahead of him, look back at him, and guide him forward\n\nWhile they’re moving, have her pull him toward her so they end up really close, looking at each other and smiling"],
  ["Arm-Hold Walk", "Have him place one hand in his pocket and leave his other arm hanging naturally\n\nHave her wrap both hands around his free arm and walk very close beside him toward the camera\n\nTell them to alternate between looking where they’re walking and looking at each other"],
  ["Swimming Arms Walk", "Have him stand directly behind her while they hold hands\n\nBring their arms outward to the sides and have them walk toward the camera while moving their arms like they’re swimming through water\n\nHave them look at each other as they move"],
  ["Walk Away Together", "Have them walk off into the distance together and pretend I’m not there"],
  ["Circle Chase", "Have them chase each other around in a circle\n\nThe girl should look back at him and smile like she’s barely getting away while the guy runs after her\n\nTell them they’re just playing and not to take the movement too seriously"],
  ["Playfully Refuse the Kiss", "Have the guy try to kiss her on the cheek while she playfully turns her head away and tries not to let him kiss her\n\nThey should stay close and hold onto each other while doing it"],
  ["Ring Around the Rosie", "Have them hold hands and play Ring Around the Rosie together\n\nLet them spin, laugh, and move naturally"],
  ["Airport Hug", "Start them far apart and facing away from each other\n\nOn the count of three, have them turn around, run toward each other, and give each other a huge bear hug\n\nTell them to hug like they haven’t seen each other in months and are finally seeing each other at the airport"],
  ["Chase, Catch, and Swing", "Have the girl run away while the guy chases after her\n\nHave him catch her from behind, wrap his arms around her, pick her up, and swing her around"],
  ["Sit and Kiss From Behind", "Have the guy sit down\n\nHave the girl stand behind him, lean over him, and go in for a kiss from behind"],
  ["Whisper a Random Answer", "Have them stand facing each other and hold hands\n\nHave him lean toward her and whisper something into her ear, such as his favorite cereal\n\nPhotograph her reaction rather than the whisper itself"],
  ["Smell Her Hair", "Have him stand behind her and wrap his arms around her waist\n\nHave them overlap or hold hands around her waist\n\nTell him to smell her hair while she turns her face toward the direction he’s smelling"],
  ["Hands in Back Pockets", "Have them stand face to face and get extremely close\n\nPlace his hands inside her back pockets and have her place her hands against his chest\n\nHave them gently squish together\n\nUse this for a tighter detail shot"],
  ["Walk Up and Touch Noses", "Have him remain still while she slowly walks toward him\n\nHave her place one arm around his neck and the other around his stomach or waist\n\nTell her to try touching her nose to his nose and then lean into him"],
  ["Nose Rub", "Have them stand face to face\n\nHer hands should be on his shoulders and his hands should be around her waist\n\nHave them gently rub their noses together and smile at each other"],
  ["Temple Kiss", "Have them stand side by side\n\nTell him to pull her closer and kiss her on the temple"],
  ["Swimming Arms Into a Hug", "Have him stand behind her with her back against his chest\n\nHave them hold hands and extend their arms outward\n\nTell them to wave their arms around like they’re swimming in place\n\nOn the count of three, have him pull her arms inward and wrap her in a hug"],
  ["Head on His Back and Cheek Kiss", "Have her stand behind him and rest her head against his back\n\nHave them hold hands\n\nPlace her far hand, the hand away from the camera, on his cheek and have her gently pull his head toward her\n\nThen have her kiss him on the cheek while he smiles"],
  ["Head on His Neck", "Have her stand directly behind him while they hold hands\n\nHave her rest her head against his neck\n\nTell them to look toward each other and make sure he smiles"],
  ["Seated Cuddle", "Have him sit down with her sitting between his legs\n\nHer legs should be kicked outward to one side\n\nHave them cuddle closely and tell him to gently hold her cheek"],
  ["Piggyback Sway", "Have her jump onto his back for a piggyback ride\n\nTell them to sway from side to side and look up toward each other\n\nHave her whisper something into his ear, smile near his ear, and give him small kisses on the cheek or ear"],
];

test("all 23 couples prompts preserve the supplied title and wording exactly", () => {
  assert.equal(COUPLES_POSING_PROMPTS.length, 23);
  assert.deepEqual(
    COUPLES_POSING_PROMPTS.map(({ title, instructions }) => [title, instructions]),
    EXPECTED_PROMPTS,
  );
  assert.deepEqual(
    COUPLES_POSING_PROMPTS.map((prompt) => prompt.number),
    Array.from({ length: 23 }, (_, index) => index + 1),
  );
});

test("prompt filtering matches title, instructions, category, and keywords", () => {
  assert.deepEqual(filterCouplesPosingPrompts(COUPLES_POSING_PROMPTS, "kiss").map((item) => item.number), [8, 12, 18, 20, 23]);
  assert.deepEqual(filterCouplesPosingPrompts(COUPLES_POSING_PROMPTS, "walking").map((item) => item.number), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(filterCouplesPosingPrompts(COUPLES_POSING_PROMPTS, "", "Sitting").map((item) => item.number), [22]);
});

test("public and client modes never receive private or unpublished images", () => {
  const images = [
    { id: "private", visibility: "private", is_published: true, rights_confirmed: false },
    { id: "client", visibility: "client_shareable", is_published: true, rights_confirmed: false },
    { id: "public-ok", visibility: "public", is_published: true, rights_confirmed: true },
    { id: "public-no-rights", visibility: "public", is_published: true, rights_confirmed: false },
    { id: "unpublished", visibility: "public", is_published: false, rights_confirmed: true },
  ];

  assert.deepEqual(filterInspirationImagesForMode(images, "public").map((item) => item.id), ["public-ok"]);
  assert.deepEqual(filterInspirationImagesForMode(images, "client").map((item) => item.id), ["client", "public-ok"]);
  assert.equal(filterInspirationImagesForMode(images, "photographer").length, images.length);
});

test("public visibility requires explicit rights confirmation", () => {
  const invalid = validateInspirationImageInput({
    title: "Reference",
    visibility: "public",
    rights_confirmed: false,
    is_published: true,
  });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /permission/i);

  const valid = validateInspirationImageInput({
    title: "Reference",
    visibility: "public",
    rights_confirmed: true,
    is_published: true,
  });
  assert.equal(valid.ok, true);
});

test("uploads reject unsupported types and files larger than six megabytes", () => {
  assert.equal(validateInspirationUpload({ type: "image/jpeg", size: 1024 }).ok, true);
  assert.match(validateInspirationUpload({ type: "image/gif", size: 1024 }).error ?? "", /JPEG, PNG, WebP, or AVIF/);
  assert.match(validateInspirationUpload({ type: "image/png", size: 6 * 1024 * 1024 + 1 }).error ?? "", /6 MB/);
});

test("external references never masquerade as owned storage objects", () => {
  const result = validateInspirationImageInput({
    title: "External reference",
    external_source_url: "https://example.com/reference.jpg",
    storage_path: null,
    visibility: "private",
    rights_confirmed: false,
    is_published: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.owns_storage_object, false);
});

test("storage cleanup includes owned uploads but excludes external references", () => {
  assert.deepEqual(
    getOwnedStoragePaths([
      { storage_path: "2026/a/photo.jpg", external_source_url: null },
      { storage_path: null, external_source_url: "https://example.com/photo.jpg" },
      { storage_path: "", external_source_url: null },
    ]),
    ["2026/a/photo.jpg"],
  );
});
