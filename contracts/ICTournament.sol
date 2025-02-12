// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ICAdmin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

abstract contract ICTournament is ICAdmin, ReentrancyGuardUpgradeable {
    struct Tournament {
        uint8 winnersPercentage;
        uint8 multisigPercentage;
        bool isActive;
        bool hasStarted;
        bool isERC20;
        bool hasEntryFee;
        
        uint256 numEntrants;
        uint256 totalDonations;
        uint256 totalTokenDonations;
        uint256 remainingBalance;
        uint256 entryFee;
        IERC20 token;
    }

    struct WinnerInfo {
        uint256 amount;
        bool hasClaimed;
    }

    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => uint256) public currentTournamentRound;
    mapping(uint256 => uint256) public tournamentMatchingPools;
    mapping(uint256 => address[]) public tournamentEntrants;
    mapping(uint256 => mapping(address => bool)) public isEntrantInTournament;
    mapping(uint256 => mapping(address => WinnerInfo)) public tournamentWinners;
    
    uint256 public nextTournamentId;

    event TournamentCreated(uint256 indexed tournamentId, uint256 numEntrants, uint8 winnersPercentage, uint8 multisigPercentage);
    event TournamentJoined(uint256 indexed tournamentId, address indexed entrant);
    event TournamentStarted(uint256 indexed tournamentId);
    event TournamentEnded(uint256 indexed tournamentId, address[] winners, uint8[] winnersPercentages);
    event TokenDonation(address indexed sender, uint256 value, uint256 indexed tournamentId);
    event Donate(address indexed sender, uint256 value, uint256 indexed tournamentId);
 

    function createTournament(
        uint256 _numEntrants, 
        uint8 _winnersPercentage, 
        uint8 _multisigPercentage,
        IERC20 _token,
        uint256 _entryFee
    ) public onlyAdmin {
        uint256 newTournamentId = nextTournamentId++;
        bool isERC20Tournament = address(_token) != address(0);
        
        if (isERC20Tournament) {
            require(approvedTokens[address(_token)], "Token not approved");
        }

        tournaments[newTournamentId] = Tournament({
            numEntrants: _numEntrants,
            totalDonations: 0,
            totalTokenDonations: 0,
            remainingBalance: 0,
            winnersPercentage: _winnersPercentage,
            multisigPercentage: _multisigPercentage,
            isActive: true,
            hasStarted: false,
            isERC20: isERC20Tournament,
            token: _token,
            entryFee: _entryFee,
            hasEntryFee: _entryFee > 0
        });

        currentTournamentRound[newTournamentId] = 1;
        emit TournamentCreated(newTournamentId, _numEntrants, _winnersPercentage, _multisigPercentage);
    }

    function joinTournament(uint256 _tournamentId) public payable nonReentrant {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(!tournament.hasStarted, "Started");
        require(tournamentEntrants[_tournamentId].length < tournament.numEntrants, "Full");
        require(!isEntrantInTournament[_tournamentId][msg.sender], "Already joined");

        if (tournament.hasEntryFee) {
            if (tournament.isERC20) {
                require(msg.value == 0, "ETH not accepted for ERC20 tournaments");
                require(tournament.token.transferFrom(msg.sender, address(this), tournament.entryFee), "ERC20 transfer failed");
                tournament.totalTokenDonations += tournament.entryFee;
            } else {
                require(msg.value == tournament.entryFee, "Incorrect ETH amount");
                tournament.totalDonations += msg.value;
            }
        } else {
            require(msg.value == 0, "No entry fee required");
        }

        isEntrantInTournament[_tournamentId][msg.sender] = true;
        tournamentEntrants[_tournamentId].push(msg.sender);
        emit TournamentJoined(_tournamentId, msg.sender);
    }

    function allocateMatchingPoolToTournament(uint256 _tournamentId) public onlyAdmin {
        require(_tournamentId > 0 && _tournamentId <= nextTournamentId, "Tournament doesn't exist");
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Tournament not active");
        
        // Always add ETH matching pool if available
        if (matchingPool > 0) {
            tournament.totalDonations += matchingPool;
            emit MatchingPoolDonation(msg.sender, matchingPool, _tournamentId);
            matchingPool = 0;
        }
        
        // If tournament accepts ERC20, also add token matching pool if available
        if (tournament.isERC20) {
            uint256 tokenMatchingPool = tournamentMatchingPools[_tournamentId];
            if (tokenMatchingPool > 0) {
                tournament.totalTokenDonations += tokenMatchingPool;
                emit TokenDonation(msg.sender, tokenMatchingPool, _tournamentId);
                tournamentMatchingPools[_tournamentId] = 0;
            }
        }
    }

    function startTournament(uint256 _tournamentId) public onlyAdmin {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(!tournament.hasStarted, "Already started");
        require(tournamentEntrants[_tournamentId].length >= 2, "Not enough participants");

        tournament.hasStarted = true;
        emit TournamentStarted(_tournamentId);
    }

    function endTournament(
        uint256 _tournamentId, 
        address[] memory winners, 
        uint8[] memory winnersPercentages
    ) public onlyAdmin nonReentrant {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Tournament not active");
        require(tournament.hasStarted, "Tournament not started");
        require(winners.length == winnersPercentages.length, "Array length mismatch");

        // Handle prize distribution based on tournament type
        if (tournament.isERC20) {
            // For ERC20 tournaments, only distribute token balance
            uint256 totalTokens = tournament.totalTokenDonations;
            uint256 tokenMultisigAmount = (totalTokens * tournament.multisigPercentage) / 100;
            
            require(tournament.token.transfer(multisigAddress, tokenMultisigAmount), "Multisig transfer failed");
            
            for (uint256 i = 0; i < winners.length; i++) {
                uint256 winnerPayout = ((totalTokens - tokenMultisigAmount) * winnersPercentages[i]) / 100;
                require(tournament.token.transfer(winners[i], winnerPayout), "Winner transfer failed");
                tournamentWinners[_tournamentId][winners[i]] = WinnerInfo({
                    amount: winnerPayout,
                    hasClaimed: true
                });
            }
        } else {
            // For ETH tournaments, only distribute ETH balance
            uint256 totalEth = tournament.totalDonations;
            uint256 ethMultisigAmount = (totalEth * tournament.multisigPercentage) / 100;
            
            payable(multisigAddress).transfer(ethMultisigAmount);
            
            for (uint256 i = 0; i < winners.length; i++) {
                uint256 winnerPayout = ((totalEth - ethMultisigAmount) * winnersPercentages[i]) / 100;
                payable(winners[i]).transfer(winnerPayout);
                tournamentWinners[_tournamentId][winners[i]] = WinnerInfo({
                    amount: winnerPayout,
                    hasClaimed: true
                });
            }
        }

        // Transfer any mismatched donations to the matching pool
        if (tournament.isERC20 && tournament.totalDonations > 0) {
            matchingPool += tournament.totalDonations; // ETH donations in ERC20 tournament go to matching pool
        } else if (!tournament.isERC20 && tournament.totalTokenDonations > 0) {
            tournamentMatchingPools[_tournamentId] += tournament.totalTokenDonations; // Token donations in ETH tournament go to token matching pool
        }

        tournament.isActive = false;
        tournament.hasStarted = false;
        
        emit TournamentEnded(_tournamentId, winners, winnersPercentages);
    }

    function fillUpERC20MatchingPool(uint256 _tournamentId, uint256 _amount, IERC20 _token) public {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isERC20, "Tournament is not ERC20");
        require(address(_token) == address(tournament.token), "Invalid token");
        require(_token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        tournamentMatchingPools[_tournamentId] += _amount;
        emit MatchingPoolFilled(_amount);
    }

    function donate(uint256 _tournamentId) public payable nonReentrant {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(!isBlacklisted[msg.sender], "Blacklisted");
        require(msg.value > 0, "No amount sent");

        tournament.totalDonations += msg.value;
        emit Donate(msg.sender, msg.value, _tournamentId);
    }

    function donateTokens(uint256 _tournamentId, uint256 _amount) public nonReentrant {
        Tournament storage tournament = tournaments[_tournamentId];
        require(tournament.isActive, "Not active");
        require(!isBlacklisted[msg.sender], "Blacklisted");
        require(tournament.isERC20, "Tournament does not accept ERC20");
        require(tournament.token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        tournament.totalTokenDonations += _amount;
        emit TokenDonation(msg.sender, _amount, _tournamentId);
    }
}