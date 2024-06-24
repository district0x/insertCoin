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

    event AdminAdded(address _admin);
    event AdminRemoved(address _admin);
    event BlacklistedAdded(address _blacklisted);
    event BlacklistedRemoved(address _blacklisted);
    event MatchingPoolFilled(uint256 amount);
    event PatronsAdded(address payable[] addresses);
    event RoundStarted(uint256 roundStart, uint256 roundId, uint256 roundDuration);
    event RoundClosed(uint256 roundId);
    event MatchingPoolDonation(address sender, uint256 value, uint256 roundId);

    //Match Events
    event MatchStarted(uint256 matchId, address player1, uint256 matchAmount);
    event MatchJoined(uint256 matchId, address player2);
    event MatchClosed(uint256 matchId, address winner, uint256 winnerAmount, uint256 multisigAmount, uint256 poolAmount);
    event MatchDonation(uint256 indexed matchId, address indexed donor, uint256 amount);

    //Tournament Events
    event TournamentCreated(uint256 indexed tournamentId, uint256 numEntrants, uint8 winnersPercentage, uint8 multisigPercentage);
    event TournamentJoined(uint256 tournamentId, address entrant);
    event TournamentStarted(uint256 tournamentId);
    event TournamentEnded(uint256 indexed tournamentId, address[] winners, uint8[] winnersPercentages);
    event Donate(address sender, uint256 value, uint256 tournamentId);
    event FailedDistribute(address receiver, uint256 amount);

    //1V1 Match Details
    struct Match {
        address player1;
        address player2;
        uint256 player1Amount;
        uint256 player2Amount;
        uint256 totalAmount;
        uint256 donatedAmount; // New field to track donated amount
        bool isOpen;
    }

    //Tournament Details
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

    // 1V1 MATCH mappings
    mapping(address => uint256) public matchDonorContributions;
    mapping(uint256 => Match) public matches;
    uint256 public nextMatchId;

    uint256 public roundStart;
    uint256 public roundDuration;
    uint256 public matchingPool;
    uint256 roundId;
    uint256 public nextTournamentId; // Added nextTournamentId variable
    uint256 public lastActiveRoundId;
    uint256 public totalMultisigCollected;

    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isPatron;
    mapping(address => bool) public isBlacklisted;

    address public multisigAddress;

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        multisigAddress = msg.sender;
        nextTournamentId = 0; // Initialize nextTournamentId
        nextMatchId = 0; // Initialize nextMatchId
        roundId = 0;
        lastActiveRoundId = 0;
    }

    function setMultisigAddress(address _multisigAddress) external onlyMultisig {
        multisigAddress = _multisigAddress;
    }

    /*** 1V1 FUNCTIONS ***/

    function startMatch(uint256 _matchAmount) external payable {
        require(_matchAmount > 0, "Match amount must be greater than 0");
        require(msg.value == _matchAmount, "Incorrect match amount sent");

        uint256 matchId = nextMatchId++;
        matches[matchId] = Match({
            player1: msg.sender,
            player2: address(0), // Initially no second player
            player1Amount: msg.value, // Use msg.value instead of _matchAmount
            player2Amount: 0,
            totalAmount: msg.value, // Use msg.value instead of _matchAmount
            donatedAmount: 0, // Initialize donatedAmount to 0
            isOpen: true
        });

        emit MatchStarted(matchId, msg.sender, msg.value); // Use msg.value instead of _matchAmount
    }

    function joinMatch(uint256 _matchId) external payable {
        require(matches[_matchId].isOpen, "Match is not open");
        require(msg.sender != matches[_matchId].player1, "Player already in match");
        require(msg.value == matches[_matchId].player1Amount, "Incorrect match amount");

        matches[_matchId].player2 = msg.sender;
        matches[_matchId].player2Amount = msg.value;
        matches[_matchId].totalAmount += msg.value;
        matches[_matchId].isOpen = true; // Close the match to further participants

        emit MatchJoined(_matchId, msg.sender);
    }

    function closeMatch(uint256 _matchId, address _winner) external onlyAdmin {
        Match storage matchInfo = matches[_matchId];
        require(_winner == matchInfo.player1 || _winner == matchInfo.player2, "Invalid winner address");

        // Proceed with distribution
        uint256 totalAmount = matchInfo.totalAmount;
        uint256 winnerAmount = totalAmount * 90 / 100;
        uint256 multisigAmount = totalAmount * 5 / 100;
        uint256 poolAmount = totalAmount - winnerAmount - multisigAmount;

        payable(_winner).transfer(winnerAmount);
        payable(multisigAddress).transfer(multisigAmount);
        matchingPool += poolAmount;

        matchInfo.isOpen = false; // Set isOpen to false when the match is closed

        emit MatchClosed(_matchId, _winner, winnerAmount, multisigAmount, poolAmount);
    }

    function donateToMatch(uint256 _matchId, uint256 _amount) external payable {
        require(_amount > 0, "Donation amount must be greater than 0");
        require(msg.value == _amount, "Incorrect donation amount sent");
        require(matches[_matchId].isOpen, "Cannot donate to a closed match");

        matches[_matchId].donatedAmount += _amount;
        matches[_matchId].totalAmount += _amount;
        matchDonorContributions[msg.sender] += _amount;

        if (!isPatron[msg.sender]) {
            isPatron[msg.sender] = true;
        }

        emit MatchDonation(_matchId, msg.sender, _amount);
    }

    /*** TOURNAMENT FUNCTIONS ***/

    function createTournament(uint256 _numEntrants, uint8 _winnersPercentage, uint8 _multisigPercentage) public onlyAdmin {
        // Increment the nextTournamentId for each new tournament
        uint256 newTournamentId = nextTournamentId++;

        // Ensure the tournament does not already exist
        require(!tournaments[newTournamentId].isActive, "Tournament already exists");

        // Create a new tournament with the new ID
        tournaments[newTournamentId] = Tournament({
            numEntrants: _numEntrants,
            totalDonations: 0,
            remainingBalance: 0,
            winnersPercentage: _winnersPercentage,
            multisigPercentage: _multisigPercentage,
            isActive: true,
            hasStarted: false
        });

        // Initialize the current round of the tournament to 1
        currentTournamentRound[newTournamentId] = 1;

        // Emit the TournamentCreated event
        emit TournamentCreated(newTournamentId, _numEntrants, _winnersPercentage, _multisigPercentage);
    }

    function joinTournament(uint256 _tournamentId) public {
        require(tournaments[_tournamentId].isActive, "Tournament is not active");
        require(!tournaments[_tournamentId].hasStarted, "Tournament has already started");
        require(tournamentEntrants[_tournamentId].length < tournaments[_tournamentId].numEntrants, "Tournament is full");
        require(!isEntrantInTournament[_tournamentId][msg.sender], "Already joined the tournament");

        isEntrantInTournament[_tournamentId][msg.sender] = true;
        tournamentEntrants[_tournamentId].push(msg.sender);

        emit TournamentJoined(_tournamentId, msg.sender);
    }

    function allocateMatchingPoolToTournament(uint256 _tournamentId) public onlyAdmin {
        // Check that the tournament exists and is in a valid state for allocation
        require(_tournamentId > 0 && _tournamentId <= nextTournamentId, "Tournament does not exist.");
        require(tournaments[_tournamentId].isActive, "Tournament is not in a valid state for allocation.");
        require(matchingPool > 0, "Matching pool is empty.");

        // Allocate the matching pool to the tournament's total donations
        tournaments[_tournamentId].totalDonations += matchingPool;
        
        // Log the allocation for transparency and auditing
        emit MatchingPoolDonation(msg.sender, matchingPool, _tournamentId);

        // Reset the matching pool after successful allocation
        matchingPool = 0;
    }

    function startTournament(uint256 _tournamentId) public onlyAdmin {
        require(tournaments[_tournamentId].isActive, "Tournament is not active");
        require(!tournaments[_tournamentId].hasStarted, "Tournament has already started");

        // Mark the tournament as started
        tournaments[_tournamentId].hasStarted = true;

        emit TournamentStarted(_tournamentId);
    }

    function fillUpMatchingPool() public payable onlyAdmin {
        require(msg.value > 0, "No funds sent");
        matchingPool += msg.value; // Ensure this line is present and correctly adds the sent value
        emit MatchingPoolFilled(msg.value); // Adjust event name and parameters as needed
    }

    function endTournament(uint256 _tournamentId, address[] memory winners, uint8[] memory winnersPercentages) public onlyAdmin {
        require(tournaments[_tournamentId].isActive, "Tournament is not active");
        require(tournaments[_tournamentId].hasStarted, "Tournament has not started");
        require(winners.length == winnersPercentages.length, "Mismatch between winners and percentages");

        // Include matching pool in total donations for distribution
        uint256 totalDonations = tournaments[_tournamentId].totalDonations + matchingPool;
        
        uint256 totalPayout = 0;
        uint256 multisigAmount = totalDonations * tournaments[_tournamentId].multisigPercentage / 100;

        // Calculate and set payouts for each winner, including matching pool funds
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 winnerPayout = (totalDonations - multisigAmount) * winnersPercentages[i] / 100;
            tournamentWinners[_tournamentId][winners[i]] = WinnerInfo({
                amount: winnerPayout,
                hasClaimed: false
            });
            totalPayout += winnerPayout;
        }

        // Transfer multisig amount
        payable(multisigAddress).transfer(multisigAmount);
        totalMultisigCollected += multisigAmount;

        // Reset matching pool after distribution
        matchingPool = 0;

        // Ensure total payouts do not exceed the total donations minus multisig amount
        require(totalPayout <= (totalDonations - multisigAmount), "Payout exceeds allocated amount for winners");

        // Update tournament status
        tournaments[_tournamentId].isActive = false;
        tournaments[_tournamentId].hasStarted = false;
        tournaments[_tournamentId].remainingBalance = totalDonations - totalPayout - multisigAmount;

        emit TournamentEnded(_tournamentId, winners, winnersPercentages);
    }

    function claimReward(uint256 _tournamentId) public {
        WinnerInfo storage winner = tournamentWinners[_tournamentId][msg.sender];
        require(winner.amount > 0, "No reward available");
        require(!winner.hasClaimed, "Reward already claimed");

        winner.hasClaimed = true;
        payable(msg.sender).transfer(winner.amount);
    }

    function donate(uint256[] memory amounts, uint256 _tournamentId) public payable {
        require(amounts.length > 0, "CLR:donate - No amounts provided");
        require(tournaments[_tournamentId].isActive, "Tournament not active");

        uint256 totalAmount = 0;
        uint256 tournamentRoundId = currentTournamentRound[_tournamentId];
        
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            totalAmount += amount;
            require(!isBlacklisted[_msgSender()], "Sender address is blacklisted");
            emit Donate(_msgSender(), amount, tournamentRoundId);
        }

        require(totalAmount == msg.value, "CLR:donate - Total amount donated does not match the value sent");
        tournaments[_tournamentId].totalDonations += totalAmount;
    }

    function addAdmin(address _admin) public onlyOwner {
        isAdmin[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) public onlyOwner {
        require(isAdmin[_admin], "Admin not found"); // check if the address is an admin
        delete isAdmin[_admin];
        emit AdminRemoved(_admin);
    }

    function getBlockTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    function addBlacklisted(address _address) public onlyAdmin {
        isBlacklisted[_address] = true;
        emit BlacklistedAdded(_address);
    }

    function removeBlacklisted(address _address) public onlyAdmin {
        require(isBlacklisted[_address], "Address not blacklisted");
        delete isBlacklisted[_address];
        emit BlacklistedRemoved(_address);
    }

    function addPatrons(address payable[] calldata addresses) public onlyAdmin {
        for (uint256 i = 0; i < addresses.length; i++) {
            address addr = addresses[i];
            require(!isBlacklisted[addr], "Patron address is blacklisted");
            isPatron[addr] = true;
        }
        emit PatronsAdded(addresses);
    }

    // Only designated multisig address can call this function
    function withdrawFunds(uint256 amount) external onlyMultisig {
        require(address(this).balance >= amount, "Insufficient funds in contract");
        payable(multisigAddress).transfer(amount);
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getMatchDonorContribution(address _donor) external view returns (uint256) {
        return matchDonorContributions[_donor];
    }

    // Receive donation for the matching pool
    receive() external payable {
        require(roundStart == 0 || getBlockTimestamp() < roundStart + roundDuration, "CLR:receive closed");
        emit MatchingPoolDonation(_msgSender(), msg.value, roundId);
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] == true, "Not an admin");
        _;
    }

    modifier onlyMultisig() {
        require(msg.sender == multisigAddress, "Not authorized");
        _;
    }
}
