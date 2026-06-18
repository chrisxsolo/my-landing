export const MIN_ADMIN_DAY_OFFSET = 1;
export const MAX_ADMIN_DAY_OFFSET = 7;

export type AdminDayRange = {
  currStart: Date;
  currEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  periodLabel: string;
  trendLabel: string;
};

const DAY_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", DAY_LABEL_FORMAT);
}

export function clampAdminDayOffset(offset: number): number {
  return Math.min(Math.max(offset, MIN_ADMIN_DAY_OFFSET), MAX_ADMIN_DAY_OFFSET);
}

export function buildAdminDayRange(now: Date, offset: number): AdminDayRange {
  const selectedOffset = clampAdminDayOffset(offset);
  const currStart = new Date(now);
  currStart.setDate(currStart.getDate() - selectedOffset);
  currStart.setHours(0, 0, 0, 0);

  const currEnd = new Date(currStart);
  currEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(currStart);
  prevStart.setDate(prevStart.getDate() - 1);
  const prevEnd = new Date(prevStart);
  prevEnd.setHours(23, 59, 59, 999);

  return {
    currStart,
    currEnd,
    prevStart,
    prevEnd,
    periodLabel: formatDay(currStart),
    trendLabel: `the previous day (${formatDay(prevStart)})`,
  };
}
