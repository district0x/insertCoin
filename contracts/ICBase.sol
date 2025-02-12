// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

abstract contract ICBase is OwnableUpgradeable {
    enum MatchState {
        OPEN,
        IN_PROGRESS,
        COMPLETED,
        CANCELLED
    }

    uint256 public matchingPool;
    address public multisigAddress;
    mapping(address => bool) public approvedTokens;

    // Token validation parameters
    uint8 public constant MIN_DECIMALS = 6;
    uint8 public constant MAX_DECIMALS = 18;

    event TokenApprovalUpdated(address indexed token, bool approved);
    event TokenValidationFailed(address indexed token, string reason);
    event MatchingPoolFilled(uint256 amount);
    event MatchingPoolDonation(address indexed sender, uint256 value, uint256 roundId);
    
    function __ICBase_init() internal onlyInitializing {
        __Ownable_init();
        multisigAddress = msg.sender;
    }

    function setMultisigAddress(address _multisigAddress) external onlyMultisig {
        multisigAddress = _multisigAddress;
    }

    function _validateToken(address _token) internal returns (bool) {
        try IERC20Metadata(_token).decimals() returns (uint8 decimals) {
            if (decimals < MIN_DECIMALS || decimals > MAX_DECIMALS) {
                emit TokenValidationFailed(_token, "Invalid decimals");
                return false;
            }
        } catch {
            emit TokenValidationFailed(_token, "Cannot fetch decimals");
            return false;
        }

        try IERC20(_token).totalSupply() returns (uint256) {
            return true;
        } catch {
            emit TokenValidationFailed(_token, "Invalid ERC20 implementation");
            return false;
        }
    }

    modifier onlyMultisig() {
        require(msg.sender == multisigAddress, "Not authorized");
        _;
    }
}