"use client";
// One review-queue item: thumbnail, what it is about, the suggested answer
// against what is saved, the evidence label (when it means something), the
// plain-English reason and the recommended action, then the buttons.
// Photo items act through the tagging API (preview → apply → undo); finding
// items call the existing admin endpoint their action names. Buttons are at
// least 44px tall for touch.
import { T } from "@/app/admin/adminTheme";
import { btn, chip } from "@/app/admin/content-engine/[id]/ui";
import supabaseImageLoader from "@/lib/supabaseImageLoader";
import { isPhotoItem, QUEUE_LABELS, type QueueAction, type QueueItem } from "@/lib/photoTagging/reviewQueue";
import { evidenceOf, type TaggingOptions, type TagSuggestion } from "@/lib/photoTagging/types";
import { schoolFilterLabel } from "@/lib/reviewQueue/findingItems";
import { valueLabel } from "./TagApplyPanel";

export const TOUCH = { minHeight: 44, minWidth: 44, padding: "8px 14px", fontSize: 13 } as const;
const THUMB = 72;
const PUBLIC_STORAGE = "/storage/v1/object/public/";

export interface RowHandlers {
  busy: boolean;
  /** Accept one suggested answer (photo items, grad-no-school). */
  onAccept: (item: QueueItem, s: TagSuggestion) => void;
  /** Dismiss every suggestion / keep every placement live. */
  onReject: (item: QueueItem) => void;
  /** Run a finding action against its admin endpoint. */
  onAction: (item: QueueItem, action: QueueAction) => void;
  onOpen?: (key: string) => void;
}

function thumbSrc(item: QueueItem, thumbs: Record<string, string>): string | null {
  if (!item.url) return thumbs[item.key] ?? null;
  return item.url.includes(PUBLIC_STORAGE) && !item.url.includes("/render/image/")
    ? supabaseImageLoader({ src: item.url, width: THUMB * 2, quality: 50 }) : item.url;
}

function Thumb({ item, thumbs }: { item: QueueItem; thumbs: Record<string, string> }) {
  const src = thumbSrc(item, thumbs);
  const box = { width: THUMB, height: THUMB, borderRadius: 8, flex: "0 0 auto", background: T.inset } as const;
  // eslint-disable-next-line @next/next/no-img-element -- pre-sized transform / signed URL, never full-res
  return src ? <img src={src} alt="" loading="lazy" style={{ ...box, objectFit: "cover" }} /> : <div style={box} aria-hidden />;
}

function Facts({ item, options }: { item: QueueItem; options: TaggingOptions }) {
  const parts = [
    item.sessionName && item.sessionName !== item.title ? `Session: ${item.sessionName}` : null,
    item.school ? `School: ${schoolFilterLabel(item.school)}` : null,
    item.location && item.field !== "location" ? `Location: ${item.location}` : null,
  ].filter(Boolean);
  return (
    <div style={{ fontSize: 12, color: T.inkSoft, display: "grid", gap: 2 }}>
      {parts.length > 0 && <span>{parts.join(" · ")}</span>}
      {item.field && (
        <span>
          Saved: <span style={{ color: T.inkFaint }}>{valueLabel(item.field, item.before, options)}</span>
          {item.options.length > 0 && <> · Suggested: <strong style={{ color: T.ink }}>{item.options.map((s) => s.label).join(" / ")}</strong></>}
        </span>
      )}
      {item.evidence && <span style={chip(T.blue, T.blueBg)}>Evidence: {item.evidence}</span>}
    </div>
  );
}

function PhotoButtons({ item, h }: { item: QueueItem; h: RowHandlers }) {
  const suggestionTitle = (s: TagSuggestion) =>
    `${s.reason}${s.appliesTo === "session" ? " · sets the whole session" : ""}${s.field === "location" ? ` · evidence: ${evidenceOf(s.origin)}` : ""}`;
  return (
    <>
      {item.options.map((s) => (
        <button key={s.id} type="button" style={{ ...btn(item.safe), ...TOUCH }} disabled={h.busy} onClick={() => h.onAccept(item, s)} title={suggestionTitle(s)}>
          {item.options.length > 1 ? s.label : "Approve"}{s.appliesTo === "session" ? " (session)" : ""}
        </button>
      ))}
      {item.options.length > 0 && (
        <button type="button" style={{ ...btn(false), ...TOUCH }} disabled={h.busy} onClick={() => h.onReject(item)} title="Never suggest these again">Reject</button>
      )}
      {h.onOpen && isPhotoItem(item) && (
        <button type="button" style={{ ...btn(item.options.length === 0), ...TOUCH }} onClick={() => h.onOpen?.(item.key)}
          title="Open this photo's tags — set or change its university, location and campus spot by hand">Edit</button>
      )}
    </>
  );
}

function FindingButtons({ item, h }: { item: QueueItem; h: RowHandlers }) {
  return (
    <>
      {item.actions.map((a) => (a.href
        ? <a key={a.id} href={a.href} style={{ ...btn(false), ...TOUCH, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>{a.label}</a>
        : <button key={a.id} type="button" disabled={h.busy} onClick={() => h.onAction(item, a)}
            style={{ ...btn(a.role === "approve", a.role === "approve" && a.label.startsWith("Remove")), ...TOUCH }}>{a.label}</button>))}
      {item.kind === "excluded-live" && (
        <button type="button" style={{ ...btn(false), ...TOUCH }} disabled={h.busy} onClick={() => h.onReject(item)}
          title="Leave the photo where it is and stop asking">Keep live</button>
      )}
      {item.href && !item.actions.some((a) => a.href) && (
        <a href={item.href} style={{ ...btn(false), ...TOUCH, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Edit</a>
      )}
    </>
  );
}

export default function ReviewQueueRow({ item, options, thumbs, h }: {
  item: QueueItem; options: TaggingOptions; thumbs: Record<string, string>; h: RowHandlers;
}) {
  const photoItem = isPhotoItem(item);
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 12, background: T.inset, border: `1px solid ${T.border}` }}>
      <Thumb item={item} thumbs={thumbs} />
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14, color: T.ink }}>{item.title}</strong>
          <span style={{ fontSize: 12, color: T.amber }}>{QUEUE_LABELS[item.kind]}</span>
        </div>
        <Facts item={item} options={options} />
        <p style={{ margin: 0, fontSize: 13, color: T.inkSoft }}>{item.explanation}</p>
        <p style={{ margin: 0, fontSize: 13, color: T.ink }}>→ {item.recommended}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {photoItem && item.kind !== "excluded-live" ? <PhotoButtons item={item} h={h} /> : null}
          {item.kind === "grad-no-school" && item.href ? (
            <a href={item.href} style={{ ...btn(false), ...TOUCH, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Session facts</a>
          ) : null}
          {!photoItem || item.kind === "excluded-live" ? <FindingButtons item={item} h={h} /> : null}
        </div>
      </div>
    </li>
  );
}
