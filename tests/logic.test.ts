// Run: npm test  (node --test with built-in TypeScript type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeScoreboard, safeLabel, fetchUpcoming } from "../src/lib/espn.ts";
import { LEAGUES } from "../src/lib/leagues.ts";
import { grade, summarize, resolveUri } from "../src/lib/results.ts";
import { eventKeyOf } from "../src/lib/chain.ts";

const nba = LEAGUES[3], ufc = LEAGUES[0], atp = LEAGUES[9];
const team = (n: string, ha: string, extra = {}) => ({ homeAway: ha, team: { displayName: n, abbreviation: n.slice(0, 3).toUpperCase(), logo: "x.png" }, ...extra });

test("league table matches the contract order", () => {
  assert.deepEqual(LEAGUES.map((l) => l.path), ["mma/ufc", "hockey/nhl", "football/nfl", "basketball/nba", "baseball/mlb", "soccer/eng.1", "soccer/esp.1", "soccer/uefa.champions", "soccer/usa.1", "tennis/atp", "tennis/wta"]);
});

test("team game becomes one 'away at home' matchup", () => {
  const m = normalizeScoreboard({ events: [{ id: "401", date: "2030-01-01T00:00Z", status: { type: { state: "pre" } }, competitions: [{ id: "401", competitors: [team("New York Knicks", "home"), team("Boston Celtics", "away")], odds: [{ details: "NY -3.5" }] }] }] }, nba);
  assert.equal(m.length, 1);
  assert.equal(m[0].label, "Boston Celtics at New York Knicks");
  assert.equal(m[0].odds, "NY -3.5");
});

test("a UFC card yields one matchup per bout; tennis groupings are read", () => {
  const ath = (n: string) => ({ athlete: { displayName: n } });
  const card = normalizeScoreboard({ events: [{ id: "600", name: "UFC 330", date: "2030-01-01T00:00Z", competitions: [{ id: "1", competitors: [ath("José Aldo"), ath("B Fighter")] }, { id: "2", competitors: [ath("C"), ath("D")] }] }] }, ufc);
  assert.equal(card.length, 2);
  assert.equal(card[0].label, "Jose Aldo vs B Fighter");
  assert.equal(card[0].title, "UFC 330");
  const t = normalizeScoreboard({ events: [{ id: "9", groupings: [{ competitions: [{ id: "77", date: "2030-01-01T00:00Z", competitors: [ath("A"), ath("B")] }] }] }] }, atp);
  assert.equal(t[0].competitionId, "77");
});

test("labels only keep characters the contract accepts", () => {
  assert.equal(safeLabel('Atlético "Madrid" vs Brøndby!'), "Atletico Madrid vs Br ndby");
  assert.ok(safeLabel("x".repeat(300)).length <= 120);
  assert.match(safeLabel("Saint-Étienne (W) / Paris: 1.0, O'Neil & Co"), /^[A-Za-z0-9 .,'&\-()/:]+$/);
});

test("event key equals IMDPicks.eventKeyOf", () => {
  assert.equal(eventKeyOf(3, "401810001", "401810001"), "0x9783dab66e75a440ba9ca777626c1e2d94316f9fce19ee7a122967c24c9fa8c7");
});

test("grading: wins at American odds, losses, no bet, open events", () => {
  const fin = { completed: true, competitors: [{ name: "A", winner: true }, { name: "B" }] };
  assert.deepEqual(grade({ selection: "A", americanOdds: 150 }, fin), { outcome: "win", profit: 1.5 });
  assert.deepEqual(grade({ selection: "A", americanOdds: -200 }, fin), { outcome: "win", profit: 0.5 });
  assert.deepEqual(grade({ selection: "B", americanOdds: 120 }, fin), { outcome: "loss", profit: -1 });
  assert.equal(grade({ selection: "No bet" }, fin).outcome, "no-bet");
  assert.equal(grade({ selection: "A" }, { completed: false, competitors: [] }).outcome, "open");
  assert.equal(grade({ selection: "Draw", americanOdds: 250 }, { completed: true, competitors: [{ name: "A" }, { name: "B" }] }).outcome, "win");
  const s = summarize([{ outcome: "win", profit: 1.5 }, { outcome: "loss", profit: -1 }, { outcome: "no-bet", profit: 0 }]);
  assert.equal(s.graded, 2); assert.equal(s.hitRate, 0.5); assert.equal(s.roi, 0.25);
});

test("result URIs resolve to gateways or the plane", () => {
  assert.equal(resolveUri("ipfs://bafy/result.json")[0], "https://ipfs.io/ipfs/bafy/result.json");
  assert.equal(resolveUri("/intake-results/1")[0], "https://api.imd.fun/intake-results/1");
});

test("live: ESPN returns upcoming NBA games in the next 7 days", { skip: !process.env.LIVE }, async () => {
  const m = await fetchUpcoming(nba);
  assert.ok(m.length > 0, "no NBA games found");
  assert.ok(m.every((x) => x.state === "pre" && /^[A-Za-z0-9 .,'&\-()/:]+$/.test(x.label)));
  console.log("NBA upcoming:", m.length, "first:", m[0].label, m[0].start);
});
