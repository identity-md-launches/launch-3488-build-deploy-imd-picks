import { createPublicClient, createWalletClient, custom, encodeAbiParameters, fallback, http, keccak256, type Address, type EIP1193Provider, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { PUBLIC_RPCS, IMD_TOKEN } from "./config.ts";
import { erc20Abi, picksAbi } from "./abi.ts";

export const publicClient = createPublicClient({ chain: mainnet, transport: fallback(PUBLIC_RPCS.map((u) => http(u))) });

export const walletClientFor = (provider: EIP1193Provider, account: Address) =>
  createWalletClient({ chain: mainnet, transport: custom(provider), account });

/** Same as IMDPicks.eventKeyOf: keccak256(abi.encode(uint8, uint64, uint64)). */
export const eventKeyOf = (league: number, eventId: string, competitionId: string): Hex =>
  keccak256(encodeAbiParameters([{ type: "uint8" }, { type: "uint64" }, { type: "uint64" }], [league, BigInt(eventId), BigInt(competitionId)]));

export type Purchase = {
  id: Hex; buyer: Address; paidAt: number; status: number; league: number;
  eventId: string; competitionId: string; eventKey: Hex; resultHash: Hex; uri: string;
};

export async function readPurchase(contract: Address, id: Hex): Promise<Purchase> {
  const p = await publicClient.readContract({ address: contract, abi: picksAbi, functionName: "purchase", args: [id] });
  return { id, buyer: p.buyer, paidAt: Number(p.paidAt), status: p.status, league: p.league, eventId: p.eventId.toString(), competitionId: p.competitionId.toString(), eventKey: p.eventKey, resultHash: p.resultHash, uri: p.uri };
}

export async function readBuyer(contract: Address, who: Address, key?: Hex) {
  const [balance, allowance, excluded, slots, prior] = await Promise.all([
    publicClient.readContract({ address: IMD_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [who] }),
    publicClient.readContract({ address: IMD_TOKEN, abi: erc20Abi, functionName: "allowance", args: [who, contract] }),
    publicClient.readContract({ address: contract, abi: picksAbi, functionName: "excludedUntil", args: [who] }),
    publicClient.readContract({ address: contract, abi: picksAbi, functionName: "openSlots" }),
    key ? publicClient.readContract({ address: contract, abi: picksAbi, functionName: "requestOf", args: [who, key] }) : Promise.resolve(("0x" + "0".repeat(64)) as Hex),
  ]);
  return { balance, allowance, excludedUntil: Number(excluded), slots, prior };
}

export const ZERO32 = ("0x" + "0".repeat(64)) as Hex;
