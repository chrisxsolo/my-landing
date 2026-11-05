"use client";

// Focus management shared by every modal photo viewer: on open, lock body
// scrolling and move focus to the close button; while open, keep Tab and
// Shift+Tab inside the dialog; on close, restore scrolling and return focus to
// the element that opened it. Escape and arrow keys stay with the caller.

import { useEffect, type RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

/** Wraps Tab / Shift+Tab around the dialog's own controls. */
export function keepFocusInside(event: KeyboardEvent, dialog: HTMLElement | null) {
  if (event.key !== "Tab" || !dialog) return;
  const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !dialog.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

export default function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  initialFocusRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    initialFocusRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => keepFocusInside(event, dialogRef.current);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [dialogRef, initialFocusRef]);
}
