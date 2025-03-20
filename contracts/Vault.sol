// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Vault is UUPSUpgradeable, OwnableUpgradeable{
    IERC20 public tacoCoin;
    address public rewardDistributor;
    uint256 public rewardRatePerDay; // Процент наград в день

    struct Deposit {
        uint256 amount;
        uint256 depositTime;
    }

    mapping(address => Deposit) public deposits;

    error ZeroAmount();
    error InsufficientBalance(address user, uint256 available, uint256 required);

    event Deposited(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);

    function initialize(address _token, address initialOwner, uint256 _rewardRatePerDay) public initializer{
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        tacoCoin = IERC20(_token);
        rewardRatePerDay = _rewardRatePerDay;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function deposit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        if (amount == 0) {
            revert ZeroAmount();
        }

        IERC20Permit(address(tacoCoin)).permit(msg.sender, address(this), amount, deadline, v, r, s);

        tacoCoin.transferFrom(msg.sender, address(this), amount);

        deposits[msg.sender].amount = amount;
        deposits[msg.sender].depositTime = block.timestamp;

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        if (deposits[msg.sender].amount < amount) {
            revert InsufficientBalance(msg.sender, deposits[msg.sender].amount, amount);
        }

        deposits[msg.sender].amount -= amount;

        tacoCoin.transfer(msg.sender, amount);

        emit Withdrawal(msg.sender, amount);
    }

    function claimRewards() external {
        require(rewardDistributor != address(0), "Reward distributor not set");
        uint256 rewardAmount = calculateRewards(msg.sender);
        require(rewardAmount > 0, "No rewards available");
        require(tacoCoin.balanceOf(address(this)) >= rewardAmount, "Insufficient rewards");

        tacoCoin.transfer(msg.sender, rewardAmount);
        deposits[msg.sender].depositTime = block.timestamp; // Обновляем время последнего получения награды

        emit RewardsClaimed(msg.sender, rewardAmount);
    }

    function calculateRewards(address user) public view returns (uint256) {
        uint256 daysStaked = (block.timestamp - deposits[user].depositTime) / 1 days;
        return (deposits[user].amount * daysStaked * rewardRatePerDay) / 100;
    }

    function setRewardRate(uint256 _newRate) external onlyOwner {
        rewardRatePerDay = _newRate;
    }

    function withdrawUnusedRewards(address recipient, uint256 amount) external onlyOwner {
        require(tacoCoin.balanceOf(address(this)) >= amount, "Insufficient balance");
        tacoCoin.transfer(recipient, amount);
    }
}