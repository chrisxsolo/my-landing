// SoloXSnaps → PixiSet Autofill: DOM helpers shared by the contract and
// invoice fillers.

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

function esc(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
