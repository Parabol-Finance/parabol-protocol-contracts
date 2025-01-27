// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

/**
 * @title Sanctions List Interface
 * @dev Interface to check if an address is denylisted.
 */
interface IDenylister {
    /// @dev Emitted when an account is denylisted.
    event AddedToDenylist(address indexed account);

    /// @dev Emitted when an account is removed from the denylist.
    event RemovedFromDenylist(address indexed account);

    /// @dev Emitted when the denylister role is transferred to a new account.
    event DenylisterChanged(address indexed newDenylister);

    /**
     * @dev Checks if the given address is denylisted.
     * @param addr Address to check.
     * @return bool Returns `true` if the address is denylisted, otherwise `false`.
     */
    function isDenylisted(address addr) external view returns (bool);
}
