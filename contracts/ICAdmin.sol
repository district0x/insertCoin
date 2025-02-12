// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ICBase.sol";

abstract contract ICAdmin is ICBase {
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isBlacklisted;
    uint256 public nextMatchId;

    event AdminAdded(address indexed _admin);
    event AdminRemoved(address indexed _admin);
    event BlacklistedAdded(address indexed _blacklisted);
    event BlacklistedRemoved(address indexed _blacklisted);
    event MatchClosed(uint256 indexed matchId, address indexed winner, uint256 winnerAmount, uint256 multisigAmount, uint256 poolAmount);

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

    function approveToken(address _token, bool _approved) external onlyAdmin {
        require(_token != address(0), "Cannot approve zero address");
        
        if (_approved) {
            require(_validateToken(_token), "Token validation failed");
        }
        
        approvedTokens[_token] = _approved;
        emit TokenApprovalUpdated(_token, _approved);
    }

    function fillUpMatchingPool() public payable onlyAdmin {
        require(msg.value > 0, "No funds");
        matchingPool += msg.value;
        emit MatchingPoolFilled(msg.value);
    }

    function _getNextMatchId() internal returns (uint256) {
        return nextMatchId++;
    }

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }
}