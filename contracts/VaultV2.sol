// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./utils/ERC2771Simple.sol";

/// @title VaultV2 - Upgradeable staking vault with meta-transaction support
/// @notice This is version 2 of the Vault contract, supporting upgrades and role-based access control
/// @author Vladimir Gorenkov
contract VaultV2 is UUPSUpgradeable, AccessControlUpgradeable, ERC2771Simple {
    IERC20 public tacoCoin;
    uint256 public rewardRatePerDay;

    struct Deposit {
        uint256 amount;
        uint256 depositTime;
    }

    mapping(address => Deposit) public deposits;

    // --- Roles ---
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    error ZeroAmount();
    error InsufficientBalance(address user, uint256 available, uint256 required);

    event Deposited(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);

    /// @notice Initializes the contract with token, roles, and trusted forwarder
    /// @param _token The ERC20 token address
    /// @param initialOwner The initial admin and role grantee
    /// @param _rewardRatePerDay Daily reward rate (percentage)
    /// @param _trustedForwarder Address of the trusted forwarder for meta-transactions
    function initialize(
        address _token,
        address initialOwner,
        uint256 _rewardRatePerDay,
        address _trustedForwarder
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC2771Simple_init(_trustedForwarder);

        tacoCoin = IERC20(_token);
        rewardRatePerDay = _rewardRatePerDay;

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(REWARD_MANAGER_ROLE, initialOwner);
        _grantRole(UPGRADER_ROLE, initialOwner);
    }

    /// @notice Returns the version identifier for this contract implementation
    /// @return The version string ("V2")
    function getVersion() external pure returns (string memory) {
        return "V2";
    }

    /// @notice Returns the actual sender of the message (supports meta-transactions)
    function msgSender() internal view override returns (address sender) {
        return ERC2771Simple.msgSender();
    }

    /// @notice Returns the full calldata of the original message (supports meta-transactions)
    function msgData() internal view override returns (bytes calldata) {
        return ERC2771Simple.msgData();
    }

    /// @notice Authorizes contract upgrade; only callable by UPGRADER_ROLE
    /// @param newImplementation The address of the new implementation contract
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
