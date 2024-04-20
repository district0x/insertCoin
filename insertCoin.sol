// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract MVPCLR is OwnableUpgradeable {
    event AdminAdded(address _admin);
    event AdminRemoved(address _admin);
    event BlacklistedAdded(address _blacklisted);
    event BlacklistedRemoved(address _blacklisted);
    event MatchingPoolFilled(uint256 amount);
    event PatronsAdded(address payable[] addresses);
    event RoundStarted(
        uint256 roundStart,
        uint256 roundId,
        uint256 roundDuration
    );
    event RoundClosed(uint256 roundId);
    event MatchingPoolDonation(address sender, uint256 value, uint256 roundId);
    event TournamentJoined(uint256 tournamentId, address entrant);
    event TournamentStarted(uint256 tournamentId);
    event TournamentEnded(
        uint256 indexed tournamentId,
        address[] winners,
        uint8[] winnersPercentages
    );
    event Donate(address sender, uint256 value, uint256 tournamentId);
    event FailedDistribute(address receiver, uint256 amount);

    struct Round {
        address player1;
        address player2;
        uint256 betAmount;
        bool isActive;
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
    mapping(uint256 => Round) public rounds;

    uint256 public roundStart;
    uint256 public roundDuration;
    uint256 public matchingPool;
    uint256 roundId;
    uint256 tournamentId;
    uint256 public lastActiveRoundId;

    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isPatron;
    mapping(address => bool) public isBlacklisted;

    address public multisigAddress;

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        multisigAddress = msg.sender;
        tournamentId = 0;
        roundId = 0;
        lastActiveRoundId = 0;
    }

    function setMultisigAddress(
        address _multisigAddress
    ) external onlyMultisig {
        multisigAddress = _multisigAddress;
    }

    function createTournament(
        uint256 _tournamentId,
        uint256 _numEntrants,
        uint8 _winnersPercentage,
        uint8 _multisigPercentage
    ) public onlyAdmin {
        // existing checks
        require(
            !tournaments[_tournamentId].isActive,
            "Tournament already exists"
        );
        tournaments[_tournamentId] = Tournament({
            numEntrants: _numEntrants,
            totalDonations: 0,
            isActive: true,
            hasStarted: false,
            winnersPercentage: _winnersPercentage,
            multisigPercentage: _multisigPercentage,
            remainingBalance: 0
        });
        currentTournamentRound[_tournamentId] = 1;
    }

    function joinTournament(uint256 _tournamentId) public {
        require(
            tournaments[_tournamentId].isActive,
            "Tournament is not active"
        );
        require(
            !tournaments[_tournamentId].hasStarted,
            "Tournament has already started"
        );
        require(
            tournamentEntrants[_tournamentId].length <
                tournaments[_tournamentId].numEntrants,
            "Tournament is full"
        );
        require(
            !isEntrantInTournament[_tournamentId][msg.sender],
            "Already joined the tournament"
        );

        isEntrantInTournament[_tournamentId][msg.sender] = true;
        tournamentEntrants[_tournamentId].push(msg.sender);

        emit TournamentJoined(_tournamentId, msg.sender);
    }

    function startTournament(uint256 _tournamentId) public onlyAdmin {
        require(
            tournaments[_tournamentId].isActive,
            "Tournament is not active"
        );
        require(
            !tournaments[_tournamentId].hasStarted,
            "Tournament has already started"
        );

        tournaments[_tournamentId].hasStarted = true;

        emit TournamentStarted(_tournamentId);
    }

    function fillUpMatchingPool() public payable onlyAdmin {
        require(msg.value > 0, "MVPCLR:fillUpMatchingPool - No value provided");
        emit MatchingPoolDonation(msg.sender, msg.value, roundId);
    }

    function endTournament(
        uint256 _tournamentId,
        address[] memory winners,
        uint8[] memory winnersPercentages
    ) public onlyAdmin {
        require(
            tournaments[_tournamentId].isActive,
            "Tournament is not active"
        );
        require(
            tournaments[_tournamentId].hasStarted,
            "Tournament has not started"
        );
        require(
            winners.length == winnersPercentages.length,
            "Mismatch between winners and percentages"
        );

        uint256 totalDonations = tournaments[_tournamentId].totalDonations;
        uint256 totalPayout = 0;

        // Calculate and set payouts for each winner
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 winnerPayout = (totalDonations * winnersPercentages[i]) /
                100;
            tournamentWinners[_tournamentId][winners[i]] = WinnerInfo({
                amount: winnerPayout,
                hasClaimed: false
            });
            totalPayout += winnerPayout;
        }

        // Calculate and transfer multisig amount
        uint256 multisigAmount = (totalDonations *
            tournaments[_tournamentId].multisigPercentage) / 100;
        payable(multisigAddress).transfer(multisigAmount);

        // Check if total payouts exceed the allocated amount
        uint256 allocatedForWinners = (totalDonations *
            tournaments[_tournamentId].winnersPercentage) / 100;
        require(
            totalPayout <= allocatedForWinners,
            "Payout exceeds allocated amount for winners"
        );

        // Update tournament status
        tournaments[_tournamentId].isActive = false;
        tournaments[_tournamentId].hasStarted = false;
        tournaments[_tournamentId].remainingBalance =
            totalDonations -
            totalPayout -
            multisigAmount;

        emit TournamentEnded(_tournamentId, winners, winnersPercentages);
    }

    function claimReward(uint256 _tournamentId) public {
        WinnerInfo storage winner = tournamentWinners[_tournamentId][
            msg.sender
        ];
        require(winner.amount > 0, "No reward available");
        require(!winner.hasClaimed, "Reward already claimed");

        winner.hasClaimed = true;
        payable(msg.sender).transfer(winner.amount);
    }

    function closeRound(uint256 _roundId, address _winner) public onlyOwner {
        require(
            rounds[_roundId].isActive,
            "MVPCLR: closeRound - Round is not active"
        );
        require(
            _winner == rounds[_roundId].player1 ||
                _winner == rounds[_roundId].player2,
            "MVPCLR: closeRound - Invalid winner address"
        );

        uint256 totalPrize = rounds[_roundId].betAmount * 2;
        payable(_winner).transfer(totalPrize);

        rounds[_roundId].isActive = false;
        emit RoundClosed(_roundId);
    }

    function roundIsClosed() public view returns (bool) {
        return
            roundDuration == 0 ||
            roundStart + roundDuration <= getBlockTimestamp();
    }

    function startRound(
        address _player1Address,
        address _player2Address,
        uint256 _roundDuration,
        uint256 _matchAmount
    ) public payable {
        require(
            _player1Address != address(0) && _player2Address != address(0),
            "MVPCLR: startRound - Addresses cannot be zero"
        );
        require(
            _player1Address != _player2Address,
            "MVPCLR: startRound - Player addresses must be different"
        );
        require(
            !isBlacklisted[msg.sender],
            "MVPCLR: startRound - Sender is blacklisted"
        );
        require(
            roundIsClosed(),
            "MVPCLR: startRound - Previous round not yet closed"
        );
        //require(msg.value == _betAmount * 2, "MVPCLR: startRound - Incorrect ETH amount sent");

        lastActiveRoundId += 1;
        roundId = lastActiveRoundId;
        require(_roundDuration < 31536000, "MVPCLR: round duration too long");
        roundDuration = _roundDuration;
        roundStart = getBlockTimestamp();

        rounds[roundId] = Round({
            player1: _player1Address,
            player2: _player2Address,
            betAmount: _matchAmount,
            isActive: true
        });

        emit RoundStarted(roundStart, roundId, roundDuration);
    }

    function donate(
        uint256[] memory amounts,
        uint256 _tournamentId
    ) public payable {
        require(amounts.length > 0, "CLR:donate - No amounts provided");
        require(tournaments[_tournamentId].isActive, "Tournament not active");

        uint256 totalAmount = 0;
        uint256 tournamentRoundId = currentTournamentRound[_tournamentId];

        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = amounts[i];
            totalAmount += amount;
            require(
                !isBlacklisted[_msgSender()],
                "Sender address is blacklisted"
            );
            emit Donate(_msgSender(), amount, tournamentRoundId);
        }

        require(
            totalAmount == msg.value,
            "CLR:donate - Total amount donated does not match the value sent"
        );
        tournaments[_tournamentId].totalDonations += totalAmount;
    }

    //only designated multisig address can call this function
    function withdrawFunds(uint256 amount) external onlyMultisig {
        require(
            address(this).balance >= amount,
            "Insufficient funds in contract"
        );
        payable(multisigAddress).transfer(amount);
    }

    // receive donation for the matching pool
    receive() external payable {
        require(
            roundStart == 0 || getBlockTimestamp() < roundStart + roundDuration,
            "CLR:receive closed"
        );
        emit MatchingPoolDonation(_msgSender(), msg.value, roundId);
    }

    //Admin & Owner functions

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

    //Modifiers
    modifier onlyAdmin() {
        require(isAdmin[msg.sender] == true, "Not an admin");
        _;
    }

    modifier onlyMultisig() {
        require(msg.sender == multisigAddress, "Not authorized");
        _;
    }
}
