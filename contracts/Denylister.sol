// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity 0.8.24;

/**
 * @title Denylister
 * @dev A contract that provides denylist management capabilities for an owner.
 * It allows the owner to denylist/removeFromDenylist accounts and query the denylist status of an account.
 */

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IDenylister} from "./interfaces/IDenylister.sol";
import {IDenylisterErrors} from "./interfaces/errors/IDenylisterErrors.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Denylister is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    IDenylisterErrors,
    IDenylister
{
    /**
     * @dev Storage struct for Denylister containing essential contract state variables.
     * @param _denylist Mapping of addresses to their denylist status.
     * @custom:storage-location erc7201:parabol.storage.Denylister
     */
    struct DenylisterStorage {
        mapping(address account => bool isDenylisted) _denylist;
    }

    /**
     * @dev The storage slot location used for the DenylisterStorage struct.
     * This location is calculated to ensure no storage collisions with inherited contracts, utilizing a unique identifier.
     * The calculation method keccak256(abi.encode(uint256(keccak256("parabol.storage.Denylister")) - 1)) & ~bytes32(uint256(0xff))
     */
    bytes32 private constant DenylisterStorageLocation =
        0x0b7f09e080729a6f01210a857b22417bb37e71acad7810ed3f0850eb44452c00;

    /**
     * @dev Internal function to access the `DenylisterStorage` struct.
     * Utilizes Solidity assembly to directly access the storage slot where `DenylisterStorage` is located, ensuring efficient data retrieval.
     * @return $ The `DenylisterStorage` struct containing the mapping of denylisted addresses.
     */
    function _getDenylisterStorage()
        private
        pure
        returns (DenylisterStorage storage $)
    {
        assembly {
            $.slot := DenylisterStorageLocation
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract by setting the initial owner.
     * This is a one-time operation that replaces the constructor for upgradeable contracts.
     * @param initialOwner The address of the initial owner of the contract, with the ability to manage the denylist.
     * @notice The contract must be uninitialized, and `initialOwner` cannot be the zero address.
     */
    function initialize(address initialOwner) external initializer {
        if (initialOwner == address(0)) revert Denylister__ZeroAddress();
        __Ownable_init_unchained(initialOwner);
    }

    /**
     * @dev Adds account to denylist.
     * Can only be called by the current owner.
     * @param account The address to denylist.
     */
    function addToDenylist(address account) external onlyOwner {
        _addToDenylist(account);
    }

    /**
     * @dev Adds accounts to denylist.
     * Can only be called by the current owner.
     * @param accounts The address list to denylist.
     */
    function batchAddToDenylist(
        address[] calldata accounts
    ) external onlyOwner {
        uint256 l = accounts.length;
        if (l == 0) revert Denylister__EmptyList();
        for (uint256 i = 0; i < l; ) {
            _addToDenylist(accounts[i]);
            unchecked {
                i++;
            }
        }
    }

    /**
     * @dev Adds account to denylist.
     * Can only be called by the current owner.
     * @param account The address to denylist.
     */
    function _addToDenylist(address account) internal {
        if (account == address(0)) revert Denylister__ZeroAddress();

        DenylisterStorage storage $ = _getDenylisterStorage();

        if ($._denylist[account]) {
            revert Denylister__AlreadyAddedToDenylist(account);
        }

        $._denylist[account] = true;
        emit AddedToDenylist(account);
    }

    /**
     * @dev Removes account from denylist.
     * Can only be called by the current owner.
     * @param account The address to remove from the denylist.
     */
    function removeFromDenylist(address account) external onlyOwner {
        _removeFromDenylist(account);
    }

    /**
     * @dev Removes accounts from denylist.
     * Can only be called by the current owner.
     * @param accounts The address list to remove from the denylist.
     */
    function batchRemoveFromDenylist(
        address[] calldata accounts
    ) external onlyOwner {
        uint256 l = accounts.length;
        if (l == 0) revert Denylister__EmptyList();
        for (uint256 i = 0; i < l; ) {
            _removeFromDenylist(accounts[i]);
            unchecked {
                i++;
            }
        }
    }

    /**
     * @dev Internal function to remove an address from the denylist.
     * This function checks if the address is currently denylisted; if not, it reverts.
     * If the address is denylisted, it updates the denylist status to false and emits a `RemovedFromDenylist` event.
     * @param account The address to be removed from the denylist.
     * @notice Can only be called by functions within the contract, typically requiring ownership or specific permissions.
     */
    function _removeFromDenylist(address account) internal {
        if (account == address(0)) revert Denylister__ZeroAddress();

        DenylisterStorage storage $ = _getDenylisterStorage();
        if (!$._denylist[account]) revert Denylister__NotDenylisted(account);

        $._denylist[account] = false;
        emit RemovedFromDenylist(account);
    }

    /**
     * @dev Checks if the account is denylisted.
     * @param account The address to check.
     * @return Returns `true` if the account is denylisted, otherwise `false`.
     */
    function isDenylisted(address account) external view returns (bool) {
        return _getDenylisterStorage()._denylist[account];
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
