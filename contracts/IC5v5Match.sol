// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ICAdmin.sol";

abstract contract IC5v5Match is ICAdmin {
    struct Match5v5 {
        address player1;          // First player Team A (not captain)
        address teamAPlayer2;
        address teamAPlayer3;
        address teamAPlayer4;
        address teamAPlayer5;
        address player2;          // First player Team B (not captain)
        address teamBPlayer2;
        address teamBPlayer3;
        address teamBPlayer4;
        address teamBPlayer5;
        uint256 player1Amount;
        uint256 totalAmount;
        IERC20 token;
        bool isERC20;
        bool isOpen;
    }

    // Storage
    mapping(uint256 => Match5v5) public matches5v5;

    // Events
    event Match5v5Started(
        uint256 indexed matchId,
        address indexed firstPlayer,    // Changed from teamACaptain
        uint256 amount,
        address token,
        bool isERC20
    );

    event TeamJoined(
        uint256 indexed matchId,
        bool indexed isTeamA,
        address indexed player,
        uint8 playerPosition    // 1-5 = team members (no captain designation)
    );

    event MatchReady(
        uint256 indexed matchId,
        uint256 totalPrizePool
    );

    event Match5v5Closed(
        uint256 indexed matchId,
        address indexed admin,          // Added admin who closed the match
        bool indexed winningTeamA,      // Identifies winning team
        uint256 totalPrizePool,
        uint256 winnerShare,           // 90% of total
        uint256 multisigShare,         // 5% of total
        uint256 poolShare              // 5% of total
    );

    event WinnerPayout(
        uint256 indexed matchId,
        address indexed player,
        uint256 amount,
        uint8 teamPosition             // Player's position in team
    );

    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    event MatchStateChanged(
        uint256 indexed matchId,
        uint8 indexed oldState,
        uint8 indexed newState
    );

    // Helper Functions
    function isTeamMember(uint256 _matchId, address _player, bool _isTeamA) public view returns (bool) {
        Match5v5 storage gameMatch = matches5v5[_matchId];
        if (_isTeamA) {
            return (_player == gameMatch.player1 ||
                    _player == gameMatch.teamAPlayer2 ||
                    _player == gameMatch.teamAPlayer3 ||
                    _player == gameMatch.teamAPlayer4 ||
                    _player == gameMatch.teamAPlayer5);
        } else {
            return (_player == gameMatch.player2 ||
                    _player == gameMatch.teamBPlayer2 ||
                    _player == gameMatch.teamBPlayer3 ||
                    _player == gameMatch.teamBPlayer4 ||
                    _player == gameMatch.teamBPlayer5);
        }
    }

    function isTeamFull(uint256 _matchId, bool _isTeamA) public view returns (bool) {
        Match5v5 storage gameMatch = matches5v5[_matchId];
        if (_isTeamA) {
            return (gameMatch.player1 != address(0) &&
                    gameMatch.teamAPlayer2 != address(0) &&
                    gameMatch.teamAPlayer3 != address(0) &&
                    gameMatch.teamAPlayer4 != address(0) &&
                    gameMatch.teamAPlayer5 != address(0));
        } else {
            return (gameMatch.player2 != address(0) &&
                    gameMatch.teamBPlayer2 != address(0) &&
                    gameMatch.teamBPlayer3 != address(0) &&
                    gameMatch.teamBPlayer4 != address(0) &&
                    gameMatch.teamBPlayer5 != address(0));
        }
    }

    function getTeamMembers(uint256 _matchId, bool _isTeamA) public view returns (address[5] memory) {
        Match5v5 storage gameMatch = matches5v5[_matchId];
        if (_isTeamA) {
            return [
                gameMatch.player1,
                gameMatch.teamAPlayer2,
                gameMatch.teamAPlayer3,
                gameMatch.teamAPlayer4,
                gameMatch.teamAPlayer5
            ];
        } else {
            return [
                gameMatch.player2,
                gameMatch.teamBPlayer2,
                gameMatch.teamBPlayer3,
                gameMatch.teamBPlayer4,
                gameMatch.teamBPlayer5
            ];
        }
    }

    function close5v5Match(uint256 _matchId, address _winner) 
        external 
        onlyAdmin 
    {
        require(_matchId < nextMatchId, "Invalid match ID");
        require(_winner != address(0), "Invalid winner address");
        
        Match5v5 storage gameMatch = matches5v5[_matchId];
        require(!gameMatch.isOpen, "Match still open");
        require(gameMatch.totalAmount > 0, "Match not funded");
        
        // Verify winner is a member of either team
        bool isTeamAWinner = isTeamMember(_matchId, _winner, true);
        bool isTeamBWinner = isTeamMember(_matchId, _winner, false);
        require(isTeamAWinner || isTeamBWinner, "Invalid winner");

        uint256 totalAmount = gameMatch.totalAmount;
        uint256 winnerAmount = (totalAmount * 90) / 100;
        uint256 multisigAmount = (totalAmount * 5) / 100;
        uint256 poolAmount = totalAmount - winnerAmount - multisigAmount;
        
        // Get winning team members
        address[5] memory winners = getTeamMembers(_matchId, isTeamAWinner);
        uint256 perPlayerAmount = winnerAmount / 5;

        // Distribute winnings
        if (gameMatch.isERC20) {
            for (uint8 i = 0; i < 5; i++) {
                require(
                    gameMatch.token.transfer(winners[i], perPlayerAmount),
                    "Winner transfer failed"
                );
                emit WinnerPayout(_matchId, winners[i], perPlayerAmount, i + 1);
            }
            require(
                gameMatch.token.transfer(multisigAddress, multisigAmount),
                "Multisig transfer failed"
            );
        } else {
            for (uint8 i = 0; i < 5; i++) {
                payable(winners[i]).transfer(perPlayerAmount);
                emit WinnerPayout(_matchId, winners[i], perPlayerAmount, i + 1);
            }
            payable(multisigAddress).transfer(multisigAmount);
        }

        matchingPool += poolAmount;
        
        emit Match5v5Closed(
            _matchId,
            msg.sender,           // Admin who closed the match
            isTeamAWinner,
            totalAmount,
            winnerAmount,
            multisigAmount,
            poolAmount
        );
    }

    function start5v5Match(uint256 _amount, address _token) 
        external 
        payable 
    {
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= type(uint256).max / 100, "Amount too large");
        
        if (_token != address(0)) {
            require(approvedTokens[_token], "Token not approved");
            require(msg.value == 0, "ETH not accepted with tokens");
            
            IERC20 token = IERC20(_token);
            uint256 balanceBefore = token.balanceOf(address(this));
            require(
                token.transferFrom(msg.sender, address(this), _amount),
                "Transfer failed"
            );
            require(
                token.balanceOf(address(this)) == balanceBefore + _amount,
                "Invalid transfer amount"
            );
        } else {
            require(msg.value == _amount, "Invalid ETH amount");
        }

        uint256 matchId = _getNextMatchId();
        matches5v5[matchId] = Match5v5({
            player1: msg.sender,
            teamAPlayer2: address(0),
            teamAPlayer3: address(0),
            teamAPlayer4: address(0),
            teamAPlayer5: address(0),
            player2: address(0),
            teamBPlayer2: address(0),
            teamBPlayer3: address(0),
            teamBPlayer4: address(0),
            teamBPlayer5: address(0),
            player1Amount: _amount,     // This is the amount each player must contribute
            totalAmount: _amount,       // This starts with just the first player's amount
            token: IERC20(_token),
            isERC20: _token != address(0),
            isOpen: true
        });

        emit Match5v5Started(
            matchId,
            msg.sender,
            _amount,
            _token,
            _token != address(0)
        );
    }

    function join5v5Team(uint256 _matchId, bool _isTeamA) 
        external 
        payable 
    {
        require(_matchId < nextMatchId, "Invalid match ID");
        
        Match5v5 storage gameMatch = matches5v5[_matchId];
        require(gameMatch.isOpen, "Match not open");
        require(!isTeamMember(_matchId, msg.sender, true) && !isTeamMember(_matchId, msg.sender, false), "Already in match");

        // Each player must contribute the same amount as player1
        uint256 requiredAmount = gameMatch.player1Amount;
        
        if (gameMatch.isERC20) {
            require(msg.value == 0, "ETH not accepted for ERC20 matches");
            require(
                gameMatch.token.transferFrom(msg.sender, address(this), requiredAmount),
                "Token transfer failed"
            );
        } else {
            require(msg.value == requiredAmount, "Invalid ETH amount");
        }

        uint8 position;
        if (_isTeamA) {
            require(!isTeamFull(_matchId, true), "Team A is full");
            if (gameMatch.teamAPlayer2 == address(0)) {
                gameMatch.teamAPlayer2 = msg.sender;
                position = 2;
            } else if (gameMatch.teamAPlayer3 == address(0)) {
                gameMatch.teamAPlayer3 = msg.sender;
                position = 3;
            } else if (gameMatch.teamAPlayer4 == address(0)) {
                gameMatch.teamAPlayer4 = msg.sender;
                position = 4;
            } else if (gameMatch.teamAPlayer5 == address(0)) {
                gameMatch.teamAPlayer5 = msg.sender;
                position = 5;
            }
        } else {
            require(!isTeamFull(_matchId, false), "Team B is full");
            if (gameMatch.player2 == address(0)) {
                gameMatch.player2 = msg.sender;
                position = 1;
            } else if (gameMatch.teamBPlayer2 == address(0)) {
                gameMatch.teamBPlayer2 = msg.sender;
                position = 2;
            } else if (gameMatch.teamBPlayer3 == address(0)) {
                gameMatch.teamBPlayer3 = msg.sender;
                position = 3;
            } else if (gameMatch.teamBPlayer4 == address(0)) {
                gameMatch.teamBPlayer4 = msg.sender;
                position = 4;
            } else if (gameMatch.teamBPlayer5 == address(0)) {
                gameMatch.teamBPlayer5 = msg.sender;
                position = 5;
            }
        }

        // Add this player's contribution to the total
        gameMatch.totalAmount += requiredAmount;

        emit TeamJoined(_matchId, _isTeamA, msg.sender, position);

        // Check if both teams are full
        if (isTeamFull(_matchId, true) && isTeamFull(_matchId, false)) {
            gameMatch.isOpen = false;
            emit MatchReady(_matchId, gameMatch.totalAmount);
        }
    }

    // Emergency functions
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_to != address(0), "Invalid address");
        if (_token == address(0)) {
            payable(_to).transfer(_amount);
        } else {
            require(IERC20(_token).transfer(_to, _amount), "Transfer failed");
        }
        emit EmergencyWithdraw(_token, _to, _amount);
    }
} 