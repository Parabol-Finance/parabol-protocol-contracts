// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

/**
 * @title ParabolUSD
 * @dev This contract is an ERC-20 compatible token that implements additional functionality for pausing, denylisting, and permit transfers.
 *
 * ParabolUSD is designed to work as a stablecoin within the Parabol ecosystem while providing flexibility for administrative control and security measures.
 * Key features include pausing and unpausing transfers and preventing denylisted accounts from using the token.
 * The contract is designed to be upgradeable to adapt to changing requirements and can only be managed by the DEFAULT_ADMIN_ROLE.
 *
 * Roles:
 * - PAUSER_ROLE: Allows an account to pause and unpause token transfers.
 * - MINTER_ROLE: Allows an account to mint new tokens.
 * - BURNER_ROLE: Allows an account to burn tokens.
 * - DEFAULT_ADMIN_ROLE: Allows an account to manage administrative functions like changing the denylister list contract addresses.
 */

import {AccessControlUpgradeable, IAccessControl} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ERC20BaseUpgradeable, ERC20Upgradeable} from "./base/ERC20BaseUpgradeable.sol";
import {ERC20AuthUpgradeable} from "./base/ERC20AuthUpgradeable.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IDenylister} from "./interfaces/IDenylister.sol";
import {IParabolUSDErrors} from "./interfaces/errors/IParabolUSDErrors.sol";
import {IParabolUSD, IERC20} from "./interfaces/IParabolUSD.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ParabolUSD is
    UUPSUpgradeable,
    ERC20AuthUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    IParabolUSDErrors,
    IParabolUSD
{
    /**
     * @dev Role identifier for minters who are allowed to mint tokens.
     * The calculation method keccak256("MINTER")
     */
    bytes32 public constant MINTER_ROLE =
        0xf0887ba65ee2024ea881d91b74c2450ef19e1557f03bed3ea9f16b037cbe2dc9;

    /**
     * @dev Role identifier for burners who are allowed to burn tokens.
     * The calculation method keccak256("BURNER")
     */
    bytes32 public constant BURNER_ROLE =
        0x9667e80708b6eeeb0053fa0cca44e028ff548e2a9f029edfeac87c118b08b7c8;

    /**
     * @dev Role identifier for accounts allowed to pause and unpause token operations.
     * The calculation method keccak256("PAUSER")
     */
    bytes32 public constant PAUSER_ROLE =
        0x539440820030c4994db4e31b6b800deafd503688728f932addfe7a410515c14c;

    /**
     * @dev Storage struct for ParabolUSD containing essential contract state variables.
     * @param _denylister Reference to the contract managing denylisted addresses, preventing their participation in token transactions.
     * @param _maxMintLimit The maximum number of tokens that can be minted in a single transaction, enforcing a limit to protect against accidental or malicious excessive minting.
     * @custom:storage-location erc7201:parabol.storage.ParabolUSD
     */
    struct ParabolUSDStorage {
        IDenylister _denylister;
        uint256 _maxMintLimit;
    }

    /**
     * @dev Represents the storage slot location used to store the `ParabolUSDStorage` struct.
     * This location is determined by the keccak256 hash of a specifically crafted string, ensuring it is unique and does not collide with other storage slots used by inherited contracts.
     * The calculation method `keccak256(abi.encode(uint256(keccak256("parabol.storage.ParabolUSD")) - 1)) & ~bytes32(uint256(0xff))`
     * ensures the slot is deterministic, unique, and unlikely to clash with other slots.
     */
    bytes32 private constant ParabolUSDStorageLocation =
        0xbaa7b143ee18c4d463655ca7ddba85dae06adfa429bfe263ba44309518d87800;

    /**
     * @dev Internal function to access the contract's stored configuration in `ParabolUSDStorage`.
     * Uses Solidity assembly to directly access the storage location.
     * @return $ The `ParabolUSDStorage` struct instance, providing access to the contract's state variables.
     */
    function _getParabolUSDStorage()
        private
        pure
        returns (ParabolUSDStorage storage $)
    {
        assembly {
            $.slot := ParabolUSDStorageLocation
        }
    }

    /**
     * @return The address of the contract managing denylists.
     */
    function denylister() external view returns (IDenylister) {
        return _getParabolUSDStorage()._denylister;
    }

    /**
     * @return The maximum number of tokens that can be minted in a single minting operation.
     */
    function maxMintLimit() external view returns (uint256) {
        return _getParabolUSDStorage()._maxMintLimit;
    }

    /**
     * @dev Modifier to check if an account is denylisted. Reverts the transaction if the account is found in the denylist.
     * @param account The account to check against the denylist.
     */
    modifier notDenylisted(address account) {
        if (_getParabolUSDStorage()._denylister.isDenylisted(account))
            revert ParabolUSD__Denylisted(account);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the ParabolUSD token with essential parameters.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     * @param denylister_ The address of the denylister contract.
     * @param adminAccount_ The address of the admin account.
     * @param minterAccount_ The address of the minter account.
     * @param burnerAccount_ The address of the burner account.
     * @param pauserAccount_ The address of the pauser account.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory version_,
        IDenylister denylister_,
        address adminAccount_,
        address minterAccount_,
        address burnerAccount_,
        address pauserAccount_
    ) external initializer {
        if (
            address(denylister_) == address(0) ||
            adminAccount_ == address(0) ||
            minterAccount_ == address(0) ||
            burnerAccount_ == address(0) ||
            pauserAccount_ == address(0)
        ) revert ParabolUSD__ZeroAddress();

        __ERC20_init_unchained(name_, symbol_);
        __ERC20BaseUpgradeable_init_unchained(name_, version_);
        __Pausable_init_unchained();

        ParabolUSDStorage storage $ = _getParabolUSDStorage();
        $._denylister = denylister_;
        $._maxMintLimit = 100000 ether;

        _grantRole(DEFAULT_ADMIN_ROLE, adminAccount_);
        _grantRole(MINTER_ROLE, minterAccount_);
        _grantRole(BURNER_ROLE, burnerAccount_);
        _grantRole(PAUSER_ROLE, pauserAccount_);
    }

    // @inheritdoc IERC20Permit
    function DOMAIN_SEPARATOR()
        public
        view
        override(ERC20BaseUpgradeable, IERC20Permit)
        returns (bytes32)
    {
        return ERC20BaseUpgradeable.DOMAIN_SEPARATOR();
    }

    /**
     * @dev Pauses token minting, transfers and approvals.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses token minting, transfers and approvals.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Updates the address of the denylister contract.
     * @param newDenylister The new address of the denylister contract.
     */
    function updateDenylister(
        IDenylister newDenylister
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(newDenylister) == address(0))
            revert ParabolUSD__ZeroAddress();

        _getParabolUSDStorage()._denylister = newDenylister;
        emit DenylisterUpdated(address(newDenylister));
    }

    /**
     * @notice Updates the maximum number of tokens that can be minted in a single operation.
     * @dev This function can only be called by an account with the DEFAULT_ADMIN_ROLE.
     * @param newLimit The new maximum limit for token minting.
     */
    function updateMaxMintLimit(
        uint256 newLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _getParabolUSDStorage()._maxMintLimit = newLimit;
        emit MaxMintLimitUpdated(newLimit);
    }

    /**
     * @inheritdoc ERC20Upgradeable
     * @dev override the function to check if the sender and to are denylisted.
     */
    function transfer(
        address to,
        uint256 amount
    )
        public
        override(ERC20Upgradeable, IERC20)
        notDenylisted(msg.sender)
        notDenylisted(to)
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    /**
     * @inheritdoc ERC20Upgradeable
     * @dev override the function to check if the sender, from, and to are denylisted.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        public
        override(ERC20Upgradeable, IERC20)
        notDenylisted(msg.sender)
        notDenylisted(from)
        notDenylisted(to)
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    /**
     * @inheritdoc ERC20AuthUpgradeable
     * @dev override the function to check if the sender, from, and to are denylisted.
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public
        override
        notDenylisted(msg.sender)
        notDenylisted(from)
        notDenylisted(to)
    {
        super.transferWithAuthorization(
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    /**
     * @inheritdoc ERC20AuthUpgradeable
     * @dev override the function to check if the sender, from, and to are denylisted.
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override notDenylisted(from) notDenylisted(to) {
        super.receiveWithAuthorization(
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }

    /**
     * @dev Mints new tokens and assigns them to the specified address. If the to address is denylisted, the minting will be reverted.
     * @param to The address to which new tokens will be minted.
     * @param amount The amount of tokens to mint.
     */
    function mint(
        address to,
        uint256 amount
    ) external notDenylisted(to) onlyRole(MINTER_ROLE) {
        if (amount == 0 || amount > _getParabolUSDStorage()._maxMintLimit)
            revert ParabolUSD__InvalidAmount();
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /**
     * @dev Burns tokens from a specified address. If the from address is not the msg.sender, it will check if the from address is denylisted.
     * If the from address is not denylisted, it will check if the allowance of BURNER_ROLE is enough.
     * @param from The address from which tokens will be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (amount == 0) {
            revert ParabolUSD__ZeroAmount();
        }
        if (
            from != msg.sender &&
            !_getParabolUSDStorage()._denylister.isDenylisted(from)
        ) {
            _spendAllowance(from, msg.sender, amount);
        }

        _burn(from, amount);
        emit Burn(from, amount);
    }

    /**
     * @inheritdoc ERC20AuthUpgradeable
     * @dev override the function to check if the sender has the BURNER_ROLE.
     */
    function burnWithAuthorization(
        address from,
        address burner,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override onlyRole(BURNER_ROLE) {
        super.burnWithAuthorization(
            from,
            burner,
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
        emit Burn(from, value);
    }

    // @inheritdoc ERC20BaseUpgradeable
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC20BaseUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    //@inheritdoc ERC20BaseUpgradeable
    function nonces(
        address owner
    )
        public
        view
        override(ERC20BaseUpgradeable, IERC20Permit)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    /**
     * @inheritdoc ERC20Upgradeable
     * @dev This override extends the base `_approve` functionality with two key features:
     * It checks that the contract is not paused and both the `owner` and `spender` are not denylisted before proceeding with the approval.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount,
        bool emitEvent
    )
        internal
        override
        whenNotPaused
        notDenylisted(owner)
        notDenylisted(spender)
    {
        super._approve(owner, spender, amount, emitEvent);
    }

    /**
     * @inheritdoc ERC20Upgradeable
     * @dev This override extends the base `_update` functionality with the pause check.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
