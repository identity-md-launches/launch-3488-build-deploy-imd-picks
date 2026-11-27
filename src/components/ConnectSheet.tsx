import { useEffect, useState } from "react";
import { CHAIN_ID, CHAIN_NAME } from "../lib/config.ts";
import { short } from "../lib/format.ts";
import { OPEN_IN, isMobileBrowser } from "../lib/open-in.ts";
import { WALLET_ICONS, iconUrl } from "../lib/wallet-icons.ts";
import { clearError, connect, disconnect, switchToMainnet, useWallet } from "../lib/wallet.ts";

/** The one connect control: EIP-6963 wallets by name, "Open in" links on a phone, then Coinbase Wallet. */
export function ConnectSheet() {
  const mobile = isMobileBrowser();
  const { options, address, chainId, pending, error } = useWallet();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => { if (address) setOpen(false); }, [address]);

  if (address && chainId !== CHAIN_ID) return <button className="btn primary" onClick={() => void switchToMainnet()}>Switch to {CHAIN_NAME}</button>;
  if (address)
    return (
      <div className="acct">
        <button className="btn ghost" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>{short(address)}</button>
        {menu && <button className="btn ghost small" onClick={() => { setMenu(false); disconnect(); }}>Disconnect</button>}
      </div>
    );
  const listed = options.filter((o) => !mobile || o.kind !== "injected");
  return (
    <>
      <button className="btn primary" onClick={() => { clearError(); setOpen(true); }}>Connect</button>
      {open && (
        <div className="sheet-bg" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Connect a wallet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><h2>Connect a wallet</h2><button className="x" aria-label="Close" autoFocus onClick={() => setOpen(false)}>×</button></div>
            {mobile && OPEN_IN.map((w) => (
              <a key={w.id} className="row" href={w.href(location.href)}>
                <span className="ic"><img width={28} height={28} src={iconUrl(WALLET_ICONS[w.id] ?? WALLET_ICONS.coinbase)} alt="" /></span>
                <span>Open in {w.name}</span>
              </a>
            ))}
            {listed.map((o) => (
              <button key={o.id} className="row" onClick={() => void connect(o)} disabled={pending !== null}>
                <span className="ic">{o.icon ? <img width={28} height={28} src={o.icon} alt="" /> : <img width={28} height={28} src={iconUrl(WALLET_ICONS.metamask)} alt="" />}</span>
                <span>{o.kind === "coinbase" && mobile ? "Coinbase Smart Wallet" : o.name}{pending === o.id ? " · opening…" : ""}</span>
              </button>
            ))}
            {error && <p className="note" role="status">{error}</p>}
            <p className="fine">MetaMask and Rabby appear here by name when installed. No account or relay needed.</p>
          </div>
        </div>
      )}
    </>
  );
}
