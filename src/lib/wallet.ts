import { useSyncExternalStore } from "react";
import { getAddress, type Address, type EIP1193Provider } from "viem";
import { CHAIN_ID, SITE_NAME } from "./config.ts";
import { WALLET_ICONS, iconUrl } from "./wallet-icons.ts";

/** One row in the connect sheet: an EIP-6963 extension, a bare window.ethereum, or Coinbase Smart Wallet. */
export type WalletOption = { id: string; name: string; icon?: string; kind: "injected" | "coinbase"; provider?: EIP1193Provider };

type State = { options: WalletOption[]; address: Address | null; chainId: number | null; walletId: string | null; pending: string | null; error: string | null };

let state: State = { options: [], address: null, chainId: null, walletId: null, pending: null, error: null };
const listeners = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
let active: EIP1193Provider | null = null;
const STORE = "imd-picks:wallet";

type Announce = CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }>;

function rebuild(found: Map<string, WalletOption>) {
  const named = [...found.values()];
  const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  const injected: WalletOption[] = named.length ? named : eth ? [{ id: "injected", name: "Browser wallet", kind: "injected", provider: eth }] : [];
  set({ options: [...injected, { id: "coinbaseWalletSDK", name: "Coinbase Wallet", icon: iconUrl(WALLET_ICONS.coinbase), kind: "coinbase" }] });
}

let started = false;
export function startDiscovery() {
  if (started || typeof window === "undefined") return;
  started = true;
  const found = new Map<string, WalletOption>();
  window.addEventListener("eip6963:announceProvider", ((e: Announce) => {
    const { info, provider } = e.detail;
    found.set(info.rdns || info.uuid, { id: info.rdns || info.uuid, name: info.name, icon: info.icon, kind: "injected", provider });
    rebuild(found);
    void tryReconnect();
  }) as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  rebuild(found);
  setTimeout(() => void tryReconnect(), 400);
}

async function coinbaseProvider(): Promise<EIP1193Provider> {
  const { createCoinbaseWalletSDK } = await import("@coinbase/wallet-sdk");
  const sdk = createCoinbaseWalletSDK({ appName: SITE_NAME, appLogoUrl: new URL("./favicon.svg", location.href).href, appChainIds: [CHAIN_ID] });
  return sdk.getProvider() as unknown as EIP1193Provider;
}

function attach(p: EIP1193Provider, id: string) {
  active = p;
  const onAccounts = (a: unknown) => {
    const list = a as string[];
    if (!list?.length) disconnect();
    else set({ address: getAddress(list[0]) });
  };
  const onChain = (c: unknown) => set({ chainId: Number(c as string) });
  p.on?.("accountsChanged", onAccounts as never);
  p.on?.("chainChanged", onChain as never);
  localStorage.setItem(STORE, id);
}

async function readChain(p: EIP1193Provider) {
  return Number(await p.request({ method: "eth_chainId" }));
}

let reconnecting = false;
async function tryReconnect() {
  const id = localStorage.getItem(STORE);
  if (!id || state.address || reconnecting) return;
  const opt = state.options.find((o) => o.id === id);
  if (!opt || opt.kind !== "injected" || !opt.provider) return;
  reconnecting = true;
  try {
    const accounts = (await opt.provider.request({ method: "eth_accounts" })) as string[];
    if (accounts?.length) {
      attach(opt.provider, id);
      set({ address: getAddress(accounts[0]), chainId: await readChain(opt.provider), walletId: id });
    }
  } catch { /* stays disconnected */ } finally { reconnecting = false; }
}

export async function connect(opt: WalletOption) {
  set({ pending: opt.id, error: null });
  try {
    const p = opt.kind === "coinbase" ? await coinbaseProvider() : opt.provider!;
    const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
    attach(p, opt.id);
    set({ address: getAddress(accounts[0]), chainId: await readChain(p), walletId: opt.id, pending: null });
  } catch (e) {
    const msg = (e as { code?: number }).code === 4001 ? "Request declined in the wallet." : "The wallet did not connect. Try again.";
    set({ pending: null, error: msg });
  }
}

export function disconnect() {
  localStorage.removeItem(STORE);
  active = null;
  set({ address: null, chainId: null, walletId: null });
}

export async function switchToMainnet() {
  if (!active) return;
  try {
    await active.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
  } catch (e) {
    if ((e as { code?: number }).code === 4902) {
      await active.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: "0x1", chainName: "Ethereum", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://ethereum-rpc.publicnode.com"], blockExplorerUrls: ["https://etherscan.io"] }],
      });
    }
  }
  set({ chainId: await readChain(active) });
}

export const activeProvider = () => active;
export const clearError = () => set({ error: null });

export function useWallet() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
