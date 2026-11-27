import { formatEther } from "viem";

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const imd = (v: bigint) => `${Number(formatEther(v)).toLocaleString(undefined, { maximumFractionDigits: 3 })} IMD`;
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
export const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const dayKey = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
export const errText = (e: unknown) => {
  const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? String(e);
  return /reject|denied|4001/i.test(m) ? "Request declined in the wallet." : m.split("\n")[0].slice(0, 180);
};
