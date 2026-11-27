# IMD Picks: design

Taken from the final source: `src/styles.css`, `src/App.tsx` and `src/components/*`.

## Direction

Clean, premium, dark: a near-black field, quiet slate surfaces and one lime accent used only for
the primary action, links and the recommended selection. Content comes first: the event list and
its "Get pick · 1 IMD" action appear on the first screen, under a five-word headline and one plain
line.

## Tokens (`:root` in src/styles.css)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0b0f14` | page |
| `--surface` | `#121821` | cards, event rows, sheets, inputs |
| `--surface-2` | `#19212c` | selected nav, wallet rows, notes, badges |
| `--line` | `#263140` | 1px borders, header rule |
| `--text` | `#e8edf2` | body text, focus ring |
| `--muted` | `#9aa7b4` | metadata, secondary copy |
| `--accent` | `#c6f24e` | primary buttons, links, recommended pick, probability bars |
| `--accent-ink` | `#0b0f14` | text on accent |
| `--ok` / `--warn` / `--bad` | `#7ee2a8` / `#ffc56b` / `#ff8a7a` | delivered, pending or notes, failed or errors |

Contrast from the declared pairs: text/bg 16.32:1; muted/surface-2 6.61:1 (the lowest); accent-ink/accent
14.84:1; status colors on surface-2 at least 7.08:1. Single dark theme, `color-scheme: dark`.

Spacing: `--s1` to `--s7` = 4, 8, 12, 16, 24, 32, 48px. Radii: `--r-sm` 10px (buttons, inputs,
rows), `--r-md` 14px (cards, sheets), `--r-pill` 999px (chips, nav, badges).

## Typography

The system UI stack (`ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, …`); no web font
is downloaded. One scale of five sizes: `--t-xs` 13px (metadata, fine print, badges), `--t-sm`
15px (body, buttons), `--t-md` 17px (h3, brand), `--t-lg` 22px (h2, the recommended selection, big
numbers), `--t-xl` 28px (h1, letter-spacing -0.02em). Weights 400, 500 and 600/650. Line-height 1.5
for body, 1.2 for headings. `text-wrap: balance` on headings, `pretty` on paragraphs. Numbers use
tabular figures.

## Components

- **Header** (`.top`): sticky, blurred translucent bg, brand mark plus name, hash-route nav
  (Events, My picks, Track record, Play safe) and the one connect control. Under 900px the nav
  wraps into a horizontally scrollable second row.
- **Connect control and sheet** (`ConnectSheet`): "Connect" opens a dialog listing EIP-6963 wallets
  by name and icon, then Coinbase Wallet. On phones: "Open in MetaMask / Coinbase Wallet / Rabby /
  Phantom", then Coinbase Smart Wallet. Rows are 48px with a 28px mark, and the × button is 32px.
  It closes on Escape, the backdrop or the ×. Once connected, it shows the short address with
  Disconnect; on the wrong chain, "Switch to Ethereum".
- **Buttons** (`.btn.primary`, `.btn.ghost`, `.small`): at least 44px tall (36px small); hover,
  active (1px press), `:focus-visible` 2px ring and disabled at 50%.
- **Sport chips** (`.chip`, `aria-pressed`): All plus seven sports with live counts; scroll
  horizontally on narrow screens. The selected chip inverts (text color fill).
- **Search** (`.search`): a 44px input with a visually hidden label.
- **Event row** (`.event-btn`): one button per game, bout or match. League and time, both
  competitors with logos (names truncate with ellipsis), the ESPN line, and the "Get pick · 1 IMD"
  action. Rows are grouped under day labels.
- **Purchase panel** (`BuyPanel`): a sheet with what you get, the exact split, the refund rule, gas
  with a live ETH estimate, the age and no-guarantee checkbox, a one-line blocker note, then
  "Step 1: approve 1 IMD" and "Pay 1 IMD and request". If the wallet already owns the pick, it shows
  a callout and "Open My picks".
- **Pick card** (`Dashboard` `.card`): status badge (Swarm working, Delivered, Analysis failed,
  Refunded); the verified-hash line; recommendation, market and odds; EV, risk and confidence
  numbers; probability bars; summary; factors list; collapsible full reasoning; and the refund
  action when one is available.
- **Track record**: graded count, hit rate and return per unit, plus a ledger of graded picks.
- **Play safe**: helplines, the daily limit select and onchain self-exclusion.
- **Notes and callouts** (`.note`, `.note.err`, `.callout.ok`): one-line status text with
  `role=status` or `role=alert`.

## Responsive behavior

- **Under 640px:** a single column. Sheets are bottom sheets (rounded top, up to 92vh, scroll inside).
  Event rows stack meta, teams and then the action. The filter bar scrolls with the page.
- **640px and up:** sheets are centered dialogs, 420px wide (560px for the purchase panel). Event
  rows become a three-column grid (meta, teams, action). Search sits beside the chips.
- **900px and up:** the nav moves into the header row, the teams sit side by side, the intro gets
  more space, and the filter bar sticks under the 56px header.
- Content max width is 1080px with 16px gutters. All spacing uses logical properties.
- Under `prefers-reduced-motion` every transition is off. Transitions are limited to background,
  border and transform, at 0.1 to 0.15s.

## Not verified

No browser or Playwright was available: the rendered layout at 320, 390 and 1440px, wrapping, zoom
and the screenshots of the design probe were not observed.
