# Tournament Hub — Frontend / Backend Integration Guide

`ICTournamentHub` is a standalone upgradeable satellite contract for user-created
tournaments. It holds its own token balances and state, and delegates
roles (admin / moderator / blacklist / approved tokens / pause / min donation)
to the main IC proxy. **The IC proxy is not modified.**

- Contract: `contracts/ICTournamentHub.sol`
- Deploy: `npx hardhat run scripts/deploy_tournament_proxy.js --network baseMainnet`
- Deployment info is saved to `tournament-hub-deployment-info.json`

## On-chain rules (enforced by the contract)

| Rule | Enforcement |
|---|---|
| One token per tournament (USDC, MATCH, ...) | Fixed at creation; must be on IC's `approvedTokens` list |
| Entry fee: free or priced | `entryFee` (0 = free), pulled into the pot on join |
| Max entrants (optional) | `maxEntrants` (0 = unlimited); joins revert when full |
| Payout split | Percentages summing to 100, set at creation, immutable |
| Creator may play in their own tournament | Creation itself charges no entry fee; if the creator wants to play they call `joinTournament` and pay the entry fee like any other participant (changed by the 2026-08-19 upgrade — originally creators were rejected) |
| One join per wallet | `isParticipant` mapping; double joins revert |
| Leave while OPEN = entry fee back | `leaveTournament`; blocked once LIVE |
| Tournament match whitelist | `startBracketMatch` / `joinBracketMatch` revert for non-participants of that tournament ID |
| 2.5% platform fee at completion | Bracket matches move no money. `completeTournament` takes 2.5% of the **full pot** (entry fees + seed + donations + admin allocations) and sends it to the IC multisig, then pays the remaining 97.5% to winners per the split. No per-player "pay platform fee" button. |
| No per-match donations | No donate function exists for bracket matches; only `donateToTournament` (whole tournament) |
| Not disputable | Only IC admins/moderators can `completeTournament`; cancel + pull-based refunds is the only escape hatch |
| Admin-only fund allocation | `fundTournament` requires IC admin |
| Admin ban/kick per tournament | `banParticipant(id, wallet)` — admin only, works while OPEN or LIVE. Kicks the wallet, bans it from rejoining, and locks it out of all bracket matches. Entry fee: refunded if the tournament is still OPEN, **forfeited to the pot if LIVE**. `unbanParticipant` reverses mistakes (forfeits are not auto-returned). If a tournament with forfeits is cancelled, the admin recovers them with `withdrawForfeitedFees(id, to)`; on completion they simply go to the winners. Use IC's blacklist for platform-wide bans |
| Gasless | EIP-2771 via the existing `InsertCoinForwarder`; all participant flows work relayed |

## Rules that are YOUR job (frontend / backend — not the contract)

1. **Discord-to-wallet whitelist.** The chain cannot know two wallets belong to
   one person. The contract enforces one join per *wallet*; the backend must
   enforce one *wallet* per Discord account: bind the wallet at signup and
   refuse to link or match-make any other wallet for that account. This also
   covers "creator signs out and rejoins with another wallet". When the backend
   detects a duplicate wallet that already joined on-chain, an admin removes it
   surgically with `banParticipant(tournamentId, wallet)`.
2. **Only show tournaments that exist on-chain.** List tournaments by indexing
   `TournamentCreated` events. Never render drafts or pending transactions as
   tournaments.
3. **Game / platform names.** The contract stores only `gameId` (same numeric
   IDs used for IC's `gamePools`). The id → "Street Fighter 6 / PS5" mapping
   lives in the app.
4. **Player records.** Index `BracketMatchClosed(tournamentId, matchId, winner, loser)`
   and credit wins/losses the same way you consume `MatchClosed` for regular
   matches.
5. **Sponsor links (future).** Rank donors per tournament from
   `TournamentDonation` events (or read `tournamentDonations(id, wallet)`), and
   render the biggest donors' links on the tournament page.
6. **Relayer allow-list.** Add the hub proxy address to
   `RELAY_ALLOWED_TARGETS` so gasless tournament calls are sponsored. Keep the
   IC proxy in the list for regular matches.

## Admin panel flow (close a tournament)

The "pick 1st/2nd/3rd from joined players and submit" flow is one call:

1. Populate the player dropdowns from `TournamentJoined`/`TournamentLeft`/`ParticipantBanned` events (or check `isParticipant`).
2. Submit calls `completeTournament(tournamentId, [first, second, third])`.
   - Winner array order must match the payout split order set at creation.
   - Every winner must be a joined participant; duplicates revert.
   - One transaction: takes 2.5% of the pot for the platform, then pays the rest per the split.

To close a tournament that is still OPEN (never went LIVE): `cancelTournament(id)`.
IMPORTANT — refunds after a cancel are **pull-based**, the contract does not
push tokens to every player (unbounded loops are a gas bomb). The tournament
page must show a "Claim refund" button on cancelled tournaments:
- participants call `claimEntryRefund(id)`
- donors / pot seeder / admin funders call `claimContributionRefund(id)`
- if players were banned while LIVE, admin recovers forfeits with `withdrawForfeitedFees(id, to)`

## Tournament matches: on-chain is optional

`completeTournament` does not depend on bracket matches. Two supported modes:

- **On-chain results**: players call `startBracketMatch`/`joinBracketMatch`
  (gasless via the forwarder), moderator calls `closeBracketMatch`. Gives an
  immutable result trail and `BracketMatchClosed` events for player records.
- **Off-chain (Discord-run) matches**: create/join/close matches purely in the
  bot + database with no transactions, and only call `completeTournament` at
  the end. Nothing on-chain breaks.

Single matches and tournament matches can never mix in the UI: they come from
different contract addresses with different event signatures (IC emits
`MatchStarted`/`MatchClosed`; the hub emits `BracketMatch*`).

## Lifecycle

```
createTournament (anyone, 1 tx, optional pot seed)
        |
      OPEN   <-- joinTournament / leaveTournament (fee refunded)
        |        donateToTournament / fundTournament (admin)
startTournament (creator or admin; needs >= 3 players and >= 1 per payout slot)
        |
      LIVE   <-- no leaving; bracket matches start/join/close
        |        donateToTournament / fundTournament still allowed
        +--> completeTournament (moderator/admin) --> COMPLETED (2.5% platform fee, rest paid out)
        +--> cancelTournament (admin; creator only while OPEN) --> CANCELLED
                  participants: claimEntryRefund
                  seeder/donors/admin funders: claimContributionRefund
```

Payout example: pot 90 USDC, split [60, 30, 10] → 54 / 27 / 9. Rounding dust
(from integer division) is added to first place so the full pot always leaves.

## Funding a tournament from IC match fees

The IC contract keeps accruing 2.5% match fees into `gamePools[gameId][token]`
exactly as before. To route those fees into a tournament pot:

1. `IC.allocateGamePool(gameId, token, tournamentId, amount)` — admin, bookkeeping
2. `IC.withdrawTournamentPool(tournamentId, token, amount, adminWallet)` — multisig
3. `token.approve(hubProxy, amount)` then `hub.fundTournament(tournamentId, amount)` — admin

Use the hub's `tournamentId` in step 1/2 so IC's event trail and the hub's pot
stay reconcilable.

## Events to index

| Event | Use |
|---|---|
| `TournamentCreated(id, creator, token, gameId, entryFee, maxEntrants, payoutSplit, seedAmount, name, description)` | Tournament list + detail page (name/description are event-only, not stored) |
| `TournamentJoined(id, participant)` / `TournamentLeft(id, participant, refund)` | Entrant list, capacity display |
| `TournamentStarted(id, startedBy)` | Flip UI to LIVE; hide leave button |
| `TournamentDonation(id, donor, amount)` | Pot display, sponsor ranking |
| `TournamentFundedByAdmin(id, admin, amount)` | Pot display |
| `TournamentCompleted(id, winners, payouts)` | Results page |
| `TournamentCancelled(id, by)` | Show claim-refund buttons |
| `EntryRefundClaimed` / `ContributionRefundClaimed` | Claim status |
| `ParticipantBanned(id, wallet, admin, wasParticipant, refund)` / `ParticipantUnbanned(id, wallet, admin)` | Entrant list, moderation audit trail |
| `EntryFeeForfeited(id, wallet, amount)` / `ForfeitedFeesWithdrawn(id, to, amount)` | Forfeit audit trail (LIVE bans) |
| `BracketMatchStarted` / `BracketMatchJoined` | Bracket UI |
| `BracketMatchClosed(id, matchId, winner, loser)` | Bracket progression + player records |
| `BracketMatchCancelled(id, matchId, by)` | Void a bracket slot |

## Key views

- `tournaments(id)` — creator, token, gameId, entryFee, maxEntrants, entrantCount, potBalance, status, createdAt
- `getPayoutSplit(id)`, `getPotBalance(id)`
- `isParticipant(id, wallet)` — gate the "join tournament match" button (the contract enforces it anyway)
- `isBanned(id, wallet)` — hide join/match buttons for banned wallets
- `bracketMatches(matchId)` — tournamentId, players, winner, open/closed
- `tournamentDonations(id, wallet)`, `contributions(id, wallet)`

## Gasless notes

Same EIP-2771 flow as IC: frontend signs a `ForwardRequest`
(domain name `MinimalForwarder`, version `0.0.1`, the forwarder as
`verifyingContract`) and the relayer calls `forwarder.execute`. Remember that
`MinimalForwarder.execute` does **not** revert when the inner call reverts — it
returns `success = false`, so the relayer must check the return value before
reporting success to the user. Entry fees still move the player's own tokens,
so the usual ERC-20 `approve` for the hub proxy is required first (this
approval is the one transaction that cannot be relayed for standard ERC-20s).
