// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract TacoCoin is ERC20, IERC20Permit, AccessControl  {
    string public version;

    error EIP2612PermisssionExpired(uint256 deadline);
    error EIP2612InvalidSignature(address owner, address signer);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    bytes32 private constant DOMAIN_TYPE_HASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    bytes32 private constant PERMIT_TYPE_HASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    uint256 internal immutable INITIAL_CHAIN_ID;
    bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;

    mapping(address account => uint256 nonce) public nonces;

    constructor(uint256 _initMintValue) ERC20("TacoCoin", "TACO") {
        version = "1";
        INITIAL_CHAIN_ID = block.chainid;
        INITIAL_DOMAIN_SEPARATOR = computeDomainSeparator();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        _mint(msg.sender, _initMintValue);
    }

    function mint(address account, uint256 value) public virtual onlyRole(MINTER_ROLE) {
        _mint(account, value);
    }

    function burn(address account, uint256 value) public virtual onlyRole(BURNER_ROLE) {
        _burn(account, value);
    }

    function permit(
        address owner,
        address spender,
        uint value,
        uint deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (deadline < block.timestamp) {
            revert EIP2612PermisssionExpired(deadline);
        }

        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        PERMIT_TYPE_HASH,
                        owner,
                        spender,
                        value,
                        nonces[owner]++,
                        deadline
                    )
                )
            )
        );

        address signer = ecrecover(hash, v, r, s);
        if (signer != owner) {
            revert EIP2612InvalidSignature(owner, signer);
        }
        _approve(owner, spender, value);
    }

    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        return
            block.chainid == INITIAL_CHAIN_ID
                ? INITIAL_DOMAIN_SEPARATOR
                : computeDomainSeparator();
    }

    function computeDomainSeparator() internal view virtual returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DOMAIN_TYPE_HASH,
                    keccak256(bytes(name())),
                    keccak256(bytes(version)),
                    block.chainid,
                    address(this)
                )
            );
    }
}
