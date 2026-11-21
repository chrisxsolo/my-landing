// Monochrome line icons for the /links hub. Each link's emoji (set in the
// admin Links tab) picks its icon, so the page stays one color while the
// admin field keeps working. Unknown emoji fall back to the generic link icon.

export type LinkIconName =
  | "camera"
  | "globe"
  | "calendar"
  | "tag"
  | "cap"
  | "instagram"
  | "link";

const EMOJI_ICONS: Record<string, LinkIconName> = {
  "📸": "camera",
  "📷": "camera",
  "🌐": "globe",
  "💻": "globe",
  "📅": "calendar",
  "🗓️": "calendar",
  "💰": "tag",
  "💵": "tag",
  "🏷️": "tag",
  "🎓": "cap",
};

export function iconForEmoji(emoji: string | null): LinkIconName {
  return (emoji && EMOJI_ICONS[emoji.trim()]) || "link";
}

const ICON_SHAPES: Record<LinkIconName, React.ReactNode> = {
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V5A1.5 1.5 0 0 1 5 3.5h7.2a1.5 1.5 0 0 1 1.06.44l7 7a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7-7a1.5 1.5 0 0 1-.44-1.06z" />
      <circle cx="8" cy="8" r="1.2" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.8V16c1.5 1.6 3.4 2.3 5.5 2.3s4-.7 5.5-2.3v-4.2M21.5 9.5v5" />
    </>
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.6" cy="7.4" r="0.6" fill="currentColor" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </>
  ),
};

export default function LinkIcon({ name, size = 22 }: { name: LinkIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_SHAPES[name]}
    </svg>
  );
}
