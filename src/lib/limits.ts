/** Browser-side spending limit, on top of the onchain self-exclusion. */
const KEY = "imd-picks:limits";
type Limits = { dailyMax: number; log: number[]; adult: boolean };

export function readLimits(): Limits {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Limits>;
    return { dailyMax: v.dailyMax ?? 3, log: v.log ?? [], adult: v.adult ?? false };
  } catch {
    return { dailyMax: 3, log: [], adult: false };
  }
}
export const writeLimits = (l: Limits) => localStorage.setItem(KEY, JSON.stringify(l));
export const usedToday = (l: Limits, now = Date.now()) => l.log.filter((t) => now - t < 86_400_000).length;
export function recordPurchase() {
  const l = readLimits();
  writeLimits({ ...l, log: [...l.log.filter((t) => Date.now() - t < 86_400_000), Date.now()] });
}

const LABELS = "imd-picks:labels";
export const rememberLabel = (id: string, label: string) => {
  const m = JSON.parse(localStorage.getItem(LABELS) ?? "{}") as Record<string, string>;
  m[id] = label;
  localStorage.setItem(LABELS, JSON.stringify(m));
};
export const labelFor = (id: string): string | undefined => (JSON.parse(localStorage.getItem(LABELS) ?? "{}") as Record<string, string>)[id];
