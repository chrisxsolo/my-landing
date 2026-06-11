import { describe, it, expect } from "vitest";
import {
  deriveSessionEngineState, isLeaseExpired,
  type PhotoState, type PackageState, type ItemState,
} from "@/lib/contentEngine/state";

const NOW = new Date("2026-06-11T12:00:00Z");
const PAST = "2026-06-11T11:50:00Z";   // lease already expired
const FUTURE = "2026-06-11T12:05:00Z"; // lease still valid
const RECENT = "2026-06-11T11:59:00Z"; // 1 min before NOW, within the 3-min publishing window

const photo = (o: Partial<PhotoState> = {}): PhotoState => ({
  excluded: false, analysis_status: "completed", analysis_lease_expires_at: null, ...o,
});
const item = (o: Partial<ItemState> = {}): ItemState => ({
  status: "draft", publishing_started_at: null, ...o,
});
const pkg = (status: PackageState["status"]): PackageState => ({ status });

function derive(args: {
  photos?: PhotoState[]; activePackage?: PackageState | null; activeItems?: ItemState[];
}) {
  return deriveSessionEngineState({
    photos: args.photos ?? [], activePackage: args.activePackage ?? null,
    activeItems: args.activeItems ?? [], now: NOW,
  });
}

describe("isLeaseExpired", () => {
  it("treats null and past leases as expired, future as live", () => {
    expect(isLeaseExpired(null, NOW)).toBe(true);
    expect(isLeaseExpired(PAST, NOW)).toBe(true);
    expect(isLeaseExpired(FUTURE, NOW)).toBe(false);
  });
});

describe("deriveSessionEngineState — ten mandated cases (spec §6)", () => {
  it("1. all-rejected → reviewed (not published)", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "rejected" }), item({ status: "rejected" })],
    })).toBe("reviewed");
  });

  it("2. all-published → published", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "published" }), item({ status: "published" })],
    })).toBe("published");
  });

  it("3. one published + one approved → partially_published", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "published" }), item({ status: "approved" })],
    })).toBe("partially_published");
  });

  it("4. one published + one failed → failed (rule 1 precedence)", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "published" }), item({ status: "failed" })],
    })).toBe("failed");
  });

  it("5. archived-package failures are excluded → active 'ready' draft → generated", () => {
    // The caller passes only ACTIVE-package items, so archived failures never
    // appear here. With an active ready package + a draft, state is generated.
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"), activeItems: [item({ status: "draft" })],
    })).toBe("generated");
  });

  it("6. zero items + analyzed photos → analyzed", () => {
    expect(derive({ photos: [photo()], activePackage: null, activeItems: [] })).toBe("analyzed");
  });

  it("7. excluded failed photo does not force failed → analyzed", () => {
    expect(derive({
      photos: [photo({ excluded: true, analysis_status: "failed" }), photo({ analysis_status: "completed" })],
    })).toBe("analyzed");
  });

  it("8. all photos skipped → analyzed", () => {
    expect(derive({ photos: [photo({ analysis_status: "skipped" }), photo({ analysis_status: "skipped" })] }))
      .toBe("analyzed");
  });

  it("9. one photo processing with a live lease → analyzing", () => {
    expect(derive({
      photos: [photo({ analysis_status: "processing", analysis_lease_expires_at: FUTURE }), photo()],
    })).toBe("analyzing");
  });

  it("10. failed package with completed photos → failed", () => {
    expect(derive({ photos: [photo()], activePackage: pkg("failed"), activeItems: [] })).toBe("failed");
  });
});

describe("deriveSessionEngineState — lease-aware edges", () => {
  it("empty session → empty", () => {
    expect(derive({ photos: [] })).toBe("empty");
  });

  it("an EXPIRED processing lease is NOT 'analyzing' (interrupted, resumable)", () => {
    // expired processing claim falls through to 'uploaded' (analysis incomplete)
    expect(derive({
      photos: [photo({ analysis_status: "processing", analysis_lease_expires_at: PAST })],
    })).toBe("uploaded");
  });

  it("an active item publishing with a live lease → publishing", () => {
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "publishing", publishing_started_at: RECENT })],
    })).toBe("publishing");
  });

  it("an EXPIRED publishing claim is NOT 'publishing' (interrupted, resumable)", () => {
    // started 10 minutes before NOW — past the 3-minute window. With no other
    // reviewable items, derivation falls through to the photo-based states;
    // the §9.4 reconciliation banner is what surfaces the interrupted publish.
    expect(derive({
      photos: [photo()], activePackage: pkg("ready"),
      activeItems: [item({ status: "publishing", publishing_started_at: "2026-06-11T11:50:00Z" })],
    })).toBe("analyzed");
  });
});
