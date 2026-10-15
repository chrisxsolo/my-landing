// ─────────────────────────────────────────────────────────────────────────────
// Structured store for learned writing rules.
//
// Replaces the previous design, which kept every rule as a bullet inside one
// markdown note and "merged" new rules by asking an LLM to rewrite the whole
// note. That failed in three ways at once: the merge ran at max_tokens 1600
// against a 2,000-token note, so it truncated and silently destroyed rules
// (the live note currently ends mid-line with a dangling "- ["); contradictory
// rules accumulated because nothing could reliably detect a conflict; and
// one-off factual corrections became permanent style rules.
//
// Here a rule is a row. Dedup and conflict detection are deterministic string
// work. Nothing is applied to drafts until Chris approves it.
// ─────────────────────────────────────────────────────────────────────────────

export const RULE_CATEGORIES = ["style", "policy", "factual"] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_STATUSES = ["pending", "approved", "rejected", "superseded"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export type WritingRule = {
  id: string;
  rule: string;
  category: RuleCategory;
  status: RuleStatus;
  /** Where it came from: "learn-from-edit", "train-chat", "migrated-vault". */
  source: string;
  createdAt: string;
  /** Set when a newer approved rule replaced this one. */
  supersededBy?: string | null;
};

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

/**
 * Normalised form for comparison: case, bullets, date stamps, punctuation and
 * number spelling removed.
 *
 * Spelled-out numbers are folded to digits so "three sentences or fewer" and
 * "3 sentences or fewer" are recognised as the same rule. Without that, a
 * one-word difference in a seven-word rule drops similarity to 0.75 and the
 * duplicate is stored twice.
 */
export function normalizeRule(rule: string): string {
  return rule
    .toLowerCase()
    .replace(/^\s*[-–•*]\s*/, "")
    .replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, "")
    .replace(/[.!,;:"'`]/g, "")
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/g, (word) => NUMBER_WORDS[word])
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard similarity over word sets. Cheap, and good enough for one-liners. */
export function ruleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeRule(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalizeRule(b).split(" ").filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;

  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / (wordsA.size + wordsB.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.8;
export const CONFLICT_SIMILARITY_FLOOR = 0.45;

/**
 * Words that make a rule a prohibition. A rule without one of these is read as
 * a positive directive on its subject.
 *
 * Polarity is the reliable signal. Enumerating every affirmative verb does not
 * work: "Open with the client's name as the greeting" is a positive
 * instruction that contains no "use", "include", or "add", so an
 * allow-list of positive verbs misses it and the contradiction with "Omit
 * personal greetings" goes undetected — which is exactly how both ended up
 * live in the old rules note at the same time.
 */
const NEGATION = /\b(?:never|not|no|don'?t|do not|avoid|omit|remove|skip|drop|stop|without|exclude)\b/;

/**
 * Opposing pairs that share a polarity, so negation alone cannot separate
 * them. "Keep it shorter" and "Add more detail" are both positive directives.
 */
const OPPOSING_TERMS: [RegExp, RegExp][] = [
  [/\blong(?:er)?\b|\bmore detail\b|\bexpand\b|\bincrease\b|\bmore personal\b/,
   /\bshort(?:er)?\b|\bless detail\b|\bconcise\b|\bshorten\b|\bdecrease\b|\bcut\b|\btighten\b/],
  [/\bbullet\b|\blist\b/, /\bsentence\b|\bprose\b|\bparagraph\b/],
  [/\bmultiple\b|\bseveral\b|\ball (?:the )?(?:dates|options)\b/,
   /\bonly 1\b|\bjust 1\b|\bsingle\b|\bearliest\b|\b1 date\b/],
];

/**
 * Subjects a conflict must agree on before it counts as one.
 *
 * Two rules disagreeing in polarity is only interesting when they are talking
 * about the same thing.
 */
const SUBJECT_TERMS = [
  "greeting", "sign-off", "signoff", "signature", "name", "date", "dates",
  "bullet", "list", "price", "pricing", "exclamation", "paragraph", "length",
  "turnaround", "golden hour", "sunset", "time", "congratulation", "detail",
  "emoji", "em dash", "closing", "apology", "location",
];

function sharedSubjects(a: string, b: string): string[] {
  const normA = normalizeRule(a);
  const normB = normalizeRule(b);
  return SUBJECT_TERMS.filter((term) => normA.includes(term) && normB.includes(term));
}

export type RuleConflict = {
  existing: WritingRule;
  reason: string;
};

/**
 * Finds approved rules the candidate contradicts.
 *
 * Requires a shared SUBJECT plus either opposite polarity or an explicit
 * opposing-term pair. The subject gate is what keeps "Never use emoji" from
 * reading as a conflict with "Always use natural contractions" simply because
 * one is a prohibition.
 */
export function findConflicts(candidate: string, existing: WritingRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const candidateNorm = normalizeRule(candidate);
  const candidateNegates = NEGATION.test(candidateNorm);

  for (const rule of existing) {
    if (rule.status !== "approved") continue;

    const subjects = sharedSubjects(candidate, rule.rule);
    if (!subjects.length) continue;
    if (ruleSimilarity(candidate, rule.rule) >= DUPLICATE_THRESHOLD) continue;

    const ruleNorm = normalizeRule(rule.rule);
    const oppositePolarity = candidateNegates !== NEGATION.test(ruleNorm);
    const opposedTerms = OPPOSING_TERMS.some(([left, right]) =>
      (left.test(candidateNorm) && right.test(ruleNorm)) ||
      (right.test(candidateNorm) && left.test(ruleNorm)),
    );
    if (!oppositePolarity && !opposedTerms) continue;

    conflicts.push({
      existing: rule,
      reason: `Both rules are about ${subjects.join(" and ")}, and they point in opposite directions.`,
    });
  }
  return conflicts;
}

export function findDuplicate(candidate: string, existing: WritingRule[]): WritingRule | null {
  let best: { rule: WritingRule; score: number } | null = null;

  for (const rule of existing) {
    if (rule.status === "rejected" || rule.status === "superseded") continue;
    const score = ruleSimilarity(candidate, rule.rule);
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) {
      best = { rule, score };
    }
  }
  return best?.rule ?? null;
}

export type RuleIntake = {
  verdict: "duplicate" | "conflict" | "new";
  duplicateOf?: WritingRule;
  conflicts?: RuleConflict[];
};

/**
 * Decides what should happen to a proposed rule. Pure: the caller performs the
 * write, and a conflict is returned for Chris to resolve rather than resolved
 * by guessing which rule he meant.
 */
export function classifyRuleIntake(candidate: string, existing: WritingRule[]): RuleIntake {
  const duplicate = findDuplicate(candidate, existing);
  if (duplicate) return { verdict: "duplicate", duplicateOf: duplicate };

  const conflicts = findConflicts(candidate, existing);
  if (conflicts.length) return { verdict: "conflict", conflicts };

  return { verdict: "new" };
}

/** Approved style rules only — the ones the prompt is allowed to carry. */
export function selectPromptRules(rules: WritingRule[], limit = 20): WritingRule[] {
  return rules
    .filter((rule) => rule.status === "approved" && rule.category === "style")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
