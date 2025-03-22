// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Vault.sol";

/// @title VaultFactory - Factory contract for creating minimal proxy instances of the Vault contract
/// @notice Allows creation of lightweight upgradeable Vaults using the EIP-1167 clone pattern
/// @author Vladimir Gorenkov
contract VaultFactory {
    address public immutable vaultImplementation;
    address public immutable trustedForwarder;
    address[] public allVaults;

    event VaultCreated(address indexed newVault, address indexed owner, address tacoCoin, uint256 rewardRate);

    /// @notice Initializes the factory with Vault implementation and forwarder
    /// @param _vaultImplementation Address of the deployed Vault implementation contract
    /// @param _trustedForwarder Address of the trusted forwarder for meta-transactions
    constructor(address _vaultImplementation, address _trustedForwarder) {
        require(_vaultImplementation != address(0), "Invalid implementation");
        vaultImplementation = _vaultImplementation;
        trustedForwarder = _trustedForwarder;
    }

    /// @notice Creates a new Vault clone and initializes it
    /// @param tacoCoin Address of the staking token (ERC20 with permit)
    /// @param rewardRate Daily reward rate for the vault
    /// @return Address of the newly created Vault instance
    function createVault(address tacoCoin, uint256 rewardRate) external returns (address) {
        address newVault = Clones.clone(vaultImplementation);
        Vault(newVault).initialize(tacoCoin, msg.sender, rewardRate, trustedForwarder);

        allVaults.push(newVault);
        emit VaultCreated(newVault, msg.sender, tacoCoin, rewardRate);
        return newVault;
    }

    /// @notice Returns the list of all Vaults created by this factory
    /// @return Array of Vault addresses
    function getVaults() external view returns (address[] memory) {
        return allVaults;
    }
}
