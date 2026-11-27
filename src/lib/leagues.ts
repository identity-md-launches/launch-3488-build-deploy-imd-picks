/** Index = the contract's league id (IMDPicks.leagueOf). Keep both in the same order. */
export type League = { id: number; sport: Sport; name: string; path: string; teams: boolean };
export type Sport = "UFC" | "NHL" | "NFL" | "NBA" | "MLB" | "Soccer" | "Tennis";

export const LEAGUES: League[] = [
  { id: 0, sport: "UFC", name: "UFC", path: "mma/ufc", teams: false },
  { id: 1, sport: "NHL", name: "NHL", path: "hockey/nhl", teams: true },
  { id: 2, sport: "NFL", name: "NFL", path: "football/nfl", teams: true },
  { id: 3, sport: "NBA", name: "NBA", path: "basketball/nba", teams: true },
  { id: 4, sport: "MLB", name: "MLB", path: "baseball/mlb", teams: true },
  { id: 5, sport: "Soccer", name: "Premier League", path: "soccer/eng.1", teams: true },
  { id: 6, sport: "Soccer", name: "LaLiga", path: "soccer/esp.1", teams: true },
  { id: 7, sport: "Soccer", name: "UEFA Champions League", path: "soccer/uefa.champions", teams: true },
  { id: 8, sport: "Soccer", name: "MLS", path: "soccer/usa.1", teams: true },
  { id: 9, sport: "Tennis", name: "ATP tennis", path: "tennis/atp", teams: false },
  { id: 10, sport: "Tennis", name: "WTA tennis", path: "tennis/wta", teams: false },
];

export const SPORTS: Sport[] = ["UFC", "NHL", "NFL", "NBA", "MLB", "Soccer", "Tennis"];
