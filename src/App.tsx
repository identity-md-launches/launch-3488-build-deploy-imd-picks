import { useEffect, useState } from "react";
import { BuyPanel } from "./components/BuyPanel.tsx";
import { ConnectSheet } from "./components/ConnectSheet.tsx";
import { Dashboard } from "./components/Dashboard.tsx";
import { Events } from "./components/Events.tsx";
import { PlaySafe } from "./components/PlaySafe.tsx";
import { TrackRecord } from "./components/TrackRecord.tsx";
import { CREATOR_WALLET, IMD_TOKEN, loadDeployment, type Deployment } from "./lib/config.ts";
import type { Matchup } from "./lib/espn.ts";
import { short } from "./lib/format.ts";
import { startDiscovery } from "./lib/wallet.ts";

const ROUTES = [
  { hash: "#/", label: "Events" },
  { hash: "#/picks", label: "My picks" },
  { hash: "#/record", label: "Track record" },
  { hash: "#/safe", label: "Play safe" },
] as const;

const useHash = () => {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => { const f = () => setH(location.hash || "#/"); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
};

export function App() {
  const hash = useHash();
  const [deployment, setDeployment] = useState<Deployment>({ address: null, deployBlock: null });
  const [picked, setPicked] = useState<Matchup | null>(null);
  useEffect(() => { startDiscovery(); void loadDeployment().then(setDeployment); }, []);
  const route = ROUTES.find((r) => r.hash === hash)?.hash ?? "#/";

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <a className="brand" href="#/" aria-label="IMD Picks home">
          <img src="./favicon.svg" width={28} height={28} alt="" />
          <span>IMD Picks</span>
        </a>
        <nav aria-label="Main" className="nav">
          {ROUTES.map((r) => <a key={r.hash} href={r.hash} aria-current={route === r.hash ? "page" : undefined}>{r.label}</a>)}
        </nav>
        <ConnectSheet />
      </header>
      <main id="main" className="wrap">
        {route === "#/" && (
          <>
            <div className="intro">
              <h1>Researched picks, 1 IMD each</h1>
              <p className="lede">Choose an upcoming game, fight or match. The IMD Swarm researches it and returns a pick with probabilities, expected value and risk.</p>
            </div>
            <Events onPick={setPicked} />
          </>
        )}
        {route === "#/picks" && <><h1 className="page-h">My picks</h1><Dashboard deployment={deployment} /></>}
        {route === "#/record" && <TrackRecord deployment={deployment} />}
        {route === "#/safe" && <PlaySafe deployment={deployment} />}
      </main>
      <footer className="foot wrap">
        <p>Analysis only. No winnings are guaranteed. 18+ or the legal age where you live. Help: 1-800-GAMBLER.</p>
        <p>Payments in the original <a href={`https://etherscan.io/token/${IMD_TOKEN}`} target="_blank" rel="noreferrer">IMD token</a> on Ethereum. Creator wallet <a href={`https://etherscan.io/address/${CREATOR_WALLET}`} target="_blank" rel="noreferrer">{short(CREATOR_WALLET)}</a>.{deployment.address ? <> Contract <a href={`https://etherscan.io/address/${deployment.address}`} target="_blank" rel="noreferrer">{short(deployment.address)}</a>.</> : " Contract not deployed yet."}</p>
      </footer>
      {picked && <BuyPanel m={picked} deployment={deployment} onClose={() => setPicked(null)} onBought={() => { setPicked(null); location.hash = "#/picks"; }} />}
    </>
  );
}
