// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Vault} from "./Vault.sol";

contract VaultV3 is Vault {
    function version() public pure returns (string memory) {
        return "V3";
    }
}