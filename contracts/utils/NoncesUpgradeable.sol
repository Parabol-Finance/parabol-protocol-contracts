// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

import {INoncesUpgradeable} from "../interfaces/INoncesUpgradeable.sol";

/**
 * @dev Provides tracking nonces for addresses. Nonces will only increment.
 */
abstract contract NoncesUpgradeable is INoncesUpgradeable {
    /// @custom:storage-location erc7201:openzeppelin.storage.Nonces
    struct NoncesStorage {
        mapping(address account => uint256 nonce) _nonces;
    }

    // keccak256(abi.encode(uint256(keccak256("parabol.storage.Nonces")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant NoncesStorageLocation =
        0x4844f4ef9e791d535f02b34904c9f8ee969c9ffb8c000af70ea4a0636fb56700;

    function _getNoncesStorage()
        private
        pure
        returns (NoncesStorage storage $)
    {
        assembly {
            $.slot := NoncesStorageLocation
        }
    }

    /**
     * @dev Returns the next unused nonce for an address.
     */
    function _nonces(address owner) internal view virtual returns (uint256) {
        return _getNoncesStorage()._nonces[owner];
    }

    /**
     * @dev Consumes a nonce.
     *
     * Returns the current value and increments nonce.
     */
    function _useNonce(address owner) internal virtual returns (uint256) {
        // For each account, the nonce has an initial value of 0, can only be incremented by one, and cannot be
        // decremented or reset. This guarantees that the nonce never overflows.
        NoncesStorage storage $ = _getNoncesStorage();
        emit NonceUsed(owner, $._nonces[owner]);
        unchecked {
            // It is important to do x++ and not ++x here.
            return $._nonces[owner]++;
        }
    }
}
