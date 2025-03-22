// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @title Relayer - Minimal ERC2771 forwarder for meta-transactions
/// @notice Extends OpenZeppelin's ERC2771Forwarder to support trusted meta-transaction forwarding
/// @author Vladimir Gorenkov
contract Relayer is ERC2771Forwarder {

    /// @notice Initializes the forwarder with a name used in EIP-712 domain
    /// @param name Human-readable name for the forwarder (used in typed data signing)
    constructor(string memory name) ERC2771Forwarder(name) {}
}
