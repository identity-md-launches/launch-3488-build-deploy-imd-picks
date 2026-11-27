import { keccak256, type Hex } from "viem";
import { IMD_API } from "./config.ts";

export type Pick = {
  eventId?: string | number; competitionId?: string | number; league?: string; matchup?: string;
  market?: string; selection?: string; americanOdds?: number; probabilities?: Record<string, number>;
  expectedValue?: number; risk?: string; confidence?: number; summary?: string;
  factors?: Record<string, string>; sources?: string[];
};
export type ResultFile = { name: string; path: string; url?: string; hash?: string; mediaType?: string };
export type Delivered = { verified: boolean; jobId?: string; pick: Pick | null; analysis: string | null; files: ResultFile[] };

/** ipfs://CID/result.json through public gateways; a plane path through api.imd.fun. */
export function resolveUri(uri: string): string[] {
  if (uri.startsWith("ipfs://")) {
    const rest = uri.slice(7);
    return [`https://ipfs.io/ipfs/${rest}`, `https://dweb.link/ipfs/${rest}`, `https://cloudflare-ipfs.com/ipfs/${rest}`];
  }
  if (uri.startsWith("/")) return [`${IMD_API}${uri}`];
  return [uri];
}

async function firstOk(urls: string[]): Promise<Uint8Array> {
  let last: unknown = new Error("no URL");
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
      last = new Error(`${u}: ${r.status}`);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Fetches result.json, checks its keccak-256 against the hash the Intake wrote onchain, then the named files. */
export async function fetchDelivered(uri: string, resultHash: Hex): Promise<Delivered> {
  const bytes = await firstOk(resolveUri(uri));
  const verified = keccak256(bytes).toLowerCase() === resultHash.toLowerCase();
  const result = JSON.parse(new TextDecoder().decode(bytes)) as { jobId?: string; files?: ResultFile[] };
  const files = result.files ?? [];
  const get = async (name: string) => {
    const f = files.find((x) => x.name === name || x.path?.endsWith(`/${name}.json`) || x.path?.endsWith(`/${name}.md`));
    if (!f) return null;
    const url = f.url ?? (result.jobId ? `${IMD_API}/jobs/${result.jobId}/result` : null);
    if (!url) return null;
    return new TextDecoder().decode(await firstOk([url]));
  };
  const [pickText, analysis] = await Promise.all([get("pick").catch(() => null), get("analysis").catch(() => null)]);
  let pick: Pick | null = null;
  try {
    pick = pickText ? (JSON.parse(pickText) as Pick) : null;
  } catch {
    pick = null;
  }
  return { verified, jobId: result.jobId, pick, analysis, files };
}

export type Outcome = "win" | "loss" | "no-bet" | "open";

/** Moneyline grading against the final result. Profit is per 1 unit at the pick's American odds. */
export function grade(pick: Pick, final: { completed: boolean; competitors: { name: string; winner?: boolean }[] } | null): { outcome: Outcome; profit: number } {
  const sel = (pick.selection ?? "").trim().toLowerCase();
  if (!sel || sel === "no bet") return { outcome: "no-bet", profit: 0 };
  if (!final || !final.completed) return { outcome: "open", profit: 0 };
  const winner = final.competitors.find((c) => c.winner);
  const won = winner ? winner.name.toLowerCase() === sel : sel === "draw";
  const o = Number(pick.americanOdds);
  const payout = Number.isFinite(o) && o !== 0 ? (o > 0 ? o / 100 : 100 / Math.abs(o)) : 1;
  return won ? { outcome: "win", profit: payout } : { outcome: "loss", profit: -1 };
}

export function summarize(outcomes: { outcome: Outcome; profit: number }[]) {
  const graded = outcomes.filter((o) => o.outcome === "win" || o.outcome === "loss");
  const wins = graded.filter((o) => o.outcome === "win").length;
  const profit = graded.reduce((s, o) => s + o.profit, 0);
  return { graded: graded.length, wins, losses: graded.length - wins, hitRate: graded.length ? wins / graded.length : null, roi: graded.length ? profit / graded.length : null, profit };
}
