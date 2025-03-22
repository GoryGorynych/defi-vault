// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ERC2771Simple is Initializable {
    address private _trustedForwarder;

    function __ERC2771Simple_init(address pTrustedForwarder) internal onlyInitializing {
        require(pTrustedForwarder != address(0), "Invalid forwarder address");
        _trustedForwarder = pTrustedForwarder;
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == _trustedForwarder;
    }

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

    function msgData() internal view virtual returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }

    function getOriginalSender() public view returns (address) {
        return msgSender();
    }

    function trustedForwarder() external view returns (address) {
        return _trustedForwarder;
    }

}
