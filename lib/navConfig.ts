// ─────────────────────────────────────────────────────────────────────────────
// lib/navConfig.ts
//
// Pure helpers + types for the admin-editable primary navigation (ProNav).
// No DB / Next imports → unit-testable and safe to import on client or server.
//
// The whole nav is stored as ONE JSON blob in site_settings under the key
// `nav_config`. `parseNavConfig` tolerantly normalizes untrusted input (the DB
// row or an admin PUT body) and falls back to DEFAULT_NAV_CONFIG when the shape
// is unusable, so ProNav can always render something sane.
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_CONFIG_SETTING_KEY = "nav_config";

// ── Types ────────────────────────────────────────────────────────────────────
export type NavLink = {
  id: string;
  type: "link";
  label: string;
  href: string;
  visible: boolean;
};

export type NavChild = {
  id: string;
  label: string;
  href: string;
};

export type NavGroup = {
  id: string;
  type: "group";
  label: string;
  href: string | null; // null → plain dropdown button; set → split button (link + caret)
  visible: boolean;
  children: NavChild[];
};

export type NavItem = NavLink | NavGroup;

export type NavAction = {
  label: string;
  href: string;
  visible: boolean;
};

export type NavConfig = {
  primary: NavItem[];
  clientLogin: NavAction;
  cta: NavAction;
};

// ── Limits (enforced by the normalizer) ──────────────────────────────────────
const MAX_LABEL_LEN = 40;
const MAX_HREF_LEN = 200;
const MAX_PRIMARY_ITEMS = 16;
const MAX_CHILDREN = 16;

// ── Default — an exact reproduction of the original hardcoded ProNav ──────────
export const DEFAULT_NAV_CONFIG: NavConfig = {
  primary: [
    { id: "home", type: "link", label: "Home", href: "/", visible: true },
    { id: "dates", type: "link", label: "Dates", href: "/availability", visible: true },
    { id: "about", type: "link", label: "About", href: "/about", visible: true },
    { id: "blog", type: "link", label: "Blog", href: "/blog", visible: true },
    {
      id: "guides",
      type: "group",
      label: "Guides",
      href: null,
      visible: true,
      children: [
        { id: "grad-guide", label: "Grad guide", href: "/grad-guide" },
        { id: "family-guide", label: "Family guide", href: "/family-guide" },
        { id: "couples-guide", label: "Couples guide", href: "/couples-guide" },
        { id: "locations", label: "Locations", href: "/bay-area-locations" },
        { id: "faq", label: "FAQ", href: "/faq" },
      ],
    },
    {
      id: "work",
      type: "group",
      label: "Work",
      href: "/portfolio",
      visible: true,
      children: [
        { id: "grad-gallery", label: "Grad gallery", href: "/portfolio?category=grads" },
        { id: "family-gallery", label: "Family gallery", href: "/portfolio?category=families" },
      ],
    },
    {
      id: "rates",
      type: "group",
      label: "Rates",
      href: "/pricing",
      visible: true,
      children: [
        { id: "couples-rates", label: "Couples rates", href: "/pricing/couples" },
        { id: "grad-rates", label: "Grad rates", href: "/pricing/grads" },
        { id: "family-rates", label: "Family rates", href: "/pricing/families" },
      ],
    },
  ],
  clientLogin: { label: "Client login", href: "/login", visible: true },
  cta: { label: "Book a shoot", href: "/contact", visible: true },
};

// ── Normalization helpers ─────────────────────────────────────────────────────
let idCounter = 0;
function genId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LABEL_LEN) return null;
  return trimmed;
}

// Internal app paths only. Must start with a single "/" (query strings allowed),
// never "//" (protocol-relative) or an absolute "http(s)://" URL — this keeps the
// nav from being turned into an open-redirect / off-site link by a bad payload.
function cleanHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_HREF_LEN) return null;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

function cleanId(value: unknown, prefix: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && trimmed.length <= 64) return trimmed;
  }
  return genId(prefix);
}

function normalizeChild(raw: unknown): NavChild | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = cleanLabel(r.label);
  const href = cleanHref(r.href);
  if (!label || !href) return null;
  return { id: cleanId(r.id, "child"), label, href };
}

function normalizeItem(raw: unknown): NavItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = cleanLabel(r.label);
  if (!label) return null;
  const visible = r.visible !== false; // default to visible

  if (r.type === "group") {
    const children = Array.isArray(r.children)
      ? r.children.map(normalizeChild).filter((c): c is NavChild => c !== null).slice(0, MAX_CHILDREN)
      : [];
    const href = r.href == null ? null : cleanHref(r.href);
    return { id: cleanId(r.id, "group"), type: "group", label, href, visible, children };
  }

  // default: treat as a simple link
  const href = cleanHref(r.href);
  if (!href) return null;
  return { id: cleanId(r.id, "link"), type: "link", label, href, visible };
}

function normalizeAction(raw: unknown, fallback: NavAction): NavAction {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const r = raw as Record<string, unknown>;
  const label = cleanLabel(r.label) ?? fallback.label;
  const href = cleanHref(r.href) ?? fallback.href;
  const visible = r.visible !== false;
  return { label, href, visible };
}

// Accepts the raw DB value (a JSON string) OR an already-parsed object, and
// returns a guaranteed-valid NavConfig. Anything unusable → DEFAULT_NAV_CONFIG.
export function parseNavConfig(raw: unknown): NavConfig {
  let source = raw;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return DEFAULT_NAV_CONFIG;
    }
  }
  if (!source || typeof source !== "object") return DEFAULT_NAV_CONFIG;

  const s = source as Record<string, unknown>;
  const primary = Array.isArray(s.primary)
    ? s.primary.map(normalizeItem).filter((i): i is NavItem => i !== null).slice(0, MAX_PRIMARY_ITEMS)
    : [];

  // An empty primary row means the payload was junk — fall back rather than
  // render a nav with no links.
  if (primary.length === 0) return DEFAULT_NAV_CONFIG;

  return {
    primary,
    clientLogin: normalizeAction(s.clientLogin, DEFAULT_NAV_CONFIG.clientLogin),
    cta: normalizeAction(s.cta, DEFAULT_NAV_CONFIG.cta),
  };
}
