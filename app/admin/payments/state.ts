// Centralized filter state for the Revenue dashboard. Every section derives
// from these filters; drill interactions patch them.

import type { CompareMode, DatePreset } from "@/lib/revenue/periods";

export type RevenueFilters = {
  preset: DatePreset;
  customStart: string; // YYYY-MM-DD, used when preset === "custom"
  customEnd: string;
  compare: CompareMode;
  service: string; // ServiceKey, "" = all
  school: string; // school key, "" = all
  method: string; // normalized method label, "" = all
  status: string; // active | refunded | voided, "" = all
  search: string;
};

// Opens on the current month so the tab is an instant month snapshot;
// every other range stays one click away in the preset selector.
export const DEFAULT_REVENUE_FILTERS: RevenueFilters = {
  preset: "thisMonth",
  customStart: "",
  customEnd: "",
  compare: "prevPeriod",
  service: "",
  school: "",
  method: "",
  status: "",
  search: "",
};

export type SectionId =
  | "overview"
  | "trends"
  | "composition"
  | "clients"
  | "receivables"
  | "ledger"
  | "quality"
  | "insights";

export function hasActiveDimensionFilters(f: RevenueFilters): boolean {
  return Boolean(f.service || f.school || f.method || f.status || f.search);
}
