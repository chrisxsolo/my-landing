// Parsing, validation, and deterministic evidence detection for the
// check-payment workflow. Pure functions — no I/O, unit tested in
// tests/unit/paymentDetection.test.ts.

export interface PaymentDetectionResult {
  paid: boolean;
  amount: string | null;
  method: string | null;
  note: string;
}

export const FALLBACK_NOTE_PAID   = "Payment evidence found.";
export const FALLBACK_NOTE_UNPAID = "No payment evidence found";

// ── Normalization ────────────────────────────────────────────────────────────

// Only a real JSON boolean or the exact strings "true"/"false" count.
// Anything else (e.g. "yes", 1, "paid") is an invalid response, not a value.
function normalizePaid(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true")  return true;
    if (v === "false") return false;
  }
  return null;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeCandidate(value: unknown): PaymentDetectionResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (!("paid" in obj)) return null;

  const paid = normalizePaid(obj.paid);
  if (paid === null) return null;

  const note = typeof obj.note === "string" && obj.note.trim()
    ? obj.note.trim()
    : paid ? FALLBACK_NOTE_PAID : FALLBACK_NOTE_UNPAID;

  return {
    paid,
    amount: normalizeNullableString(obj.amount),
    method: normalizeNullableString(obj.method),
    note,
  };
}

// ── JSON extraction ──────────────────────────────────────────────────────────

function stripMarkdownFences(text: string): string {
  return text.replace(/```[a-z]*/gi, " ").trim();
}

// Yield every balanced {...} substring, string- and escape-aware, in order of
// where it starts. Candidates that fail to parse or validate are skipped by
// the caller, so unrelated braces before the real object are harmless.
function* balancedJsonObjects(text: string): Generator<string> {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0, inString = false, escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) { yield text.slice(start, i + 1); break; }
      }
    }
  }
}

// Returns a validated result, or null when the model output contains no
// usable payment JSON. null means "the analysis failed" — never "unpaid".
export function parsePaymentDetectionResult(rawText: string): PaymentDetectionResult | null {
  const trimmed = (rawText ?? "").trim();
  if (!trimmed) return null;

  const unfenced = stripMarkdownFences(trimmed);
  for (const attempt of [trimmed, unfenced]) {
    try {
      const result = normalizeCandidate(JSON.parse(attempt));
      if (result) return result;
    } catch { /* fall through to balanced-object scan */ }
  }

  for (const candidate of balancedJsonObjects(unfenced)) {
    try {
      const result = normalizeCandidate(JSON.parse(candidate));
      if (result) return result;
    } catch { /* try the next candidate */ }
  }
  return null;
}

// Single-line, length-capped preview of model output for server logs and
// error payloads — never the full email content.
export function sanitizeModelPreview(raw: string, maxLength = 200): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

// ── Deterministic evidence ───────────────────────────────────────────────────

// High-confidence payment phrases. Generic words like "payment" alone do NOT
// match — each pattern needs sender/receiver or money context.
const EVIDENCE_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: '"sent the deposit"',     pattern: /\bsent\s+(?:you\s+|over\s+)?the\s+deposit\b/i },
  { label: '"just paid"',            pattern: /\bjust\s+paid\b/i },
  { label: '"payment sent"',         pattern: /\bpayment\s+(?:was\s+)?sent\b/i },
  { label: '"deposit sent"',         pattern: /\bdeposit\s+(?:was\s+)?sent\b/i },
  { label: '"you received $"',       pattern: /\byou\s+received\s+\$\s?\d/i },
  { label: '"received money"',       pattern: /\breceived\s+money\b/i },
  { label: '"sent you $"',           pattern: /\bsent\s+you\s+\$\s?\d/i },
  { label: "Venmo confirmation",     pattern: /\bvenmo\b[\s\S]{0,120}?\bpaid\s+you\b/i },
  { label: "Zelle confirmation",     pattern: /\bzelle\b[\s\S]{0,120}?\bsent\s+you\b/i },
  { label: "PayPal confirmation",    pattern: /\bpaypal\b[\s\S]{0,120}?(?:you(?:'ve|\s+have)\s+got\s+money|\bsent\s+you\b)/i },
  { label: "Cash App confirmation",  pattern: /\bcash\s?app\b[\s\S]{0,120}?\bsent\s+you\b/i },
  { label: "Apple Cash confirmation", pattern: /\bapple\s+(?:cash|pay)\b[\s\S]{0,120}?\b(?:sent|received|payment)\b/i },
];

export function findDeterministicPaymentEvidence(text: string): string[] {
  if (!text) return [];
  return EVIDENCE_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
}
