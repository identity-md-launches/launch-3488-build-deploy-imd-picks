# IMDPicks self-review

Scope: `src/IMDPicks.sol` (solc 0.8.28, optimizer 2000 runs). Method: line-by-line review against
the IMD Intake v2 documentation (api.imd.fun docs, "Pay onchain"), 11 unit tests, and one
mainnet-fork test against the real IMD token and Intake. This is the builder's own review, not an
independent audit.

## Properties checked

- Payment is exactly 1 IMD: `transferFrom` of `PRICE`, `transfer` of 0.5 to the immutable creator,
  `approve` of 0.5 to the Intake, which pulls it in `requestWithFailure`. The contract keeps none
  of the payment; allowance is back to 0 afterwards (test_split_is_exact, fork test).
- No duplicate charge: `requestOf[buyer][eventKey]` blocks a second buy unless the first was refunded.
- Callbacks: only `msg.sender == intake`, and only for a request this contract created that is
  still Pending; anything else returns without effect, so a late or replayed call cannot double-release.
  `onResult` and `onFailure` move no value and fit the Intake's 200,000 gas callback budget (test).
- Refunds are pull-based (`claimRefund`). `buy` requires `balance >= liabilities + PRICE`, so every
  open purchase is covered by reserve before money is taken. `withdrawSurplus` keeps `liabilities`.
- JSON body integrity: the body is built onchain from a fixed template. The label allows only
  `[A-Za-z0-9 .,'&-()/:]` and at most 120 bytes, so it cannot break out of the JSON string or
  change the skill or outputs. The league is an index into a fixed table, and the ids are integers.
- Reentrancy guard on every function that moves tokens; token calls tolerate tokens that return no bool.
- No owner, pause, upgrade or fee switch; token, Intake and creator are immutable.

## Residual risks (accepted, disclosed)

- **Trust in the IMD writer key.** The Intake's writer can withhold a result or report a false
  failure. A false failure turns into a refund to the buyer, paid from reserve. Exposure is bounded
  by the reserve the creator chooses to fund.
- **Engineered failures.** A buyer could pick an obscure event hoping the Swarm fails, then refund.
  This costs the buyer nothing, and the creator loses the 0.5 IMD Swarm fee from reserve each time.
  The ids are ESPN integers and the template is fixed, which limits this; it is not eliminated.
- **Intake versioning.** The Intake address is immutable. If IMD ships v3, v2 "stays served" per
  the docs. A new IMDPicks deployment would be needed to move.
- **Public results.** Job results are public on the IMD plane, so a paid analysis can be read by
  anyone who finds its job id.
