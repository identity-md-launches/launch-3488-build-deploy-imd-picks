import { LEAGUES, type League } from "./leagues.ts";

export const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

export type Competitor = { name: string; short: string; logo?: string; homeAway?: string; winner?: boolean };
export type Matchup = {
  key: string;
  league: League;
  eventId: string;
  competitionId: string;
  title: string;
  label: string;
  start: string;
  state: "pre" | "in" | "post";
  completed: boolean;
  competitors: Competitor[];
  venue?: string;
  odds?: string;
};

type Json = Record<string, any>;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");

export function dateRange(from: Date, days: number) {
  const to = new Date(from.getTime() + days * 86_400_000);
  return `${ymd(from)}-${ymd(to)}`;
}

/** Only ASCII letters, digits, space and . , ' & - ( ) / : survive, which is what the contract accepts. */
export function safeLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,'&\-()/:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function competitor(c: Json): Competitor {
  const name: string = c.team?.displayName ?? c.athlete?.displayName ?? c.athlete?.fullName ?? c.displayName ?? "TBD";
  const short: string = c.team?.abbreviation ?? c.athlete?.shortName ?? name;
  const logo: string | undefined = c.team?.logo ?? c.athlete?.flag?.href;
  return { name, short, logo, homeAway: c.homeAway, winner: c.winner === true };
}

/** Flattens an ESPN scoreboard into one matchup per competition: a game, a bout on a card, a tennis match. */
export function normalizeScoreboard(json: Json, league: League): Matchup[] {
  const out: Matchup[] = [];
  for (const ev of (json.events ?? []) as Json[]) {
    const comps: Json[] = [
      ...((ev.competitions ?? []) as Json[]),
      ...((ev.groupings ?? []) as Json[]).flatMap((g) => (g.competitions ?? []) as Json[]),
    ];
    for (const comp of comps) {
      const cs = ((comp.competitors ?? []) as Json[]).map(competitor);
      if (cs.length < 2 || cs.some((c) => c.name === "TBD")) continue;
      const ordered = league.teams ? [...cs].sort((a) => (a.homeAway === "away" ? -1 : 1)) : cs;
      const label = safeLabel(league.teams ? `${ordered[0].name} at ${ordered[1].name}` : `${ordered[0].name} vs ${ordered[1].name}`);
      const type = comp.status?.type ?? ev.status?.type ?? {};
      out.push({
        key: `${league.id}:${ev.id}:${comp.id ?? ev.id}`,
        league,
        eventId: String(ev.id),
        competitionId: String(comp.id ?? ev.id),
        title: league.teams ? league.name : String(ev.name ?? ev.shortName ?? league.name),
        label,
        start: String(comp.date ?? comp.startDate ?? ev.date),
        state: (type.state ?? "pre") as Matchup["state"],
        completed: type.completed === true,
        competitors: ordered,
        venue: comp.venue?.fullName ?? ev.venue?.fullName ?? undefined,
        odds: comp.odds?.[0]?.details ?? undefined,
      });
    }
  }
  return out;
}

async function board(league: League, dates: string, signal?: AbortSignal): Promise<Matchup[] | null> {
  const r = await fetch(`${ESPN}/${league.path}/scoreboard?dates=${dates}&limit=300`, { signal });
  if (r.status === 400) return null; // this league's calendar is daily: no ranges
  if (!r.ok) throw new Error(`ESPN ${league.name}: ${r.status}`);
  return normalizeScoreboard(await r.json(), league);
}

/** Tries one ranged request; leagues with a daily calendar refuse ranges, so they are read a day at a time. */
export async function fetchUpcoming(league: League, now = new Date(), days = 7, signal?: AbortSignal): Promise<Matchup[]> {
  let all = await board(league, dateRange(now, days), signal);
  if (!all) {
    const perDay = await Promise.all(
      Array.from({ length: days }, (_, i) => board(league, ymd(new Date(now.getTime() + i * 86_400_000)), signal).then((x) => x ?? [])),
    );
    all = perDay.flat();
  }
  const seen = new Set<string>();
  return all
    .filter((m) => m.state === "pre" && new Date(m.start).getTime() > now.getTime() && !seen.has(m.key) && (seen.add(m.key), true))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function fetchAllUpcoming(signal?: AbortSignal) {
  const settled = await Promise.allSettled(LEAGUES.map((l) => fetchUpcoming(l, new Date(), l.teams ? 7 : 30, signal)));
  const events: Matchup[] = [];
  const failed: string[] = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? events.push(...s.value) : failed.push(LEAGUES[i].name)));
  return { events: events.sort((a, b) => a.start.localeCompare(b.start)), failed };
}

/** The final state of one competition, for grading. Looks on the scoreboard of the day it was played. */
export async function fetchFinal(league: League, eventId: string, competitionId: string, start?: string): Promise<Matchup | null> {
  const day = start ? new Date(start) : new Date();
  const from = new Date(day.getTime() - 86_400_000);
  const days = await Promise.all([0, 1, 2].map((i) => board(league, ymd(new Date(from.getTime() + i * 86_400_000))).catch(() => null)));
  const all = days.flatMap((d) => d ?? []);
  return all.find((m) => m.eventId === eventId && m.competitionId === competitionId) ?? null;
}
