"use client";

import type { CSSProperties } from "react";
import { useId, useState } from "react";
import { C } from "@/lib/colors";

const CLAMP_CLASSES: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
};

type ExpandableTextProps = {
  text: string;
  className?: string;
  collapsedLines?: keyof typeof CLAMP_CLASSES;
  previewLength?: number;
  buttonColor?: string;
  buttonStyle?: CSSProperties;
};

export default function ExpandableText({
  text,
  className = "",
  collapsedLines = 3,
  previewLength = 180,
  buttonColor = C.p1,
  buttonStyle,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const cleanText = text.trim();
  const shouldCollapse = cleanText.length > previewLength;
  const clampClass = !expanded && shouldCollapse ? CLAMP_CLASSES[collapsedLines] : "";

  if (!cleanText) return null;

  return (
    <div>
      <p id={textId} className={[className, clampClass].filter(Boolean).join(" ")}>
        {cleanText}
      </p>
      {shouldCollapse ? (
        <button
          type="button"
          aria-controls={textId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] transition-opacity hover:opacity-75"
          style={{ color: buttonColor, ...buttonStyle }}
        >
          {expanded ? "Show less" : "Show more"}
          <span aria-hidden="true">{expanded ? "-" : "+"}</span>
        </button>
      ) : null}
    </div>
  );
}
