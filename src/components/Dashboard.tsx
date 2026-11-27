import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { picksAbi, RESULT_TIMEOUT_S } from "../lib/abi.ts";
import { publicClient, readPurchase, walletClientFor, type Purchase } from "../lib/chain.ts";
import type { Deployment } from "../lib/config.ts";
import { errText, pct, signed } from "../lib/format.ts";
import { LEAGUES } from "../lib/leagues.ts";
import { labelFor } from "../lib/limits.ts";
import { fetchDelivered, type Delivered } from "../lib/results.ts";
import { activeProvider, useWallet } from "../lib/wallet.ts";

export function Dashboard({ deployment }: { deployment: Deployment }) {
  const { address } = useWallet();
  const [items, setItems] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const contract = deployment.address;

  const load = async () => {
    if (!contract || !address) return;
    try {
      const ids = await publicClient.readContract({ address: contract, abi: picksAbi, functionName: "purchasesOf", args: [address] });
      setItems((await Promise.all([...ids].reverse().map((id) => readPurchase(contract, id)))));
    } catch (e) { setError(errText(e)); }
  };
  useEffect(() => { setItems(null); void load(); }, [contract, address]);

  if (!contract) return <Empty title="No purchases yet" text="The IMD Picks contract is not deployed yet, so nothing can be bought. Your picks will be listed here, read from Ethereum, once it is." />;
  if (!address) return <Empty title="Connect to see your picks" text="Purchases are tied to the wallet that paid. Connect it to read them from the contract." />;
  if (error) return <p className="note err">{error}</p>;
  if (!items) return <p className="muted pad" role="status">Reading your purchases from Ethereum…</p>;
  if (!items.length) return <Empty title="No purchases yet" text="Pick an event and pay 1 IMD. The analysis is saved here and never charged again." />;
  return <div className="stack">{items.map((p) => <PickCard key={p.id} p={p} contract={contract} onChange={load} />)}</div>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty"><h2>{title}</h2><p className="muted">{text}</p></div>;
}

function PickCard({ p, contract, onChange }: { p: Purchase; contract: Hex; onChange: () => void }) {
  const { address } = useWallet();
  const [d, setD] = useState<Delivered | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const league = LEAGUES[p.league];
  const label = labelFor(p.id) ?? `${league?.name ?? "Event"} · ESPN event ${p.eventId}`;
  const late = p.status === 1 && Date.now() / 1000 > p.paidAt + RESULT_TIMEOUT_S;

  useEffect(() => {
    if (p.status !== 2 || p.buyer.toLowerCase() !== address?.toLowerCase()) return;
    fetchDelivered(p.uri, p.resultHash).then(setD).catch((e) => setErr(errText(e)));
  }, [p.id, p.status, address]);

  async function refund() {
    const prov = activeProvider();
    if (!prov || !address) return;
    setBusy(true);
    try {
      const hash = await walletClientFor(prov, address).writeContract({ address: contract, abi: picksAbi, functionName: "claimRefund", args: [p.id] });
      await publicClient.waitForTransactionReceipt({ hash });
      onChange();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  const status = ["", "Swarm working", "Delivered", "Analysis failed", "Refunded"][p.status];
  const pick = d?.pick;
  return (
    <article className="card">
      <header className="card-head">
        <h3>{label}</h3>
        <span className={`badge s${p.status}`}>{status}</span>
      </header>
      <p className="fine">Paid {new Date(p.paidAt * 1000).toLocaleString()} · request {p.id.slice(0, 10)}…</p>
      {p.status === 1 && !late && <p className="muted">Agents are researching this event. Results usually arrive within hours. After 14 days with no result you can claim a full refund.</p>}
      {(p.status === 3 || late) && (
        <div className="actions">
          <p className="muted">{late ? "No result after 14 days." : "The Swarm could not finish this analysis."} Claim the full 1 IMD back.</p>
          <button className="btn primary" disabled={busy} onClick={() => void refund()}>{busy ? "Refunding…" : "Claim 1 IMD refund"}</button>
        </div>
      )}
      {p.status === 2 && !d && !err && <p className="muted" role="status">Fetching the delivered analysis…</p>}
      {err && <p className="note err">{err}</p>}
      {d && (
        <>
          <p className="fine">{d.verified ? "Result verified: its keccak-256 matches the hash written onchain." : "Warning: the fetched result does not match the onchain hash."}{d.jobId ? <> · <a href={`https://explorer.imd.fun/jobs/${d.jobId}`} target="_blank" rel="noreferrer">Swarm job</a></> : null}</p>
          {pick ? (
            <div className="pick">
              <div className="pick-main">
                <span className="muted">Recommendation</span>
                <strong className="sel">{pick.selection ?? "No bet"}</strong>
                <span className="muted">{pick.market ?? "moneyline"}{pick.americanOdds ? ` at ${pick.americanOdds > 0 ? "+" : ""}${pick.americanOdds}` : ""}</span>
              </div>
              <dl className="nums">
                <div><dt>Expected value</dt><dd>{typeof pick.expectedValue === "number" ? `${signed(pick.expectedValue)} per unit` : "n/a"}</dd></div>
                <div><dt>Risk</dt><dd>{pick.risk ?? "n/a"}</dd></div>
                <div><dt>Confidence</dt><dd>{typeof pick.confidence === "number" ? pct(pick.confidence) : "n/a"}</dd></div>
              </dl>
              {pick.probabilities && (
                <div className="probs">
                  {Object.entries(pick.probabilities).map(([k, v]) => (
                    <div key={k} className="prob"><span>{k}</span><span className="bar"><span style={{ width: pct(Number(v)) }} /></span><span>{pct(Number(v))}</span></div>
                  ))}
                </div>
              )}
              {pick.summary && <p>{pick.summary}</p>}
              {pick.factors && <dl className="factors">{Object.entries(pick.factors).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
            </div>
          ) : <p className="muted">The Swarm delivered no structured pick; read the full analysis below.</p>}
          {d.analysis && <details><summary>Full reasoning and sources</summary><div className="prose">{d.analysis.split(/\n{2,}/).map((para, i) => <p key={i}>{para.replace(/^#+\s*/, "")}</p>)}</div></details>}
          <p className="fine">Analysis, not a guarantee. Bet only what you can afford to lose.</p>
        </>
      )}
    </article>
  );
}
