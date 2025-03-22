// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./utils/ERC2771Simple.sol";


contract Vault is UUPSUpgradeable, OwnableUpgradeable, ERC2771Simple {
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

    function initialize(address _token, address initialOwner, uint256 _rewardRatePerDay, address _trustedForwarder) public initializer{
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ERC2771Simple_init(_trustedForwarder);
        tacoCoin = IERC20(_token);
        rewardRatePerDay = _rewardRatePerDay;
    }

    function msgSender() internal view override returns (address sender) {
        return ERC2771Simple.msgSender();
    }

    function msgData() internal view override returns (bytes calldata) {
        return ERC2771Simple.msgData();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

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

    function withdraw(uint256 amount) external {
        address sender = msgSender();
        if (deposits[sender].amount < amount) {
            revert InsufficientBalance(sender, deposits[sender].amount, amount);
        }

        deposits[sender].amount -= amount;

        tacoCoin.transfer(sender, amount);

        emit Withdrawal(sender, amount);
    }

    function claimRewards() external {
        address sender = msgSender();
        require(rewardDistributor != address(0), "Reward distributor not set");
        uint256 rewardAmount = calculateRewards(sender);
        require(rewardAmount > 0, "No rewards available");
        require(tacoCoin.balanceOf(address(this)) >= rewardAmount, "Insufficient rewards");

        tacoCoin.transfer(sender, rewardAmount);
        deposits[sender].depositTime = block.timestamp; // Обновляем время последнего получения награды

        emit RewardsClaimed(sender, rewardAmount);
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