// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ICAdmin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract IC2v2Match is ICAdmin {
    struct Match2v2 {
        address player1;
        address player2;
        address teamAPlayer2;
        address teamBPlayer2;
        uint256 player1Amount;
        uint256 player2Amount;
        uint256 totalAmount;
        uint256 donatedAmount;
        bool isOpen;
        bool isERC20;
        IERC20 token;
    }

    mapping(uint256 => Match2v2) public matches2v2;
    
    event Team2v2MatchStarted(uint256 indexed matchId, address indexed player1, uint256 matchAmount);
    event TeamPlayerJoined(uint256 indexed matchId, address indexed player, bool isTeamA);

    function start2v2Match(uint256 _matchAmount, IERC20 _token) external payable {
        require(_matchAmount > 0, "Amount must be greater than 0");
        
        bool isERC20Match = address(_token) != address(0);
        
        if (isERC20Match) {
            require(msg.value == 0, "ETH not accepted for ERC20 matches");
            require(approvedTokens[address(_token)], "Token not approved");
            require(_token.transferFrom(msg.sender, address(this), _matchAmount), "ERC20 transfer failed");
        } else {
            require(msg.value == _matchAmount, "Incorrect ETH amount sent");
        }

        uint256 matchId = _getNextMatchId();
        matches2v2[matchId] = Match2v2({
            player1: msg.sender,
            player2: address(0),
            teamAPlayer2: address(0),
            teamBPlayer2: address(0),
            player1Amount: _matchAmount,
            player2Amount: 0,
            totalAmount: _matchAmount,
            donatedAmount: 0,
            isOpen: true,
            isERC20: isERC20Match,
            token: _token
        });

        emit Team2v2MatchStarted(matchId, msg.sender, _matchAmount);
    }

    function join2v2Team(uint256 _matchId, bool _isTeamA) external virtual payable {
        Match2v2 memory matchInfo = matches2v2[_matchId];
        require(matchInfo.isOpen, "Match is closed");
        
        uint256 requiredAmount = matchInfo.player1Amount;
        
        if (_isTeamA) {
            require(
                matchInfo.teamAPlayer2 == address(0) && 
                msg.sender != matchInfo.player1, 
                "Team A invalid"
            );
        } else {
            require(
                (matchInfo.player2 == address(0) || matchInfo.teamBPlayer2 == address(0)) &&
                msg.sender != matchInfo.player2 && 
                msg.sender != matchInfo.teamBPlayer2, 
                "Team B invalid"
            );
        }
        
        if (matchInfo.isERC20) {
            require(msg.value == 0 && matchInfo.token.transferFrom(msg.sender, address(this), requiredAmount), "Payment failed");
        } else {
            require(msg.value == requiredAmount, "Invalid ETH amount");
        }
        
        Match2v2 storage matchStorage = matches2v2[_matchId];
        if (_isTeamA) {
            matchStorage.teamAPlayer2 = msg.sender;
        } else {
            if (matchStorage.player2 == address(0)) {
                matchStorage.player2 = msg.sender;
            } else {
                matchStorage.teamBPlayer2 = msg.sender;
            }
        }
        
        matchStorage.totalAmount += requiredAmount;
        
        if (matchStorage.player2 != address(0) && 
            matchStorage.teamAPlayer2 != address(0) && 
            matchStorage.teamBPlayer2 != address(0)) {
            matchStorage.isOpen = false;
        }
        
        emit TeamPlayerJoined(_matchId, msg.sender, _isTeamA);
    }

    function close2v2Match(uint256 _matchId, address _winningTeamPlayer) external onlyAdmin {
        Match2v2 storage matchInfo = matches2v2[_matchId];
        bool isTeamAWinner = (_winningTeamPlayer == matchInfo.player1 || _winningTeamPlayer == matchInfo.teamAPlayer2);
        bool isTeamBWinner = (_winningTeamPlayer == matchInfo.player2 || _winningTeamPlayer == matchInfo.teamBPlayer2);
        
        require(isTeamAWinner || isTeamBWinner, "Invalid winner");

        uint256 totalAmount = matchInfo.totalAmount;
        uint256 winnerAmount = (totalAmount * 90) / 100;
        uint256 multisigAmount = (totalAmount * 5) / 100;
        uint256 poolAmount = totalAmount - winnerAmount - multisigAmount;

        uint256 perPlayerAmount = winnerAmount / 2;
        
        if (matchInfo.isERC20) {
            if (isTeamAWinner) {
                require(matchInfo.token.transfer(matchInfo.player1, perPlayerAmount), "Winner 1 transfer failed");
                require(matchInfo.token.transfer(matchInfo.teamAPlayer2, perPlayerAmount), "Winner 2 transfer failed");
            } else {
                require(matchInfo.token.transfer(matchInfo.player2, perPlayerAmount), "Winner 1 transfer failed");
                require(matchInfo.token.transfer(matchInfo.teamBPlayer2, perPlayerAmount), "Winner 2 transfer failed");
            }
            require(matchInfo.token.transfer(multisigAddress, multisigAmount), "Multisig transfer failed");
        } else {
            if (isTeamAWinner) {
                payable(matchInfo.player1).transfer(perPlayerAmount);
                payable(matchInfo.teamAPlayer2).transfer(perPlayerAmount);
            } else {
                payable(matchInfo.player2).transfer(perPlayerAmount);
                payable(matchInfo.teamBPlayer2).transfer(perPlayerAmount);
            }
            payable(multisigAddress).transfer(multisigAmount);
        }

        matchingPool += poolAmount;
        emit MatchClosed(_matchId, _winningTeamPlayer, winnerAmount, multisigAmount, poolAmount);
    }
}