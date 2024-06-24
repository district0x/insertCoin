// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MVPCLR is OwnableUpgradeable {

    event AdminAdded(address indexed _admin);
    event AdminRemoved(address indexed _admin);
    event BlacklistedAdded(address indexed _blacklisted);
    event BlacklistedRemoved(address indexed _blacklisted);
    event MatchingPoolFilled(uint256 amount);
    event RoundStarted(uint256 roundStart, uint256 roundId, uint256 roundDuration);
    event MatchingPoolDonation(address indexed sender, uint256 value, uint256 roundId);
    event MatchStarted(uint256 indexed matchId, address indexed player1, uint256 matchAmount);
    event MatchJoined(uint256 indexed matchId, address indexed player2);
    event MatchClosed(uint256 indexed matchId, address indexed winner, uint256 winnerAmount, uint256 multisigAmount, uint256 poolAmount);
    event MatchDonation(uint256 indexed matchId, address indexed donor, uint256 amount);
    event TournamentCreated(uint256 indexed tournamentId, uint256 numEntrants, uint8 winnersPercentage, uint8 multisigPercentage);
    event TournamentJoined(uint256 indexed tournamentId, address indexed entrant);
    event TournamentStarted(uint256 indexed tournamentId);
    event TournamentEnded(uint256 indexed tournamentId, address[] winners, uint8[] winnersPercentages);
    event Donate(address indexed sender, uint256 value, uint256 indexed tournamentId);

    struct Match {
        address player1;
        address player2;
        uint256 player1Amount;
        uint256 player2Amount;
        uint256 totalAmount;
        uint256 donatedAmount;
        bool isOpen;
        bool isERC20;
        IERC20 token;
    }

    struct Tournament {
        uint256 numEntrants;
        uint256 totalDonations;
        uint256 remainingBalance;
        uint8 winnersPercentage;
        uint8 multisigPercentage;
        bool isActive;
        bool hasStarted;
    }

    struct WinnerInfo {
        uint256 amount;
        bool hasClaimed;
    }

    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => uint256) public currentTournamentRound;
    mapping(uint256 => address[]) public tournamentEntrants;
    mapping(uint256 => mapping(address => bool)) public isEntrantInTournament;
    mapping(uint256 => mapping(address => WinnerInfo)) public tournamentWinners;

    mapping(address => uint256) public matchDonorContributions;
    mapping(uint256 => Match) public matches;
    uint256 public nextMatchId;
    uint256 public roundStart;
    uint256 public roundDuration;
    uint256 public matchingPool;
    uint256 roundId;
    uint256 public nextTournamentId;
    uint256 public totalMultisigCollected;

    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isPatron;
    mapping(address => bool) public isBlacklisted;

    address public multisigAddress;

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        multisigAddress = msg.sender;
        nextTournamentId = 1;
        nextMatchId = 1;
        roundId = 1;
    }

    function setMultisigAddress(address _multisigAddress) external onlyMultisig {
        multisigAddress = _multisigAddress;
    }

    /*** 1V1 FUNCTIONS ***/

    function startMatch(uint256 _matchAmount) external payable {
        require(_matchAmount > 0, "Amt > 0");
        require(msg.value == _matchAmount, "Incorrect amt");

        uint256 matchId = nextMatchId++;
        matches[matchId] = Match({
            player1: msg.sender,
            player2: address(0),
            player1Amount: msg.value,
            player2Amount: 0,
            totalAmount: msg.value,
            donatedAmount: 0,
            isOpen: true,
            isERC20: false,
            token: IERC20(address(0))
        });

        emit MatchStarted(matchId, msg.sender, msg.value);
    }

    function startMatchERC20(uint256 _matchAmount, IERC20 _token) external {
        require(_matchAmount > 0, "Amt > 0");
        require(_token.transferFrom(msg.sender, address(this), _matchAmount), "Transfer failed");

        uint256 matchId = nextMatchId++;
        matches[matchId] = Match({
            player1: msg.sender,
            player2: address(0),
            player1Amount: _matchAmount,
            player2Amount: 0,
            totalAmount: _matchAmount,
            donatedAmount: 0,
            isOpen: true,
            isERC20: true,
            token: _token
        });

        emit MatchStarted(matchId, msg.sender, _matchAmount);
    }

    function joinMatch(uint256 _matchId) external payable {
        Match storage matchInfo = matches[_matchId];
        require(matchInfo.isOpen, "Closed");
        require(msg.sender != matchInfo.player1, "Already joined");

        if (matchInfo.isERC20) {
            require(matchInfo.token.transferFrom(msg.sender, address(this), matchInfo.player1Amount), "Transfer failed");
        } else {
            require(msg.value == matchInfo.player1Amount, "Incorrect amt");
        }

        matchInfo.player2 = msg.sender;
        matchInfo.player2Amount = matchInfo.player1Amount;
        matchInfo.totalAmount += matchInfo.player1Amount;
        matchInfo.isOpen = false;

        emit MatchJoined(_matchId, msg.sender);
    }

    function closeMatch(uint256 _matchId, address _winner) external onlyAdmin {
        Match storage matchInfo = matches[_matchId];
        require(_winner == matchInfo.player1 || _winner == matchInfo.player2, "Invalid winner");

        uint256 totalAmount = matchInfo.totalAmount;
        uint256 winnerAmount = (totalAmount * 90) / 100;
        uint256 multisigAmount = (totalAmount * 5) / 100;
        uint256 poolAmount = totalAmount - winnerAmount - multisigAmount;

        if (matchInfo.isERC20) {
            matchInfo.token.transfer(_winner, winnerAmount);
            matchInfo.token.transfer(multisigAddress, multisigAmount);
        } else {
            payable(_winner).transfer(winnerAmount);
            payable(multisigAddress).transfer(multisigAmount);
        }

        matchingPool += poolAmount;

        emit MatchClosed(_matchId, _winner, winnerAmount, multisigAmount, poolAmount);
    }

    function donateToMatch(uint256 _matchId, uint256 _amount) external payable {
        Match storage matchInfo = matches[_matchId];
        require(matchInfo.isOpen, "Closed");

        if (matchInfo.isERC20) {
            require(matchInfo.token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        } else {
            require(msg.value == _amount, "Incorrect amt");
        }

        matchInfo.donatedAmount += _amount;
        matchInfo.totalAmount += _amount;
        matchDonorContributions[msg.sender] += _amount;

        if (!isPatron[msg.sender]) {
            isPatron[msg.sender] = true;
        }

        emit MatchDonation(_matchId, msg.sender, _amount);
    }

    /*** TOURNAMENT FUNCTIONS ***/

    function createTournament(uint256 _numEntrants, uint8 _winnersPercentage, uint8 _multisigPercentage) public onlyAdmin {
        uint256 newTournamentId = nextTournamentId++;

        tournaments[newTournamentId] = Tournament({
            numEntrants: _numEntrants,
            totalDonations: 0,
            remainingBalance: 0,
            winnersPercentage: _winnersPercentage,
            multisigPercentage: _multisigPercentage,
            isActive: true,
            hasStarted: false
        });

        currentTournamentRound[newTournamentId] = 1;

        emit TournamentCreated(newTournamentId, _numEntrants, _winnersPercentage, _multisigPercentage);
    }

    function joinTournament(uint256 _tournamentId) public {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(!tournament.hasStarted, "Started");
        require(tournamentEntrants[_tournamentId].length < tournament.numEntrants, "Full");
        require(!isEntrantInTournament[_tournamentId][msg.sender], "Already joined");

        isEntrantInTournament[_tournamentId][msg.sender] = true;
        tournamentEntrants[_tournamentId].push(msg.sender);

        emit TournamentJoined(_tournamentId, msg.sender);
    }

    function allocateMatchingPoolToTournament(uint256 _tournamentId) public onlyAdmin {
        require(_tournamentId > 0 && _tournamentId <= nextTournamentId, "Doesn't exist");
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(matchingPool > 0, "Empty");

        tournament.totalDonations += matchingPool;
        emit MatchingPoolDonation(msg.sender, matchingPool, _tournamentId);
        matchingPool = 0;
    }

    function startTournament(uint256 _tournamentId) public onlyAdmin {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(!tournament.hasStarted, "Started");

        tournament.hasStarted = true;
        emit TournamentStarted(_tournamentId);
    }

    function fillUpMatchingPool() public payable onlyAdmin {
        require(msg.value > 0, "No funds");
        matchingPool += msg.value;
        emit MatchingPoolFilled(msg.value);
    }

    function endTournament(uint256 _tournamentId, address[] memory winners, uint8[] memory winnersPercentages) public onlyAdmin {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(tournament.hasStarted, "Not started");
        require(winners.length == winnersPercentages.length, "Mismatch");

        uint256 totalDonations = tournament.totalDonations + matchingPool;
        uint256 totalPayout = 0;
        uint256 multisigAmount = (totalDonations * tournament.multisigPercentage) / 100;

        for (uint256 i = 0; i < winners.length; i++) {
            uint256 winnerPayout = ((totalDonations - multisigAmount) * winnersPercentages[i]) / 100;
            tournamentWinners[_tournamentId][winners[i]] = WinnerInfo({ amount: winnerPayout, hasClaimed: false });
            totalPayout += winnerPayout;
        }

        payable(multisigAddress).transfer(multisigAmount);
        totalMultisigCollected += multisigAmount;
        matchingPool = 0;
        require(totalPayout <= (totalDonations - multisigAmount), "Payout exceeds");

        tournament.isActive = false;
        tournament.hasStarted = false;
        tournament.remainingBalance = totalDonations - totalPayout - multisigAmount;
        emit TournamentEnded(_tournamentId, winners, winnersPercentages);
    }

    function claimReward(uint256 _tournamentId) public {
        WinnerInfo storage winner = tournamentWinners[_tournamentId][msg.sender];
        require(winner.amount > 0, "No reward");
        require(!winner.hasClaimed, "Claimed");

        winner.hasClaimed = true;
        payable(msg.sender).transfer(winner.amount);
    }

    function donate(uint256[] memory amounts, uint256 _tournamentId) public payable {
        require(amounts.length > 0, "No amounts");
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");

        uint256 totalAmount = 0;
        uint256 tournamentRoundId = currentTournamentRound[_tournamentId];

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            totalAmount += amount;
            require(!isBlacklisted[msg.sender], "Blacklisted");
            emit Donate(msg.sender, amount, tournamentRoundId);
        }

        require(totalAmount == msg.value, "Incorrect amount");
        tournament.totalDonations += totalAmount;
    }

    function addAdmin(address _admin) public onlyOwner {
        isAdmin[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) public onlyOwner {
        require(isAdmin[_admin], "Not found");
        delete isAdmin[_admin];
        emit AdminRemoved(_admin);
    }

    function addBlacklisted(address _address) public onlyAdmin {
        isBlacklisted[_address] = true;
        emit BlacklistedAdded(_address);
    }

    function removeBlacklisted(address _address) public onlyAdmin {
        require(isBlacklisted[_address], "Not blacklisted");
        delete isBlacklisted[_address];
        emit BlacklistedRemoved(_address);
    }

    function withdrawFunds(uint256 amount) external onlyMultisig {
        require(address(this).balance >= amount, "Insufficient funds");
        payable(multisigAddress).transfer(amount);
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getMatchDonorContribution(address _donor) external view returns (uint256) {
        return matchDonorContributions[_donor];
    }

    receive() external payable {
        require(roundStart == 0 || block.timestamp < roundStart + roundDuration, "Closed");
        emit MatchingPoolDonation(msg.sender, msg.value, roundId);
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }

    modifier onlyMultisig() {
        require(msg.sender == multisigAddress, "Not authorized");
        _;
    }
}
