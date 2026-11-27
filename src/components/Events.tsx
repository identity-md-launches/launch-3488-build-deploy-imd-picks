import { useEffect, useMemo, useState } from "react";
import { fetchAllUpcoming, type Matchup } from "../lib/espn.ts";
import { SPORTS, type Sport } from "../lib/leagues.ts";
import { dayKey } from "../lib/format.ts";

export function Events({ onPick }: { onPick: (m: Matchup) => void }) {
  const [events, setEvents] = useState<Matchup[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sport, setSport] = useState<Sport | "All">("All");
  const [q, setQ] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    fetchAllUpcoming(ac.signal).then((r) => { setEvents(r.events); setFailed(r.failed); }).catch((e) => !ac.signal.aborted && setError(String(e)));
    return () => ac.abort();
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (events ?? []).filter((m) => (sport === "All" || m.league.sport === sport) && (!needle || `${m.label} ${m.title} ${m.league.name}`.toLowerCase().includes(needle))).slice(0, 120);
  }, [events, sport, q]);
  const counts = useMemo(() => Object.fromEntries(SPORTS.map((s) => [s, (events ?? []).filter((m) => m.league.sport === s).length])), [events]);

  let lastDay = "";
  return (
    <section aria-label="Upcoming events">
      <div className="filters">
        <div className="chips" role="group" aria-label="Sport">
          {(["All", ...SPORTS] as const).map((s) => (
            <button key={s} className="chip" aria-pressed={sport === s} onClick={() => setSport(s)}>
              {s}{events && s !== "All" ? <span className="count"> {counts[s]}</span> : null}
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr">Search teams or fighters</span>
          <input type="search" placeholder="Search teams, fighters, players" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {error && <p className="note err">Events could not load: {error}</p>}
      {!events && !error && <p className="muted pad" role="status">Loading upcoming events…</p>}
      {events && shown.length === 0 && <p className="muted pad">No upcoming {sport === "All" ? "" : `${sport} `}events{q ? " match that search" : " on the schedule right now"}. Team sports show the next 7 days, UFC and tennis the next 30.</p>}
      <ol className="events">
        {shown.map((m) => {
          const d = dayKey(m.start);
          const head = d !== lastDay ? ((lastDay = d), <li key={`d-${d}`} className="day" aria-hidden="true">{d}</li>) : null;
          return [
            head,
            <li key={m.key} className="event">
              <button className="event-btn" onClick={() => onPick(m)}>
                <span className="meta">{m.league.name}{m.league.teams ? "" : ` · ${m.title}`} · {new Date(m.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                <span className="teams">
                  {m.competitors.map((c) => (
                    <span key={c.name} className="team">
                      {c.logo ? <img src={c.logo} alt="" width={24} height={24} loading="lazy" /> : <span className="dot" aria-hidden="true" />}
                      <span className="tname">{c.name}</span>
                    </span>
                  ))}
                </span>
                <span className="side">
                  {m.odds && <span className="odds">{m.odds}</span>}
                  <span className="get">Get pick · 1 IMD</span>
                </span>
              </button>
            </li>,
          ];
        })}
      </ol>
      {failed.length > 0 && <p className="fine pad">Not loaded right now: {failed.join(", ")}.</p>}
      <p className="fine pad">Schedules and lines from ESPN's public scoreboard. Browsing is free.</p>
    </section>
  );
}
