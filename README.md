# IMD Picks

Sports betting analysis bought with the original IMD token and produced by the real IMD Swarm.
Browse upcoming UFC, NHL, NFL, NBA, MLB, soccer (Premier League, LaLiga, Champions League, MLS) and
ATP/WTA tennis events for free; pay exactly 1 IMD and the Swarm researches one event and returns a
pick, win probabilities, expected value, reasoning and a risk rating. Target domain:
`imd-picks.imd.site`.

## Status: what works and what is blocked

| Part | State |
| --- | --- |
| Website (static export in `dist/`) | Built and committed. Events load live from ESPN. |
| Payment contract `contracts/src/IMDPicks.sol` | Written, unit-tested, fork-tested against the real IMD Intake on Ethereum mainnet. **Not deployed.** |
| Swarm integration | Real: the contract pays the IMD Intake v2 `job.open@job-1` with 0.5 IMD and the Intake calls back with the result hash and URI. |
| Payments in the live site | **Closed until the contract is deployed** and its address is written into `dist/deployment.json`. |

**Blocker: mainnet deployment.** Deploying needs a funded Ethereum account. This build had none,
and it must not borrow one, so the contract is deploy-ready but not deployed. Payments stay closed
until it is. The site says so in the purchase panel instead of faking a payment. To go live:

```sh
cd contracts
forge script script/Deploy.s.sol --rpc-url https://ethereum-rpc.publicnode.com --account <your-keystore> --broadcast
# then fund the refund reserve (the creator or anyone): approve the contract for N IMD and call fundReserve(N * 1e18)
```

Write the address and its deploy block into `dist/deployment.json` (and `public/deployment.json`
for future builds). The site reads it at runtime, so no rebuild is needed.

## How payment and analysis work

1. The visitor connects a wallet (MetaMask and Rabby appear by name through EIP-6963; phones get
   "Open in" links; Coinbase Smart Wallet is also offered) on Ethereum mainnet, chain 1.
2. They pick an event. Browsing is free and needs no wallet.
3. They approve the contract for exactly 1 IMD, then call `buy(league, eventId, competitionId, label)`.
4. In that one transaction the contract pulls 1 IMD, sends 0.5 IMD to the creator wallet
   `0x83027AD9d0D5374335086c539dADD1db983441B0`, and pays 0.5 IMD to the IMD Intake
   (`0xa43e6F75ee006411F79Ac1C84120606C2330DE82`) for a `job.open` research job. The contract builds
   the job body itself from a fixed template, so nobody can buy a different job through it.
5. Swarm agents research statistics, injuries, form, the matchup, odds, weather and news, and write
   `artifacts/pick.json` and `artifacts/analysis.md`.
6. The Intake calls `onResult(requestId, resultHash, uri)`. The dashboard fetches `result.json`,
   checks its keccak-256 against the onchain hash, and shows the pick to the wallet that paid.
7. **My picks** reads `purchasesOf(wallet)` from the contract, so purchases are saved per wallet.
   `buy` reverts with `AlreadyPurchased` for an event the wallet already bought, so it is never
   charged twice.

**Verified 0.5 IMD funds each analysis.** `GET https://api.imd.fun/requests/capabilities` lists
Ethereum (chain 1) `job.open@job-1` at `intakePrice` 500000000000000000 (0.5 IMD) in IMD
`0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7`. The mainnet-fork test runs `buy` against the real
Intake: the buyer pays 1 IMD, the creator gets +0.5 IMD, the Intake treasury gets +0.5 IMD, and a
request id comes back. The exact body the contract emits passed `POST /requests/check` with
`blockers: []` and `suggestions: []` (kind `report`, skill `research-report`).

**IMD token verification.** The address comes from imd.fun/docs ("Get $IMD" and the contract table).
Onchain it reads `name()` "Identity.md", `symbol()` "IMD", `decimals()` 18. No new token is created.

**Refunds (funded).** If the Intake reports a failure, or no result arrives within 14 days, the
buyer calls `claimRefund` and gets the full 1 IMD from the refund reserve held in the contract.
`buy` only accepts a purchase while the reserve covers every open purchase plus the new one, so
every refund is funded before the money is taken. The creator may withdraw only reserve above
those liabilities.

**Gas, disclosed in the purchase panel with a live ETH estimate.** Measured with
`forge test --gas-report` and the fork test: approve about 46,000 gas, `buy` about 432,000 gas
(it carries the ~1.9 KB job body), `claimRefund` about 45,000, `selfExclude` about 46,000. Gas is
paid in ETH to the network. There are no other fees.

**No backdoors.** The contract has no owner, no pause, no upgrade and no fee switch. The token,
Intake, creator and prices are immutable. The only privileged call is the creator's
`withdrawSurplus`, which cannot touch reserve that open purchases need.

**Access control, and its limit.** There is no separate server: the contract is the backend.
Entitlement is `purchase(requestId).buyer`, and the dashboard reveals an analysis only to the
connected wallet that bought it. Two limits are stated plainly. The IMD plane publishes job results
publicly (`/jobs/:id/result` is a public route), so someone who finds the job id can read it. And a
static export cannot hide data from a determined visitor. The track record only shows picks after
their event has finished.

**Track record.** The Track record view grades every delivered pick against ESPN's final score
(moneyline: win, loss or no bet; profit at the pick's American odds). It counts only results whose
hash matches the onchain hash. With no deployment yet, it shows zero graded picks and says why.

**Responsible gambling.** Age and no-guarantee confirmation before paying. A daily purchase limit
in the browser (default 3 per 24 hours). Onchain self-exclusion (`selfExclude`): a wallet can lock
itself out of purchases for 1 day to 1 year, and it can never be shortened. Helplines are listed
(1-800-GAMBLER, the UK National Gambling Helpline, gamblingtherapy.org). The site never promises
winnings.

## Install, preview, rebuild

```sh
npm ci                 # Node 20+; installs viem, @coinbase/wallet-sdk, React, Vite, TypeScript
npm run dev            # local dev server
npm run build          # tsc --noEmit, then vite build into dist/ (base ./, relative asset URLs)
npm run preview        # serve dist/ locally
npm test               # logic tests (node --test, built-in TypeScript type stripping)
npm run test:live      # same, plus a live ESPN request
cd contracts && forge test                                   # contract unit tests
FORK_RPC=https://ethereum-rpc.publicnode.com forge test      # adds the mainnet-fork test
```

`dist/` is committed: the host serves it as is and does not rebuild. Routes are hash routes
(`#/`, `#/picks`, `#/record`, `#/safe`), so the site works at any gateway subpath.

## Layout

- `src/lib/config.ts`: addresses, chain, public RPCs, gas figures, runtime `deployment.json` loader
- `src/lib/wallet.ts`, `open-in.ts`, `wallet-icons.ts`, `components/ConnectSheet.tsx`: wallets
- `src/lib/espn.ts`, `leagues.ts`: events from ESPN's public scoreboard API (no key)
- `src/lib/chain.ts`, `abi.ts`: contract reads and writes through viem
- `src/lib/results.ts`: result fetch, hash check, grading
- `src/components/`: Events, BuyPanel, Dashboard (My picks), TrackRecord, PlaySafe
- `contracts/`: Foundry project (`src/IMDPicks.sol`, `test/`, `script/Deploy.s.sol`, `AUDIT.md`)

## Validation record (this build)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | Passed, 0 errors |
| Production build | `npm run build` | Passed (Vite 7.3.8): index.html 1.35 kB, JS 568 kB + 102 kB lazy Coinbase chunk, CSS 9.7 kB; `dist/` about 0.7 MB |
| Logic tests | `LIVE=1 node --test --test-reporter=tap tests/*.test.ts` | 8 passed, 0 failed (league order matches the contract; ESPN normalising for games, UFC cards and tennis groupings; label sanitising; event key equals `IMDPicks.eventKeyOf`; grading; URI resolution; live ESPN returned 55 upcoming NBA games) |
| Live event load | `fetchAllUpcoming()` in Node | NHL 49, NBA 55, NFL 12, Premier League 19, LaLiga 11, MLS 16, WTA 1. UFC, MLB, Champions League and ATP had none in the window on 2026-11-27 (MLB and ATP are in their offseason); the site shows an empty-state line for them |
| Contract unit tests | `forge test` | 11 passed: exact 1 IMD split, duplicate purchase revert, reserve coverage, delivery and dashboard list, callbacks only from the Intake, failure refund, timeout refund with the late result ignored, surplus-only withdrawal, self-exclusion, label and league validation, body size |
| Mainnet-fork test | `FORK_RPC=… forge test --match-contract Fork` | Passed against the real IMD token and Intake v2 at block about 26,509,300 |
| Swarm body check | `POST https://api.imd.fun/requests/check` with the contract's own `bodyOf(...)` output | `blockers: []`, `suggestions: []` |
| Design probe | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | **Did not run.** Playwright is not installed, and Chromium (about 300 MB) does not fit: the disk had about 260 MB free. No screenshots exist, and no rendered claim is made |
| Browser interaction | none | **Not performed** (no browser on this machine). Clicking through the wallet sheet, the purchase panel, filters and search was not exercised in a browser; their logic is covered only by typecheck and the tests above |

### Better Interface review (pinned guide, without-a-browser checks)

Coverage: all six domains (accessibility, layout, writing, typography, colors, UI), source-level.
Every "with a browser" check is **Not verified**: the tab order, the accessibility tree, 200% zoom,
RTL, rendered contrast, wrapping at real widths and motion replay.

Findings and fixes:

- Accessibility, `src/components/ConnectSheet.tsx:37` and `src/components/BuyPanel.tsx:86`: dialogs did not move focus. Fixed with `autoFocus` on the close button. Escape and backdrop close both sheets. Still no focus trap (open).
- Accessibility, `src/components/Events.tsx:51`: an `aria-label` replaced the event button's visible text, which breaks label-in-name. Removed, so the button's accessible name is its visible content.
- Layout, `src/styles.css` (`.skip`, `.brand`, `.get`, `.facts`, `.nav`): physical left/right properties. Replaced with logical `inset-inline-start`, `margin-inline-*` and `padding-inline-start`; none remain.
- Layout, `src/styles.css` `.filters`: the sticky filter bar used a guessed `top: 104px` under a wrapping mobile header. It is now sticky only at 900px and up, where the header is one 56px row.
- Typography: one scale of five sizes (13, 15, 17, 22, 28px). Headings descend h1 28 > h2 22 > h3 17. Body line-height 1.5, headings 1.2, measure capped at 52 to 70ch. Long team names get ellipsis truncation. Letter-spacing is only -0.02em on h1. No tracked caps, no eyebrows.
- Colors, from the declared token pairs: text on bg 16.32:1, muted on surface-2 6.61:1 (the lowest pair), accent-ink on accent 14.84:1, warn/bad/ok on surface-2 10.38, 7.08 and 10.29:1. All pass WCAG AA. Only a dark theme is declared (`color-scheme: dark`). This is deliberate and recorded, not a defect.
- Writing: no em dashes or emoji in UI copy. Directions sit beside their controls (the approve and pay steps, the age checkbox). The hero is a five-word headline plus one plain line.
- UI states: buttons, chips, wallet rows and event rows define rest, hover, active, `:focus-visible` and disabled states. Loading, empty and error states exist for events, My picks and Track record. Transitions name their properties (no `transition: all`), last 0.1 to 0.15s, and are disabled under `prefers-reduced-motion`.

### Known limitations

- Contract not deployed (see Blocker). Payments, My picks, Track record and self-exclusion activate once `deployment.json` has an address.
- wagmi was not used. The disk had too little room for its connector dependencies (MetaMask SDK, WalletConnect, Safe). The connect sheet follows the network's wallet guide (EIP-6963 discovery, "Open in" links on phones, Coinbase Smart Wallet, Switch to Ethereum, short address with Disconnect) on top of viem and `@coinbase/wallet-sdk` directly.
- Rabby publishes no documented dapp link, so its phone row opens rabby.io. The MetaMask, Rabby and Phantom row marks are simplified drawings, not the vendor files.
- `og.png` is a generated brand mark (dark field, lime "P"), not a designed card. `og:image` uses the absolute domain URL so link previews resolve.
- Result latency is the Swarm's: minutes to days. After 14 days with no result, the buyer can take a refund.
- ESPN's public API is unofficial and can change; a league that fails to load is named on the page.
