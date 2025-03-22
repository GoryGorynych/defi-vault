// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

contract Relayer is ERC2771Forwarder  {
    
    constructor (string memory name) ERC2771Forwarder(name) {}
}