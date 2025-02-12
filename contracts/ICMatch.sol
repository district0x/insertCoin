// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ICAdmin.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract ICMatch is ICAdmin {
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

    mapping(uint256 => Match) public matches;
    mapping(address => uint256) public matchDonorContributions;
    mapping(address => bool) public isPatron;

    event MatchStarted(uint256 indexed matchId, address indexed player1, uint256 matchAmount);
    event MatchJoined(uint256 indexed matchId, address indexed player2);
    event MatchDonation(uint256 indexed matchId, address indexed donor, uint256 amount);

    function startMatch(uint256 _matchAmount, IERC20 _token) external payable {
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
        matches[matchId] = Match({
            player1: msg.sender,
            player2: address(0),
            player1Amount: _matchAmount,
            player2Amount: 0,
            totalAmount: _matchAmount,
            donatedAmount: 0,
            isOpen: true,
            isERC20: isERC20Match,
            token: _token
        });

        emit MatchStarted(matchId, msg.sender, _matchAmount);
    }

    function joinMatch(uint256 _matchId) external payable {
        Match storage matchInfo = matches[_matchId];
        require(matchInfo.isOpen, "Match is closed");
        require(msg.sender != matchInfo.player1, "Player already in match");

        if (matchInfo.isERC20) {
            require(msg.value == 0, "ETH not accepted for ERC20 matches");
            require(matchInfo.token.transferFrom(msg.sender, address(this), matchInfo.player1Amount), "ERC20 transfer failed");
        } else {
            require(msg.value == matchInfo.player1Amount, "Incorrect ETH amount");
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
            require(matchInfo.token.transfer(_winner, winnerAmount), "Winner transfer failed");
            require(matchInfo.token.transfer(multisigAddress, multisigAmount), "Multisig transfer failed");
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

    function getMatchDonorContribution(address _donor) external view returns (uint256) {
        return matchDonorContributions[_donor];
    }

    function getMatchToken(uint256 _matchId) external view returns (address) {
        return address(matches[_matchId].token);
    }
}