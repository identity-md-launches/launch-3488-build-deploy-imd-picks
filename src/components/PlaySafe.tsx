import { useEffect, useState } from "react";
import { picksAbi } from "../lib/abi.ts";
import { publicClient, walletClientFor } from "../lib/chain.ts";
import { CHAIN_ID, type Deployment } from "../lib/config.ts";
import { errText } from "../lib/format.ts";
import { readLimits, usedToday, writeLimits } from "../lib/limits.ts";
import { activeProvider, useWallet } from "../lib/wallet.ts";

const PERIODS = [{ d: 1, t: "24 hours" }, { d: 7, t: "7 days" }, { d: 30, t: "30 days" }, { d: 365, t: "1 year" }];

export function PlaySafe({ deployment }: { deployment: Deployment }) {
  const { address, chainId } = useWallet();
  const [limits, setLimits] = useState(readLimits());
  const [until, setUntil] = useState<number | null>(null);
  const [days, setDays] = useState(7);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const contract = deployment.address;

  useEffect(() => {
    if (!contract || !address) return;
    publicClient.readContract({ address: contract, abi: picksAbi, functionName: "excludedUntil", args: [address] }).then((v) => setUntil(Number(v))).catch(() => setUntil(null));
  }, [contract, address, busy]);

  async function exclude() {
    const p = activeProvider();
    if (!p || !address || !contract) return;
    setBusy(true); setMsg(null);
    try {
      const hash = await walletClientFor(p, address).writeContract({ address: contract, abi: picksAbi, functionName: "selfExclude", args: [BigInt(days * 86_400)] });
      await publicClient.waitForTransactionReceipt({ hash });
      setMsg("Done. This wallet cannot buy picks until the period ends, and it cannot be shortened.");
    } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  }

  return (
    <section className="stack">
      <div className="card">
        <h2>Play safe</h2>
        <p>IMD Picks sells research, not bets, and it never guarantees winnings. Sports are uncertain: even a strong edge loses often. Bet only money you can afford to lose, and only where betting is legal for you.</p>
        <ul className="facts">
          <li>United States: call or text 1-800-GAMBLER, or visit <a href="https://www.ncpgambling.org/help-treatment/" target="_blank" rel="noreferrer">ncpgambling.org</a>.</li>
          <li>United Kingdom: National Gambling Helpline 0808 8020 133, or <a href="https://www.begambleaware.org/" target="_blank" rel="noreferrer">begambleaware.org</a>.</li>
          <li>Elsewhere: <a href="https://www.gamblingtherapy.org/" target="_blank" rel="noreferrer">gamblingtherapy.org</a> offers free support in many languages.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Daily limit</h2>
        <p className="muted">The most picks this browser will let you buy in 24 hours. Used now: {usedToday(limits)}.</p>
        <label className="field">
          <span>Picks per 24 hours</span>
          <select value={limits.dailyMax} onChange={(e) => { const l = { ...limits, dailyMax: Number(e.target.value) }; setLimits(l); writeLimits(l); }}>
            {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="card">
        <h2>Take a break</h2>
        <p className="muted">Self-exclusion is enforced by the contract on Ethereum for this wallet. Once set it cannot be shortened, by you or anyone.</p>
        {until !== null && until * 1000 > Date.now() && <p className="callout ok">This wallet is excluded until {new Date(until * 1000).toLocaleString()}.</p>}
        <label className="field">
          <span>Exclude this wallet for</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>{PERIODS.map((p) => <option key={p.d} value={p.d}>{p.t}</option>)}</select>
        </label>
        <div className="actions">
          <button className="btn primary" disabled={!contract || !address || chainId !== CHAIN_ID || busy} onClick={() => void exclude()}>{busy ? "Confirm in wallet…" : "Exclude this wallet"}</button>
          {!contract ? <span className="fine">Available once the contract is deployed.</span> : !address ? <span className="fine">Connect the wallet to exclude.</span> : null}
        </div>
        {msg && <p className="note" role="status">{msg}</p>}
      </div>
    </section>
  );
}
