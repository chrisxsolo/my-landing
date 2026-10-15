import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminHandler } from "../helpers/loadAdminHandler";

const failingFetch = async () => Response.json({ error: "Server rejected change" }, { status: 500 });
const noop = () => {};
const toast = vi.fn();
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(noop); });

function common() {
  return { fetch: failingFetch, showToast: toast, revalidatePublicSite: vi.fn() };
}

describe("admin mutation failures", () => {
  it.each([
    ["deletePortfolioImage", "setPortfolioImages", "setPortfolioDeleteConfirm", "editingPortfolioImage"],
    ["deleteCategory", "setCategories", "setCategoryDeleteConfirm", "editingCategory"],
  ])("%s preserves the row and reports an error", async (name, setter, confirm, editing) => {
    let rows = [{ id: 1 }];
    const handler = loadAdminHandler(name, { ...common(), [setter]: (f: typeof rows | ((p: typeof rows) => typeof rows)) => { rows = typeof f === "function" ? f(rows) : f; }, [confirm]: noop, [editing]: null });
    await handler(1);
    expect(rows).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith(expect.any(String), false);
  });
  it("does not change carousel selection after a rejected update", async () => {
    let rows = [{ id: 1, hero_carousel: false }];
    const handler = loadAdminHandler("toggleCarousel", { ...common(), portfolioImages: rows, setPortfolioImages: (f: (p: typeof rows) => typeof rows) => { rows = f(rows); } });
    await handler(1, false);
    expect(rows[0].hero_carousel).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.any(String), false);
  });
});

describe("batch upload recovery", () => {
  it.each(["upload", "insert", "network", "partial"])("keeps unsuccessful items after %s failure", async failure => {
    const original = [1, 2].map(id => ({ id, file: { id }, title: `Photo ${id}`, category_slug: "grads", location: "Campus", hash: String(id), preview: "blob:test" }));
    let queue = original;
    let saving = false;
    const handler = loadAdminHandler("saveBatchImages", {
      ...common(), batchItems: original, categories: [], portfolioImages: [],
      fetch: failure === "network" ? async () => { throw new Error("offline"); } : failure === "partial" ? async () => Response.json({}) : failingFetch,
      setBatchSaving: (v: boolean) => { saving = v; },
      setBatchItems: (v: typeof queue | ((p: typeof queue) => typeof queue)) => { queue = typeof v === "function" ? v(queue) : v; },
      mapWithConcurrency: async (items: unknown[], _limit: number, fn: (v: unknown) => unknown) => Promise.all(items.map(fn)),
      uploadImage: async (file: { id: number }) => failure === "upload" || (failure === "partial" && file.id === 2) ? null : "https://example.test/photo.jpg",
      clearBatchSelection: noop, setBatchSelected: noop, batchAnchorRef: { current: null }, fetchPortfolioImages: noop,
      URL: { revokeObjectURL: noop },
    });
    await handler();
    expect(saving).toBe(false);
    expect(queue.map(item => item.id)).toEqual(failure === "partial" ? [2] : [1, 2]);
    expect(queue.at(-1)?.location).toBe("Campus");
  });
});

describe("payment form recovery", () => {
  it.each([false, "network"])("keeps form contents and clears loading after %s failure", async failure => {
    let saving = false;
    const close = vi.fn();
    const handler = loadAdminHandler("recordCardPayment", {
      ...common(), cardPaymentAmount: "150", cardPaymentMethod: "Venmo",
      setCardPaymentSaving: (v: boolean) => { saving = v; },
      handleFinalPayment: async () => { if (failure === "network") throw new Error("offline"); return false; },
      setCardPaymentId: close, setCardPaymentAmount: close, setCardPaymentMethod: close,
    });
    await handler(1);
    expect(saving).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
});

describe("inbox read state", () => {
  it("does not hide unread messages when Gmail rejects marking them read", async () => {
    let threads = [{ threadId: "t1", timestamp: 1, isUnread: true }];
    const handler = loadAdminHandler("dismissUnreadThread", {
      ...common(), inboxThreads: threads,
      setInboxThreads: (f: (p: typeof threads) => typeof threads) => { threads = f(threads); },
      setDismissedThreadIds: noop,
    });
    await handler("t1");
    expect(threads[0].isUnread).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.any(String), false);
  });
  it("does not persist a permanent thread dismissal", async () => {
    const persist = vi.fn();
    const handler = loadAdminHandler("dismissUnreadThread", {
      ...common(), fetch: async () => Response.json({ ok: true }),
      inboxThreads: [{ threadId: "t1", timestamp: 1, isUnread: true }],
      setInboxThreads: noop, setDismissedThreadIds: (f: (p: Set<string>) => Set<string>) => f(new Set()),
      localStorage: { setItem: persist },
    });
    await handler("t1");
    expect(persist).not.toHaveBeenCalled();
  });
});

describe("successful actions and shared calendar callback", () => {
  it("removes a portfolio image only after a successful deletion", async () => {
    let rows = [{ id: 1 }, { id: 2 }];
    const handler = loadAdminHandler("deletePortfolioImage", {
      ...common(), fetch: async () => Response.json({ ok: true }),
      setPortfolioImages: (f: (p: typeof rows) => typeof rows) => { rows = f(rows); },
      setPortfolioDeleteConfirm: noop, editingPortfolioImage: null,
    });
    await handler(1);
    expect(rows).toEqual([{ id: 2 }]);
    expect(toast).toHaveBeenCalledWith("Portfolio image deleted");
  });
  it.each([true, false])("calendar closes the form only on success (%s)", async success => {
    let saving = false;
    const close = vi.fn();
    const handler = loadAdminHandler("confirmFinalPayment", {
      onFinalPayment: async () => success, finalPaymentAmount: "150", finalPaymentMethod: "Venmo", s: { id: 1 },
      setFinalPaymentSaving: (value: boolean) => { saving = value; },
      setFinalPaymentId: close, setFinalPaymentAmount: close, setFinalPaymentMethod: close,
    }, "app/admin/SessionCalendar.tsx");
    await handler();
    expect(saving).toBe(false);
    expect(close).toHaveBeenCalledTimes(success ? 3 : 0);
  });
  it("preserves a newer unread message that arrives while marking an older message read", async () => {
    let threads = [{ threadId: "t1", timestamp: 1, isUnread: true }];
    const handler = loadAdminHandler("dismissUnreadThread", {
      ...common(), inboxThreads: threads,
      fetch: async () => { threads = [{ threadId: "t1", timestamp: 2, isUnread: true }]; return Response.json({ ok: true }); },
      setInboxThreads: (f: (p: typeof threads) => typeof threads) => { threads = f(threads); },
    });
    await handler("t1");
    expect(threads[0].isUnread).toBe(true);
  });
  it("marks the current message read after Gmail confirms the update", async () => {
    let threads = [{ threadId: "t1", timestamp: 1, isUnread: true }];
    const handler = loadAdminHandler("dismissUnreadThread", {
      ...common(), inboxThreads: threads, fetch: async () => Response.json({ ok: true }),
      setInboxThreads: (f: (p: typeof threads) => typeof threads) => { threads = f(threads); },
    });
    await handler("t1");
    expect(threads[0].isUnread).toBe(false);
  });
});
