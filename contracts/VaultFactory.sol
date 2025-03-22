// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Vault.sol";

contract VaultFactory {
    address public immutable vaultImplementation;
    address public immutable trustedForwarder;
    address[] public allVaults;

    event VaultCreated(address indexed newVault, address indexed owner, address tacoCoin, uint256 rewardRate);

    constructor(address _vaultImplementation, address _trustedForwarder) {
        require(_vaultImplementation != address(0), "Invalid implementation");
        vaultImplementation = _vaultImplementation;
        trustedForwarder = _trustedForwarder;
    }

    function createVault(address tacoCoin, uint256 rewardRate) external returns (address) {
        address newVault = Clones.clone(vaultImplementation);
        Vault(newVault).initialize(tacoCoin, msg.sender, rewardRate, trustedForwarder);

        allVaults.push(newVault);
        emit VaultCreated(newVault, msg.sender, tacoCoin, rewardRate);
        return newVault;
    }

    function getVaults() external view returns (address[] memory) {
        return allVaults;
    }
} 
