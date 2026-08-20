// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IICRoles {
    function isAdmin(address user) external view returns (bool);
    function isModerator(address user) external view returns (bool);
    function isBlacklisted(address user) external view returns (bool);
    function approvedTokens(address token) external view returns (bool);
    function paused() external view returns (bool);
    function minDonationAmount() external view returns (uint256);
}

/**
 * @title ICTournamentHub
 * @dev Standalone upgradeable satellite contract for user-created tournaments.
 *      Pattern mirrors ICMultiMatch: holds its own state and token balances,
 *      and delegates role/pause/blacklist/token-approval checks to the main
 *      IC contract so admins are managed in one place. The IC proxy is never
 *      touched.
 *
 *      Key rules:
 *      - Anyone (non-blacklisted) creates a tournament in one transaction:
 *        game, token, entry fee (0 = free), max entrants (0 = unlimited),
 *        payout split, optional pot seed. Name/description are event-only.
 *      - The creator does not automatically participate: creation charges no
 *        entry fee. They MAY join their own tournament like anyone else,
 *        paying the entry fee (multi-wallet abuse is prevented app-side via
 *        account-to-wallet binding).
 *      - Participants may leave while the tournament is OPEN and get their
 *        entry fee back. Once LIVE, no exits.
 *      - Bracket matches carry no money: no stakes, no fees, no per-match
 *        donations. Only tournament participants can start/join them. Wins
 *        are emitted as events for off-chain player records.
 *      - The pot (entry fees + seed + donations + admin allocations) is paid
 *        out per the payout split with NO platform cut.
 *      - Tournaments are not disputable; only admins/moderators complete them.
 *      - Gasless via EIP-2771 trusted forwarder (same as IC).
 */
contract ICTournamentHub is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // --- Errors ---
    error NotFound();
    error NotAuthorized();
    error IsBlacklisted();
    error IsPaused();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidToken();
    error TokenNotApproved();
    error InvalidPayoutSplit();
    error InvalidMaxEntrants();
    error NotOpen();
    error NotLive();
    error NotCancelled();
    error AlreadyJoined();
    error NotParticipant();
    error CreatorCannotJoin();
    error TournamentFull();
    error NotEnoughParticipants();
    error BelowMinDonation();
    error MatchNotOpen();
    error MatchAlreadyClosed();
    error InvalidWinner();
    error DuplicateWinner();
    error WinnersMismatch();
    error NothingToClaim();
    error AlreadyBanned();
    error NotBanned();
    error BannedFromTournament();

    // --- Types ---
    enum TournamentStatus {
        NONE,
        OPEN,
        LIVE,
        COMPLETED,
        CANCELLED
    }

    struct Tournament {
        address creator;
        IERC20 token;
        uint256 gameId;
        uint256 entryFee;      // 0 = free entry
        uint256 maxEntrants;   // 0 = unlimited
        uint256 entrantCount;
        uint256 potBalance;    // tokens held for this tournament
        TournamentStatus status;
        uint256 createdAt;
        uint8[] payoutSplit;   // percentages, sum to 100 (1st, 2nd, ...)
    }

    struct BracketMatch {
        uint256 tournamentId;
        address player1;
        address player2;
        address winner;
        bool isOpen;    // waiting for player2
        bool isClosed;
        uint256 createdAt;
    }

    // --- Storage ---
    IICRoles public icContract;

    uint256 public nextTournamentId;
    uint256 public nextBracketMatchId;

    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => BracketMatch) public bracketMatches;

    /// @notice tournamentId => wallet => joined (the creator may also join)
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    /// @notice tournamentId => wallet => entry fee refund claimed after cancel
    mapping(uint256 => mapping(address => bool)) public entryRefundClaimed;

    /// @notice tournamentId => wallet => banned by an admin (cannot join or rejoin)
    mapping(uint256 => mapping(address => bool)) public isBanned;

    /// @notice tournamentId => entry fees forfeited by players banned while LIVE.
    ///         Part of potBalance: paid to winners on completion, or withdrawable
    ///         by an admin only after a cancellation (otherwise stranded).
    mapping(uint256 => uint256) public forfeitedFees;

    /// @notice tournamentId => wallet => non-entry-fee money put in (seed,
    ///         donations, admin allocations). Refundable source of truth on cancel.
    mapping(uint256 => mapping(address => uint256)) public contributions;

    /// @notice tournamentId => wallet => donated amount (sponsor ranking)
    mapping(uint256 => mapping(address => uint256)) public tournamentDonations;

    uint256 public constant MAX_PAYOUT_WINNERS = 20;

    address private _trustedForwarder;

    // --- Events ---
    event ICContractUpdated(address indexed icContract);
    event TrustedForwarderUpdated(address indexed forwarder);

    event TournamentCreated(
        uint256 indexed tournamentId,
        address indexed creator,
        address indexed token,
        uint256 gameId,
        uint256 entryFee,
        uint256 maxEntrants,
        uint8[] payoutSplit,
        uint256 seedAmount,
        string name,
        string description
    );
    event TournamentJoined(uint256 indexed tournamentId, address indexed participant);
    event TournamentLeft(uint256 indexed tournamentId, address indexed participant, uint256 refundAmount);
    event TournamentStarted(uint256 indexed tournamentId, address indexed startedBy);
    event TournamentCompleted(uint256 indexed tournamentId, address[] winners, uint256[] payouts);
    event TournamentCancelled(uint256 indexed tournamentId, address indexed cancelledBy);
    event TournamentDonation(uint256 indexed tournamentId, address indexed donor, uint256 amount);
    event TournamentFundedByAdmin(uint256 indexed tournamentId, address indexed admin, uint256 amount);
    event EntryRefundClaimed(uint256 indexed tournamentId, address indexed participant, uint256 amount);
    event ContributionRefundClaimed(uint256 indexed tournamentId, address indexed contributor, uint256 amount);
    event ParticipantBanned(
        uint256 indexed tournamentId,
        address indexed wallet,
        address indexed admin,
        bool wasParticipant,
        uint256 refundAmount
    );
    event ParticipantUnbanned(uint256 indexed tournamentId, address indexed wallet, address indexed admin);
    event EntryFeeForfeited(uint256 indexed tournamentId, address indexed wallet, uint256 amount);
    event ForfeitedFeesWithdrawn(uint256 indexed tournamentId, address indexed to, uint256 amount);

    event BracketMatchStarted(uint256 indexed tournamentId, uint256 indexed matchId, address indexed player1);
    event BracketMatchJoined(uint256 indexed tournamentId, uint256 indexed matchId, address indexed player2);
    event BracketMatchClosed(
        uint256 indexed tournamentId,
        uint256 indexed matchId,
        address indexed winner,
        address loser
    );
    event BracketMatchCancelled(uint256 indexed tournamentId, uint256 indexed matchId, address indexed cancelledBy);

    // --- Initializer ---
    function initialize(address _icContract) external initializer {
        if (_icContract == address(0)) revert ZeroAddress();
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        icContract = IICRoles(_icContract);
        nextTournamentId = 1;
        nextBracketMatchId = 1;
        emit ICContractUpdated(_icContract);
    }

    // --- Admin plumbing ---
    function setICContract(address _icContract) external onlyOwner {
        if (_icContract == address(0)) revert ZeroAddress();
        icContract = IICRoles(_icContract);
        emit ICContractUpdated(_icContract);
    }

    function setTrustedForwarder(address forwarder) external onlyOwner {
        _trustedForwarder = forwarder;
        emit TrustedForwarderUpdated(forwarder);
    }

    function trustedForwarder() public view returns (address) {
        return _trustedForwarder;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Modifiers ---
    modifier onlyAuthorized() {
        if (icContract.isBlacklisted(_msgSender())) revert IsBlacklisted();
        if (paused() || icContract.paused()) revert IsPaused();
        _;
    }

    modifier onlyAdmin() {
        if (!icContract.isAdmin(_msgSender())) revert NotAuthorized();
        _;
    }

    modifier onlyModerator() {
        if (!icContract.isModerator(_msgSender()) && !icContract.isAdmin(_msgSender())) {
            revert NotAuthorized();
        }
        if (paused() || icContract.paused()) revert IsPaused();
        _;
    }

    // --- Tournament lifecycle ---

    /**
     * @dev Creates a tournament in a single transaction. The creator pays no
     *      entry fee and is NOT a participant. `_seedAmount` optionally funds
     *      the pot from the creator's wallet in the same transaction.
     *      Name/description are emitted (not stored): the frontend lists
     *      tournaments by indexing TournamentCreated, which also guarantees a
     *      tournament only appears in the UI once its creation tx confirmed.
     */
    function createTournament(
        uint256 _gameId,
        IERC20 _token,
        uint256 _entryFee,
        uint256 _maxEntrants,
        uint8[] calldata _payoutSplit,
        uint256 _seedAmount,
        string calldata _name,
        string calldata _description
    ) external onlyAuthorized nonReentrant returns (uint256 tournamentId) {
        if (address(_token) == address(0)) revert InvalidToken();
        if (!icContract.approvedTokens(address(_token))) revert TokenNotApproved();
        if (_maxEntrants == 1) revert InvalidMaxEntrants();

        uint256 splitLen = _payoutSplit.length;
        if (splitLen == 0 || splitLen > MAX_PAYOUT_WINNERS) revert InvalidPayoutSplit();
        uint256 splitSum;
        for (uint256 i = 0; i < splitLen; i++) {
            if (_payoutSplit[i] == 0) revert InvalidPayoutSplit();
            splitSum += _payoutSplit[i];
        }
        if (splitSum != 100) revert InvalidPayoutSplit();

        tournamentId = nextTournamentId++;
        Tournament storage t = tournaments[tournamentId];
        t.creator = _msgSender();
        t.token = _token;
        t.gameId = _gameId;
        t.entryFee = _entryFee;
        t.maxEntrants = _maxEntrants;
        t.status = TournamentStatus.OPEN;
        t.createdAt = block.timestamp;
        t.payoutSplit = _payoutSplit;

        if (_seedAmount > 0) {
            _token.safeTransferFrom(_msgSender(), address(this), _seedAmount);
            t.potBalance = _seedAmount;
            contributions[tournamentId][_msgSender()] = _seedAmount;
        }

        emit TournamentCreated(
            tournamentId,
            _msgSender(),
            address(_token),
            _gameId,
            _entryFee,
            _maxEntrants,
            _payoutSplit,
            _seedAmount,
            _name,
            _description
        );
    }

    /**
     * @dev Joins an OPEN tournament, paying the entry fee (if any) into the
     *      pot. One join per wallet; the creator may join their own
     *      tournament (paying the entry fee like any other participant).
     */
    function joinTournament(uint256 _tournamentId) external onlyAuthorized nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN) revert NotOpen();
        if (isBanned[_tournamentId][_msgSender()]) revert BannedFromTournament();
        if (isParticipant[_tournamentId][_msgSender()]) revert AlreadyJoined();
        if (t.maxEntrants != 0 && t.entrantCount >= t.maxEntrants) revert TournamentFull();

        if (t.entryFee > 0) {
            t.token.safeTransferFrom(_msgSender(), address(this), t.entryFee);
            t.potBalance += t.entryFee;
        }

        isParticipant[_tournamentId][_msgSender()] = true;
        t.entrantCount += 1;

        emit TournamentJoined(_tournamentId, _msgSender());
    }

    /**
     * @dev Leaves a tournament that is still OPEN and refunds the entry fee.
     *      Impossible once the tournament is LIVE.
     */
    function leaveTournament(uint256 _tournamentId) external nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN) revert NotOpen();
        if (!isParticipant[_tournamentId][_msgSender()]) revert NotParticipant();

        uint256 refundAmount = t.entryFee;

        isParticipant[_tournamentId][_msgSender()] = false;
        t.entrantCount -= 1;

        if (refundAmount > 0) {
            t.potBalance -= refundAmount;
            t.token.safeTransfer(_msgSender(), refundAmount);
        }

        emit TournamentLeft(_tournamentId, _msgSender(), refundAmount);
    }

    /**
     * @dev OPEN -> LIVE. Callable by the tournament creator or an admin.
     *      After this point participants can no longer leave for a refund.
     */
    function startTournament(uint256 _tournamentId) external {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN) revert NotOpen();
        if (_msgSender() != t.creator && !icContract.isAdmin(_msgSender())) revert NotAuthorized();
        // Need at least 2 players, and at least one participant per payout slot
        // (completeTournament requires winners.length == payoutSplit.length).
        if (t.entrantCount < 2 || t.entrantCount < t.payoutSplit.length) revert NotEnoughParticipants();

        t.status = TournamentStatus.LIVE;
        emit TournamentStarted(_tournamentId, _msgSender());
    }

    /**
     * @dev Pays the pot out per the payout split and completes the tournament.
     *      Winners must be participants; NO platform cut is taken. Rounding
     *      dust is added to first place. Tournaments cannot be disputed, so
     *      this is restricted to admins/moderators.
     */
    function completeTournament(
        uint256 _tournamentId,
        address[] calldata _winners
    ) external onlyModerator nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.LIVE) revert NotLive();

        uint256 numWinners = _winners.length;
        if (numWinners != t.payoutSplit.length) revert WinnersMismatch();

        uint256 pot = t.potBalance;
        uint256[] memory payouts = new uint256[](numWinners);
        uint256 paidTotal;

        for (uint256 i = 0; i < numWinners; i++) {
            address winner = _winners[i];
            if (!isParticipant[_tournamentId][winner]) revert InvalidWinner();
            for (uint256 j = 0; j < i; j++) {
                if (_winners[j] == winner) revert DuplicateWinner();
            }
            payouts[i] = (pot * t.payoutSplit[i]) / 100;
            paidTotal += payouts[i];
        }

        // Rounding dust goes to first place so the full pot always leaves.
        payouts[0] += pot - paidTotal;

        // --- Effects ---
        t.status = TournamentStatus.COMPLETED;
        t.potBalance = 0;

        // --- Interactions ---
        IERC20 token = t.token;
        for (uint256 i = 0; i < numWinners; i++) {
            if (payouts[i] > 0) {
                token.safeTransfer(_winners[i], payouts[i]);
            }
        }

        emit TournamentCompleted(_tournamentId, _winners, payouts);
    }

    /**
     * @dev Cancels a tournament. Admins can cancel any OPEN or LIVE
     *      tournament; the creator can only cancel while it is still OPEN.
     *      Money is returned pull-based: participants claim entry fees via
     *      claimEntryRefund, contributors (seed/donations/admin allocations)
     *      claim via claimContributionRefund.
     */
    function cancelTournament(uint256 _tournamentId) external {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN && t.status != TournamentStatus.LIVE) revert NotOpen();

        bool isAdminCaller = icContract.isAdmin(_msgSender());
        if (!isAdminCaller) {
            if (_msgSender() != t.creator) revert NotAuthorized();
            if (t.status != TournamentStatus.OPEN) revert NotOpen();
        }

        t.status = TournamentStatus.CANCELLED;
        emit TournamentCancelled(_tournamentId, _msgSender());
    }

    /**
     * @dev Admin-only ban of a wallet from one tournament (rule-breaking,
     *      match spamming, duplicate-wallet abuse flagged by the backend, ...).
     *      Works while OPEN or LIVE. If the wallet is currently a participant
     *      it is also kicked. Entry fee handling depends on status:
     *      - OPEN: fee refunded (players can freely leave at this stage anyway)
     *      - LIVE: fee FORFEITED — it stays in the pot for the winners
     *      A banned wallet can never (re)join this tournament and, no longer
     *      being a participant, is locked out of all of its bracket matches.
     *      For platform-wide bans use IC's blacklist.
     */
    function banParticipant(uint256 _tournamentId, address _wallet) external onlyAdmin nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN && t.status != TournamentStatus.LIVE) revert NotOpen();
        if (_wallet == address(0)) revert ZeroAddress();
        if (isBanned[_tournamentId][_wallet]) revert AlreadyBanned();

        isBanned[_tournamentId][_wallet] = true;

        bool wasParticipant = isParticipant[_tournamentId][_wallet];
        uint256 refundAmount;
        if (wasParticipant) {
            isParticipant[_tournamentId][_wallet] = false;
            t.entrantCount -= 1;

            if (t.entryFee > 0) {
                if (t.status == TournamentStatus.OPEN) {
                    refundAmount = t.entryFee;
                    t.potBalance -= refundAmount;
                    t.token.safeTransfer(_wallet, refundAmount);
                } else {
                    // LIVE: fee stays in the pot; tracked so it can be
                    // recovered by an admin if the tournament is cancelled.
                    forfeitedFees[_tournamentId] += t.entryFee;
                    emit EntryFeeForfeited(_tournamentId, _wallet, t.entryFee);
                }
            }
        }

        emit ParticipantBanned(_tournamentId, _wallet, _msgSender(), wasParticipant, refundAmount);
    }

    /// @dev Reverses a mistaken ban. The wallet may rejoin while the
    ///      tournament is OPEN (paying the entry fee again as usual).
    ///      A fee forfeited by a LIVE ban is NOT returned automatically.
    function unbanParticipant(uint256 _tournamentId, address _wallet) external onlyAdmin {
        if (tournaments[_tournamentId].creator == address(0)) revert NotFound();
        if (!isBanned[_tournamentId][_wallet]) revert NotBanned();

        isBanned[_tournamentId][_wallet] = false;
        emit ParticipantUnbanned(_tournamentId, _wallet, _msgSender());
    }

    /**
     * @dev Recovers forfeited entry fees after a tournament is CANCELLED.
     *      Without this the forfeits would be stranded: banned players cannot
     *      claim them and they are not part of anyone's refund. On a COMPLETED
     *      tournament forfeits are simply part of the winners' pot and this
     *      function is not needed (and will revert).
     */
    function withdrawForfeitedFees(uint256 _tournamentId, address _to) external onlyAdmin nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.CANCELLED) revert NotCancelled();
        if (_to == address(0)) revert ZeroAddress();

        uint256 amount = forfeitedFees[_tournamentId];
        if (amount == 0) revert NothingToClaim();

        forfeitedFees[_tournamentId] = 0;
        t.potBalance -= amount;
        t.token.safeTransfer(_to, amount);

        emit ForfeitedFeesWithdrawn(_tournamentId, _to, amount);
    }

    /// @dev After a cancel, each participant reclaims their entry fee.
    function claimEntryRefund(uint256 _tournamentId) external nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.CANCELLED) revert NotCancelled();
        if (!isParticipant[_tournamentId][_msgSender()]) revert NotParticipant();
        if (entryRefundClaimed[_tournamentId][_msgSender()]) revert NothingToClaim();

        entryRefundClaimed[_tournamentId][_msgSender()] = true;

        uint256 refundAmount = t.entryFee;
        if (refundAmount > 0) {
            t.potBalance -= refundAmount;
            t.token.safeTransfer(_msgSender(), refundAmount);
        }

        emit EntryRefundClaimed(_tournamentId, _msgSender(), refundAmount);
    }

    /// @dev After a cancel, seeders/donors/admin funders reclaim what they put in.
    function claimContributionRefund(uint256 _tournamentId) external nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.CANCELLED) revert NotCancelled();

        uint256 amount = contributions[_tournamentId][_msgSender()];
        if (amount == 0) revert NothingToClaim();

        contributions[_tournamentId][_msgSender()] = 0;
        t.potBalance -= amount;
        t.token.safeTransfer(_msgSender(), amount);

        emit ContributionRefundClaimed(_tournamentId, _msgSender(), amount);
    }

    // --- Pot funding ---

    /**
     * @dev Donates to the tournament pot as a whole. Per-match donations do
     *      not exist for tournaments by design. Donor totals are tracked on
     *      chain so the frontend can rank sponsors.
     */
    function donateToTournament(uint256 _tournamentId, uint256 _amount) external onlyAuthorized nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN && t.status != TournamentStatus.LIVE) revert NotOpen();
        if (_amount < icContract.minDonationAmount()) revert BelowMinDonation();

        t.token.safeTransferFrom(_msgSender(), address(this), _amount);

        t.potBalance += _amount;
        contributions[_tournamentId][_msgSender()] += _amount;
        tournamentDonations[_tournamentId][_msgSender()] += _amount;

        emit TournamentDonation(_tournamentId, _msgSender(), _amount);
    }

    /**
     * @dev Admin-only allocation of funds into a tournament pot. This is the
     *      bridge from IC's fee accounting: IC.allocateGamePool ->
     *      IC.withdrawTournamentPool (multisig -> admin wallet) -> approve ->
     *      fundTournament.
     */
    function fundTournament(uint256 _tournamentId, uint256 _amount) external onlyAdmin nonReentrant {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.OPEN && t.status != TournamentStatus.LIVE) revert NotOpen();
        if (_amount == 0) revert ZeroAmount();

        t.token.safeTransferFrom(_msgSender(), address(this), _amount);

        t.potBalance += _amount;
        contributions[_tournamentId][_msgSender()] += _amount;

        emit TournamentFundedByAdmin(_tournamentId, _msgSender(), _amount);
    }

    // --- Bracket matches (no money) ---

    /**
     * @dev Opens a 1v1 bracket match inside a LIVE tournament. No stakes, no
     *      fees, no donations — purely a result record. Participants only:
     *      this is the on-chain half of the tournament whitelist.
     */
    function startBracketMatch(uint256 _tournamentId) external onlyAuthorized returns (uint256 matchId) {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.LIVE) revert NotLive();
        if (!isParticipant[_tournamentId][_msgSender()]) revert NotParticipant();

        matchId = nextBracketMatchId++;
        bracketMatches[matchId] = BracketMatch({
            tournamentId: _tournamentId,
            player1: _msgSender(),
            player2: address(0),
            winner: address(0),
            isOpen: true,
            isClosed: false,
            createdAt: block.timestamp
        });

        emit BracketMatchStarted(_tournamentId, matchId, _msgSender());
    }

    function joinBracketMatch(uint256 _matchId) external onlyAuthorized {
        BracketMatch storage m = bracketMatches[_matchId];
        if (m.player1 == address(0)) revert NotFound();
        if (!m.isOpen) revert MatchNotOpen();
        if (_msgSender() == m.player1) revert AlreadyJoined();

        Tournament storage t = tournaments[m.tournamentId];
        if (t.status != TournamentStatus.LIVE) revert NotLive();
        if (!isParticipant[m.tournamentId][_msgSender()]) revert NotParticipant();

        m.player2 = _msgSender();
        m.isOpen = false;

        emit BracketMatchJoined(m.tournamentId, _matchId, _msgSender());
    }

    /**
     * @dev Admin/moderator pairs two participants directly (bracket seeding
     *      from the tournament page). Both players are set at once so nobody
     *      else can slip into the seat; emits the same Started + Joined events
     *      the indexer already consumes for self-made matches.
     */
    function adminCreateBracketMatch(
        uint256 _tournamentId,
        address _player1,
        address _player2
    ) external onlyModerator returns (uint256 matchId) {
        Tournament storage t = tournaments[_tournamentId];
        if (t.creator == address(0)) revert NotFound();
        if (t.status != TournamentStatus.LIVE) revert NotLive();
        if (_player1 == _player2) revert DuplicateWinner();
        if (!isParticipant[_tournamentId][_player1]) revert NotParticipant();
        if (!isParticipant[_tournamentId][_player2]) revert NotParticipant();

        matchId = nextBracketMatchId++;
        bracketMatches[matchId] = BracketMatch({
            tournamentId: _tournamentId,
            player1: _player1,
            player2: _player2,
            winner: address(0),
            isOpen: false,
            isClosed: false,
            createdAt: block.timestamp
        });

        emit BracketMatchStarted(_tournamentId, matchId, _player1);
        emit BracketMatchJoined(_tournamentId, matchId, _player2);
    }

    /**
     * @dev Records the result of a bracket match. Emits BracketMatchClosed so
     *      the backend indexes wins into player records (same as it consumes
     *      MatchClosed for regular matches). Moderator/admin only.
     */
    function closeBracketMatch(uint256 _matchId, address _winner) external onlyModerator {
        BracketMatch storage m = bracketMatches[_matchId];
        if (m.player1 == address(0)) revert NotFound();
        if (m.isOpen) revert MatchNotOpen();
        if (m.isClosed) revert MatchAlreadyClosed();
        if (_winner != m.player1 && _winner != m.player2) revert InvalidWinner();

        m.isClosed = true;
        m.winner = _winner;

        address loser = _winner == m.player1 ? m.player2 : m.player1;
        emit BracketMatchClosed(m.tournamentId, _matchId, _winner, loser);
    }

    /// @dev Voids a bracket match that will not be played (no money involved).
    ///      Moderators/admins can always cancel; the two players themselves can
    ///      also cancel an unclosed match (e.g. the wrong person joined), since
    ///      no result has been recorded and no funds are at stake.
    function cancelBracketMatch(uint256 _matchId) external onlyAuthorized {
        BracketMatch storage m = bracketMatches[_matchId];
        if (m.player1 == address(0)) revert NotFound();
        if (m.isClosed) revert MatchAlreadyClosed();

        address sender = _msgSender();
        if (
            sender != m.player1 &&
            sender != m.player2 &&
            !icContract.isModerator(sender) &&
            !icContract.isAdmin(sender)
        ) revert NotAuthorized();

        m.isClosed = true;
        m.isOpen = false;

        emit BracketMatchCancelled(m.tournamentId, _matchId, sender);
    }

    // --- Views ---
    function getPayoutSplit(uint256 _tournamentId) external view returns (uint8[] memory) {
        return tournaments[_tournamentId].payoutSplit;
    }

    function getPotBalance(uint256 _tournamentId) external view returns (uint256) {
        return tournaments[_tournamentId].potBalance;
    }

    // --- EIP-2771 meta-transactions ---
    function isTrustedForwarder(address forwarder) public view virtual returns (bool) {
        return forwarder != address(0) && forwarder == _trustedForwarder;
    }

    function _msgSender() internal view virtual override returns (address sender) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = super._msgSender();
        }
    }

    function _msgData() internal view virtual override returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            return msg.data[:msg.data.length - 20];
        }
        return super._msgData();
    }
}
