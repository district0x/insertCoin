// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ICMatch.sol";
import "./IC2v2Match.sol";
import "./ICTournament.sol";
import "./IC5v5Match.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract IC is ICMatch, IC2v2Match, ICTournament, IC5v5Match {
    /// @custom:oz-upgrades-unsafe-allow constructor
    function initialize() external initializer {
        __ICBase_init();         // Initialize the base contract
        __ReentrancyGuard_init(); // Initialize ReentrancyGuard
        nextTournamentId = 1;    // Set initial tournament ID
        nextMatchId = 1;         // Set initial match ID
    }

    function withdrawFunds(uint256 amount) external onlyMultisig {
        require(address(this).balance >= amount, "!funds");
        payable(multisigAddress).transfer(amount);
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit MatchingPoolDonation(msg.sender, msg.value, 0);
    }

    
}