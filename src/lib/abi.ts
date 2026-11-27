export const picksAbi = [
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "league", type: "uint8" }, { name: "eventId", type: "uint64" }, { name: "competitionId", type: "uint64" }, { name: "label", type: "string" }], outputs: [{ name: "requestId", type: "bytes32" }] },
  { type: "function", name: "claimRefund", stateMutability: "nonpayable", inputs: [{ name: "requestId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "selfExclude", stateMutability: "nonpayable", inputs: [{ name: "duration", type: "uint64" }], outputs: [] },
  { type: "function", name: "requestOf", stateMutability: "view", inputs: [{ name: "buyer", type: "address" }, { name: "eventKey", type: "bytes32" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "excludedUntil", stateMutability: "view", inputs: [{ name: "buyer", type: "address" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "openSlots", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "purchaseCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "purchaseIds", stateMutability: "view", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ type: "bytes32[]" }] },
  { type: "function", name: "purchasesOf", stateMutability: "view", inputs: [{ name: "buyer", type: "address" }], outputs: [{ type: "bytes32[]" }] },
  { type: "function", name: "eventKeyOf", stateMutability: "pure", inputs: [{ name: "league", type: "uint8" }, { name: "eventId", type: "uint64" }, { name: "competitionId", type: "uint64" }], outputs: [{ type: "bytes32" }] },
  {
    type: "function", name: "purchase", stateMutability: "view", inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [{ type: "tuple", components: [
      { name: "buyer", type: "address" }, { name: "paidAt", type: "uint64" }, { name: "status", type: "uint8" }, { name: "league", type: "uint8" },
      { name: "eventId", type: "uint64" }, { name: "competitionId", type: "uint64" }, { name: "eventKey", type: "bytes32" },
      { name: "resultHash", type: "bytes32" }, { name: "uri", type: "string" },
    ] }],
  },
  { type: "event", name: "Purchased", inputs: [
    { name: "buyer", type: "address", indexed: true }, { name: "requestId", type: "bytes32", indexed: true }, { name: "eventKey", type: "bytes32", indexed: true },
    { name: "league", type: "uint8", indexed: false }, { name: "eventId", type: "uint64", indexed: false }, { name: "competitionId", type: "uint64", indexed: false }, { name: "label", type: "string", indexed: false },
  ] },
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const STATUS = ["None", "Pending", "Delivered", "Failed", "Refunded"] as const;
export const RESULT_TIMEOUT_S = 14 * 86_400;
