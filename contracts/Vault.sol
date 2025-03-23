// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC2771Simple} from "./utils/ERC2771Simple.sol";

/// @title Vault - A staking vault contract with meta-transactions, upgradability, and reward distribution
/// @notice Users can deposit tokens using EIP-2612 permits and claim daily rewards based on staking time
/// @author Vladimir Gorenkov
contract Vault is UUPSUpgradeable, AccessControlUpgradeable, ERC2771Simple {
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

    /// @notice Initializes the vault contract
    /// @param _token Address of the ERC20 token to be staked
    /// @param initialOwner Address that will be granted admin and role permissions
    /// @param _rewardRatePerDay Daily reward rate (in percentage)
    /// @param _trustedForwarder Address of the trusted forwarder for meta-transactions
    function initialize(address _token, address initialOwner, uint256 _rewardRatePerDay, address _trustedForwarder) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ERC2771Simple_init(_trustedForwarder);

        tacoCoin = IERC20(_token);
        rewardRatePerDay = _rewardRatePerDay;

        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(REWARD_MANAGER_ROLE, initialOwner);
        _grantRole(UPGRADER_ROLE, initialOwner);
    }

    /// @notice Returns the original message sender (used for meta-transactions)
    function msgSender() internal view override returns (address sender) {
        return ERC2771Simple.msgSender();
    }

    /// @notice Returns the original message data (used for meta-transactions)
    function msgData() internal view override returns (bytes calldata) {
        return ERC2771Simple.msgData();
    }

    /// @notice Authorizes contract upgrade via UUPS pattern
    /// @param newImplementation Address of the new implementation contract
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    /// @notice Deposits tokens using a permit signature
    /// @param amount The amount of tokens to deposit
    /// @param deadline Timestamp until the permit is valid
    /// @param v Signature param
    /// @param r Signature param
    /// @param s Signature param
    function deposit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        if (amount == 0) {
            revert ZeroAmount();
        }

        address sender = msgSender();

        IERC20Permit(address(tacoCoin)).permit(sender, address(this), amount, deadline, v, r, s);
        tacoCoin.transferFrom(sender, address(this), amount);

        deposits[sender].amount = amount;
        deposits[sender].depositTime = block.timestamp;

        emit Deposited(sender, amount);
    }

    /// @notice Withdraws a specified amount of tokens from the vault
    /// @param amount The amount of tokens to withdraw
    function withdraw(uint256 amount) external {
        address sender = msgSender();
        if (deposits[sender].amount < amount) {
            revert InsufficientBalance(sender, deposits[sender].amount, amount);
        }

        deposits[sender].amount -= amount;
        tacoCoin.transfer(sender, amount);

        emit Withdrawal(sender, amount);
    }

    /// @notice Claims staking rewards based on time since last claim
    function claimRewards() external {
        address sender = msgSender();
        uint256 rewardAmount = calculateRewards(sender);
        require(rewardAmount > 0, "No rewards available");
        require(tacoCoin.balanceOf(address(this)) >= rewardAmount, "Insufficient rewards");

        deposits[sender].depositTime = block.timestamp;
        tacoCoin.transfer(sender, rewardAmount);

        emit RewardsClaimed(sender, rewardAmount);
    }

    /// @notice Calculates rewards for a given user based on staked amount and time
    /// @param user Address of the user
    /// @return The amount of reward tokens earned
    function calculateRewards(address user) public view returns (uint256) {
        uint256 daysStaked = (block.timestamp - deposits[user].depositTime) / 1 days;
        return (deposits[user].amount * daysStaked * rewardRatePerDay) / 100;
    }

    /// @notice Updates the daily reward rate
    /// @param _newRate New reward rate in percentage
    function setRewardRate(uint256 _newRate) external onlyRole(REWARD_MANAGER_ROLE) {
        rewardRatePerDay = _newRate;
    }

    /// @notice Allows admin to withdraw unused reward tokens from the contract
    /// @param recipient Address to receive the tokens
    /// @param amount Amount of tokens to withdraw
    function withdrawUnusedRewards(address recipient, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tacoCoin.balanceOf(address(this)) >= amount, "Insufficient balance");
        tacoCoin.transfer(recipient, amount);
    }
}
