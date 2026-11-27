import { useEffect, useState } from "react";
import { picksAbi } from "../lib/abi.ts";
import { publicClient, readPurchase } from "../lib/chain.ts";
import type { Deployment } from "../lib/config.ts";
import { fetchFinal } from "../lib/espn.ts";
import { errText, pct, signed } from "../lib/format.ts";
import { LEAGUES } from "../lib/leagues.ts";
import { fetchDelivered, grade, summarize, type Outcome } from "../lib/results.ts";

type Row = { id: string; label: string; selection: string; outcome: Outcome; profit: number; verified: boolean };

export function TrackRecord({ deployment }: { deployment: Deployment }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contract = deployment.address;

  useEffect(() => {
    if (!contract) return;
    (async () => {
      const n = await publicClient.readContract({ address: contract, abi: picksAbi, functionName: "purchaseCount" });
      const ids = await publicClient.readContract({ address: contract, abi: picksAbi, functionName: "purchaseIds", args: [n > 200n ? n - 200n : 0n, 200n] });
      const delivered = (await Promise.all(ids.map((id) => readPurchase(contract, id)))).filter((p) => p.status === 2);
      const out: Row[] = [];
      for (const p of delivered) {
        try {
          const d = await fetchDelivered(p.uri, p.resultHash);
          if (!d.pick) continue;
          const league = LEAGUES[p.league];
          const final = await fetchFinal(league, p.eventId, p.competitionId, new Date(p.paidAt * 1000).toISOString()).catch(() => null);
          const g = grade(d.pick, final);
          if (g.outcome === "open") continue; // never reveal a pick before its event is over
          out.push({ id: p.id, label: final?.label ?? d.pick.matchup ?? `ESPN event ${p.eventId}`, selection: d.pick.selection ?? "No bet", ...g, verified: d.verified });
        } catch { /* unreadable result: left out, not counted */ }
      }
      setRows(out);
    })().catch((e) => setError(errText(e)));
  }, [contract]);

  const s = summarize(rows ?? []);
  return (
    <section className="stack">
      <div className="card">
        <h2>Track record</h2>
        <p className="muted">Every delivered pick is graded against ESPN's final result once the event ends. Only picks whose result hash matches the one written onchain by the IMD Intake are counted. Nothing is edited or removed by hand.</p>
        <dl className="nums big">
          <div><dt>Graded picks</dt><dd>{rows ? s.graded : "…"}</dd></div>
          <div><dt>Hit rate</dt><dd>{s.hitRate === null ? "n/a" : pct(s.hitRate)}</dd></div>
          <div><dt>Return per unit</dt><dd>{s.roi === null ? "n/a" : signed(s.roi)}</dd></div>
        </dl>
        {!contract && <p className="note">No contract is deployed yet, so there are no graded picks. This page fills in from Ethereum as picks settle.</p>}
        {error && <p className="note err">{error}</p>}
        <p className="fine">Past results do not predict future ones. Small samples mean little.</p>
      </div>
      {rows && rows.length > 0 && (
        <ol className="ledger">
          {rows.map((r) => (
            <li key={r.id}><span>{r.label}</span><span>{r.selection}</span><span className={`badge ${r.outcome}`}>{r.outcome === "no-bet" ? "No bet" : r.outcome === "win" ? `Won ${signed(r.profit)}` : "Lost -1.00"}</span></li>
          ))}
        </ol>
      )}
    </section>
  );
}
