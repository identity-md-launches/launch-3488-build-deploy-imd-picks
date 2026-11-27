import type { Address } from "viem";

export const SITE_NAME = "IMD Picks";
export const SITE_URL = "https://imd-picks.imd.site/";
export const SITE_DESCRIPTION = "Swarm-researched betting analysis for 1 IMD.";

/** Ethereum mainnet only. */
export const CHAIN_ID = 1;
export const CHAIN_NAME = "Ethereum";
/** The original IMD token, verified on imd.fun/docs and onchain: name "Identity.md", symbol IMD, 18 decimals. */
export const IMD_TOKEN: Address = "0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7";
/** IMD Intake v2: sells job.open for 0.5 IMD (GET api.imd.fun/requests/capabilities). */
export const IMD_INTAKE: Address = "0xa43e6F75ee006411F79Ac1C84120606C2330DE82";
export const CREATOR_WALLET: Address = "0x83027AD9d0D5374335086c539dADD1db983441B0";
export const IMD_API = "https://api.imd.fun";

export const PUBLIC_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
];

/** Gas measured by the contract tests (buy on a mainnet fork against the real Intake). */
export const GAS = { approve: 46_000n, buy: 432_000n, claimRefund: 45_000n, selfExclude: 46_000n };

export const PRICE_WEI = 10n ** 18n;

export type Deployment = { address: Address | null; deployBlock: number | null };

/** Owner-settable after deployment: dist/deployment.json, read at runtime, so no rebuild is needed. */
export async function loadDeployment(): Promise<Deployment> {
  try {
    const r = await fetch("./deployment.json", { cache: "no-store" });
    if (!r.ok) return { address: null, deployBlock: null };
    const j = (await r.json()) as { address?: string | null; deployBlock?: number | null };
    const ok = typeof j.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(j.address);
    return { address: ok ? (j.address as Address) : null, deployBlock: j.deployBlock ?? null };
  } catch {
    return { address: null, deployBlock: null };
  }
}
