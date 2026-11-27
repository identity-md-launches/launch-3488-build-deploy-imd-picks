import { useEffect, useState } from "react";
import { decodeEventLog, formatEther, type Address, type Hex } from "viem";
import { picksAbi, erc20Abi } from "../lib/abi.ts";
import { eventKeyOf, publicClient, readBuyer, walletClientFor, ZERO32 } from "../lib/chain.ts";
import { CHAIN_ID, GAS, IMD_TOKEN, PRICE_WEI, type Deployment } from "../lib/config.ts";
import type { Matchup } from "../lib/espn.ts";
import { errText, imd, when } from "../lib/format.ts";
import { readLimits, recordPurchase, rememberLabel, usedToday, writeLimits } from "../lib/limits.ts";
import { activeProvider, useWallet } from "../lib/wallet.ts";

type Buyer = Awaited<ReturnType<typeof readBuyer>>;

export function BuyPanel({ m, deployment, onClose, onBought }: { m: Matchup; deployment: Deployment; onClose: () => void; onBought: () => void }) {
  const { address, chainId } = useWallet();
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [adult, setAdult] = useState(readLimits().adult);
  const [busy, setBusy] = useState<"approve" | "buy" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const contract = deployment.address;
  const key = eventKeyOf(m.league.id, m.eventId, m.competitionId);

  const refresh = async () => {
    if (!contract || !address) return setBuyer(null);
    try { setBuyer(await readBuyer(contract, address, key)); } catch (e) { setMsg(errText(e)); }
  };
  useEffect(() => { void refresh(); }, [contract, address, key]);
  useEffect(() => { publicClient.getGasPrice().then(setGasPrice).catch(() => setGasPrice(null)); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const limits = readLimits();
  const overLimit = usedToday(limits) >= limits.dailyMax;
  const owned = buyer && buyer.prior !== ZERO32;
  const excluded = buyer && buyer.excludedUntil * 1000 > Date.now();
  const blocker = !contract ? "Payments open once the IMD Picks contract is deployed on Ethereum. Browsing stays free."
    : !address ? "Connect a wallet to buy this pick."
    : chainId !== CHAIN_ID ? "Switch your wallet to Ethereum."
    : !buyer ? "Reading your wallet…"
    : owned ? null
    : excluded ? `Your wallet is self-excluded until ${new Date(buyer.excludedUntil * 1000).toLocaleDateString()}.`
    : buyer.slots === 0n ? "The refund reserve is full right now, so new purchases are paused until open analyses finish."
    : buyer.balance < PRICE_WEI ? `You hold ${imd(buyer.balance)}. A pick costs 1 IMD.`
    : overLimit ? `You reached your limit of ${limits.dailyMax} picks in 24 hours. Change it under Play safe.`
    : !adult ? "Confirm you are of legal age where you live." : null;

  const eth = (g: bigint) => (gasPrice ? `≈ ${Number(formatEther(g * gasPrice)).toFixed(5)} ETH` : "");
  const needsApprove = buyer ? buyer.allowance < PRICE_WEI : true;

  async function approve() {
    const p = activeProvider();
    if (!p || !address || !contract) return;
    setBusy("approve"); setMsg(null);
    try {
      const hash = await walletClientFor(p, address).writeContract({ address: IMD_TOKEN, abi: erc20Abi, functionName: "approve", args: [contract, PRICE_WEI] });
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (e) { setMsg(errText(e)); } finally { setBusy(null); }
  }

  async function buy() {
    const p = activeProvider();
    if (!p || !address || !contract) return;
    setBusy("buy"); setMsg(null);
    try {
      const hash = await walletClientFor(p, address).writeContract({ address: contract as Address, abi: picksAbi, functionName: "buy", args: [m.league.id, BigInt(m.eventId), BigInt(m.competitionId), m.label] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The purchase transaction reverted. Nothing was charged.");
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: picksAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "Purchased") rememberLabel(ev.args.requestId as Hex, `${m.league.name}: ${m.label}`);
        } catch { /* other contracts' logs */ }
      }
      recordPurchase();
      onBought();
    } catch (e) { setMsg(errText(e)); } finally { setBusy(null); }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet wide" role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2 id="buy-title">{m.label}</h2><button className="x" aria-label="Close" autoFocus onClick={onClose}>×</button></div>
        <p className="muted">{m.league.name} · {when(m.start)}{m.venue ? ` · ${m.venue}` : ""}{m.odds ? ` · Line ${m.odds}` : ""}</p>
        <ul className="facts">
          <li><b>What you get.</b> IMD Swarm agents research statistics, injuries, form, the matchup, odds, weather and news, then deliver a pick, win probabilities, expected value, reasoning and a risk rating.</li>
          <li><b>Price.</b> Exactly 1 IMD: 0.5 IMD pays the Swarm job, 0.5 IMD goes to the creator wallet. No other fee.</li>
          <li><b>Refunds.</b> If the Swarm fails, or no result arrives within 14 days, you can claim the full 1 IMD back from the funded reserve.</li>
          <li><b>Gas.</b> Approve about {GAS.approve.toLocaleString()} gas {eth(GAS.approve)}, then buy about {GAS.buy.toLocaleString()} gas {eth(GAS.buy)}, paid in ETH to the network.</li>
          <li><b>Timing.</b> Results arrive when the Swarm finishes, usually within hours. Buy well before the start.</li>
        </ul>
        {owned ? (
          <div className="callout ok">You already bought this pick. It is in My picks and you will not be charged again.</div>
        ) : (
          <>
            <label className="check">
              <input type="checkbox" checked={adult} onChange={(e) => { setAdult(e.target.checked); writeLimits({ ...readLimits(), adult: e.target.checked }); }} />
              <span>I am of legal age to bet where I live, and I understand no winnings are guaranteed.</span>
            </label>
            {blocker && <p className="note" role="status">{blocker}</p>}
            {msg && <p className="note err" role="alert">{msg}</p>}
            <div className="actions">
              {needsApprove ? (
                <button className="btn primary" disabled={!!blocker || busy !== null} onClick={() => void approve()}>{busy === "approve" ? "Approving 1 IMD…" : "Step 1: approve 1 IMD"}</button>
              ) : (
                <button className="btn primary" disabled={!!blocker || busy !== null} onClick={() => void buy()}>{busy === "buy" ? "Confirm in wallet…" : "Pay 1 IMD and request"}</button>
              )}
              {owned === false && !needsApprove && <span className="fine">1 IMD approved for this contract.</span>}
            </div>
          </>
        )}
        {owned && <div className="actions"><button className="btn primary" onClick={onBought}>Open My picks</button></div>}
      </div>
    </div>
  );
}
