// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title ERC2771Simple - Lightweight base contract for meta-transaction support via trusted forwarder
/// @notice Provides basic ERC-2771 support to extract sender and calldata from forwarded calls
/// @author Vladimir Gorenkov
contract ERC2771Simple is Initializable {
    address private _trustedForwarder;

    /// @param pTrustedForwarder Address of the trusted forwarder contract
    function __ERC2771Simple_init(address pTrustedForwarder) internal onlyInitializing {
        require(pTrustedForwarder != address(0), "Invalid forwarder address");
        _trustedForwarder = pTrustedForwarder;
    }

    /// @notice Checks whether a given address is the trusted forwarder
    /// @param forwarder Address to check
    /// @return True if the address is the trusted forwarder
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == _trustedForwarder;
    }

    /// @notice Returns the original sender of the message, accounting for meta-transactions
    /// @return sender The address of the actual sender
    function msgSender() internal view virtual returns (address sender) {
        if (isTrustedForwarder(msg.sender)) {
            // Load sender address from the end of calldata (last 20 bytes)
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    /// @notice Returns the actual calldata of the original transaction
    /// @return The calldata excluding the appended sender address
    function msgData() internal view virtual returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }

    /// @notice Public helper to expose the original sender of the message
    /// @return The actual sender of the transaction (supports meta-transactions)
    function getOriginalSender() public view returns (address) {
        return msgSender();
    }

    /// @notice Returns the address of the trusted forwarder
    /// @return The trusted forwarder address
    function trustedForwarder() external view returns (address) {
        return _trustedForwarder;
    }
}
