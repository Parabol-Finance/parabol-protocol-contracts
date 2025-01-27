// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

error SmartAccount__InvalidSignature();
error SmartAccount__InvalidSigner();

contract SmartAccount {
    address public signer;

    constructor(address signer_) {
        signer = signer_;
    }

    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) public view returns (bytes4) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (ecrecover(hash, v, r, s) == signer) return bytes4(0x1626ba7e);
        return bytes4(0);
    }
}
