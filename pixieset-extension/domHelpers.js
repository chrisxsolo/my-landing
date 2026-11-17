// SoloXSnaps → PixiSet Autofill: DOM helpers shared by the contract and
// invoice fillers.

const ORPHANED_NOTE = "The extension was reloaded or updated, and this tab is still running the old copy. Refresh this page, then open Autofill again.";

// True when this tab's scripts have outlived their extension: after a reload
// or an update the browser keeps the old scripts running, cut off from it.
function extensionOrphaned() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime) && !chrome.runtime.id;
}

// The version of the scripts actually running in this tab, or "" when unknown.
function runningVersion() {
  try { return extensionOrphaned() || typeof chrome === "undefined" || !chrome.runtime ? "" : `v${chrome.runtime.getManifest().version}`; }
  catch { return ""; }
}

function setNativeValue(el, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    el.tagName === "INPUT" ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (nativeSetter) nativeSetter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function showFillStatus(count) {
  const el = document.getElementById("sxs-fill-status");
  if (!el) return;
  el.textContent = count > 0
    ? `✓ Filled ${count} field${count !== 1 ? "s" : ""}. Review and adjust as needed.`
    : "⚠ No fillable fields found on this page yet. Scroll to the fields and try again.";
  el.style.color = count > 0 ? "#26a69a" : "#e67e22";
}

// Safe inside text and inside double-quoted attributes alike.
function esc(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
