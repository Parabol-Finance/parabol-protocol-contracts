// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

/**
 * @title NonFungibleNotePosition
 * @dev This contract represents non-fungible token positions for the Parabol lending platform. It extends ERC721 for token uniqueness and includes features like pausing, denylisting, and permit functionality.
 * NonFungibleNotePosition tokens represent individual lending positions within the Parabol ecosystem, each characterized by unique parameters such as principal, coupon rate, and maturity date.
 * Key features include pausing and unpausing transfers and preventing denylisted accounts from using the token.
 * The contract is designed to be upgradeable to adapt to changing requirements and can only be managed by the DEFAULT_ADMIN_ROLE.
 *
 * Roles:
 * - RSP_ROLE: Enables the Reserve Stability Pool to manage note positions.
 * - PAUSER_ROLE: Controls pausing/unpausing of the contract operations.
 * - DEFAULT_ADMIN_ROLE: Handles roles assignment and contract's crucial administrative functions.
 */

import {ERC721PermitUpgradeable} from "./base/ERC721PermitUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlUpgradeable, IAccessControl} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ParabolNoteDescriptor} from "./libraries/ParabolNoteDescriptor.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {INonFungibleNotePosition} from "./interfaces/INonFungibleNotePosition.sol";
import {IReserveStabilityPool} from "./interfaces/IReserveStabilityPool.sol";
import {IDenylister} from "./interfaces/IDenylister.sol";
import {INonFungibleNotePositionErrors} from "./interfaces/errors/INonFungibleNotePositionErrors.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract NonFungibleNotePosition is
    UUPSUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ERC721PermitUpgradeable,
    INonFungibleNotePositionErrors,
    INonFungibleNotePosition
{
    /**
     * @dev Role identifier for the Reserve Stability Pool.
     * The calculation method keccak256("RSP")
     */
    bytes32 public constant RSP_ROLE =
        0x6a32f3ff343ae66b7d86c9069c431fcd393953a0c476bad3219a146353e0a088;

    /**
     * @dev Role identifier for pausing and unpausing contract operations.
     * The calculation method keccak256("PAUSER")
     */
    bytes32 public constant PAUSER_ROLE =
        0x539440820030c4994db4e31b6b800deafd503688728f932addfe7a410515c14c;

    /**
     * @dev Storage struct for NonFungibleNotePosition containing essential contract state variables.
     * @param _tokenIdTracker Incremental Id tracker for note positions.
     * @param _denylister Reference to the contract managing denylisted addresses, preventing their participation in token transactions.
     * @param _reserveStabilityPool Interface to the Reserve Stability Pool for managing lending aspects.
     * @param _lendInfos Maps token Ids to their corresponding lending information.
     * @custom:storage-location erc7201:parabol.storage.NonFungibleNotePosition
     */
    struct NonFungibleNotePositionStorage {
        Counter _tokenIdTracker;
        IDenylister _denylister;
        IReserveStabilityPool _reserveStabilityPool;
        mapping(uint256 tokenId => Note lendInfo) _lendInfos;
    }

    /**
     * @dev The storage slot location used for the NonFungibleNotePositionStorage struct.
     * This location is calculated to ensure no storage collisions with inherited contracts, utilizing a unique identifier.
     * The calculation method keccak256(abi.encode(uint256(keccak256("parabol.storage.NonFungibleNotePosition")) - 1)) & ~bytes32(uint256(0xff));
     */
    bytes32 private constant NonFungibleNotePositionStorageLocation =
        0x316f707e5b6680cbcb265d3471a94e90d21456c652ec447d97e21aae4f0e1f00;

    /**
     * @dev Internal function to access the contract's stored configuration in `NonFungibleNotePositionStorage`.
     * Uses Solidity assembly to directly access the storage location.
     * @return $ The `NonFungibleNotePositionStorage` struct instance, providing access to the contract's state variables.
     */
    function _getNonFungibleNotePositionStorage()
        private
        pure
        returns (NonFungibleNotePositionStorage storage $)
    {
        assembly {
            $.slot := NonFungibleNotePositionStorageLocation
        }
    }

    /**
     * @notice Returns the address of the denylister contract.
     * @return The address of the denylister contract.
     */
    function denylister() external view returns (IDenylister) {
        return _getNonFungibleNotePositionStorage()._denylister;
    }

    /**
     * @notice Returns the address of the Reserve Stability Pool.
     * @return The address of the Reserve Stability Pool.
     */
    function reserveStabilityPool()
        external
        view
        returns (IReserveStabilityPool)
    {
        return _getNonFungibleNotePositionStorage()._reserveStabilityPool;
    }

    /**
     * @notice Returns the lending information for a specific note position.
     * @param tokenId The Id of the note position.
     * @return The lending information for the specified note position.
     */
    function lendInfos(uint256 tokenId) external view returns (Note memory) {
        return _getNonFungibleNotePositionStorage()._lendInfos[tokenId];
    }

    /**
     * @dev Ensures the passed address is not on the denylist.
     * @param account The address to check.
     */
    modifier notDenylisted(address account) {
        if (
            _getNonFungibleNotePositionStorage()._denylister.isDenylisted(
                account
            )
        ) revert NonFungibleNotePosition__Denylisted(account);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract with necessary parameters and roles.
     * @param name_ Token name.
     * @param symbol_ Token symbol.
     * @param version_ Contract version.
     * @param denylister_ Address of the Denylister contract.
     * @param adminAccount_ Address to grant DEFAULT_ADMIN_ROLE.
     * @param pauserAccount_ Address to grant PAUSER_ROLE.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory version_,
        IDenylister denylister_,
        address adminAccount_,
        address pauserAccount_
    ) external initializer {
        if (
            address(denylister_) == address(0) ||
            adminAccount_ == address(0) ||
            pauserAccount_ == address(0)
        ) revert NonFungibleNotePosition__ZeroAddress();
        __ERC721_init_unchained(name_, symbol_);
        __ERC721Permit_init_unchained(name_, version_);
        __Pausable_init_unchained();
        NonFungibleNotePositionStorage
            storage $ = _getNonFungibleNotePositionStorage();

        $._tokenIdTracker._value = 1;
        $._denylister = denylister_;

        _grantRole(DEFAULT_ADMIN_ROLE, adminAccount_);
        _grantRole(PAUSER_ROLE, pauserAccount_);
    }

    /**
     * @notice Pauses all contract operations, restricting token transfers and other functionalities. Can only be called by an account with PAUSER_ROLE.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all contract operations by lifting the pause state. Can only be called by an account with PAUSER_ROLE.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Updates the contract's Reserve Stability Pool address. Only callable by the DEFAULT_ADMIN_ROLE.
     * @param newReserveStabilityPool New RSP contract address.
     */
    function setReserveStabilityPool(
        IReserveStabilityPool newReserveStabilityPool
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(newReserveStabilityPool) == address(0))
            revert NonFungibleNotePosition__ZeroAddress();

        NonFungibleNotePositionStorage
            storage $ = _getNonFungibleNotePositionStorage();

        if (address($._reserveStabilityPool) != address(0))
            revokeRole(RSP_ROLE, address($._reserveStabilityPool));

        $._reserveStabilityPool = newReserveStabilityPool;
        grantRole(RSP_ROLE, address(newReserveStabilityPool));
        emit RSPSet(address(newReserveStabilityPool));
    }

    /**
     * @notice Changes the address of the denylister contract. Only callable by DEFAULT_ADMIN_ROLE.
     * @param newDenylister New denylister contract address.
     */
    function updateDenylister(
        IDenylister newDenylister
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(newDenylister) == address(0))
            revert NonFungibleNotePosition__ZeroAddress();
        _getNonFungibleNotePositionStorage()._denylister = newDenylister;
        emit DenylisterUpdated(address(newDenylister));
    }

    /**
     * @notice Mints a new note position token. Only callable by the Reserve Stability Pool (RSP_ROLE).
     * @param to Recipient of the newly minted token.
     */
    function mint(
        address to,
        Note calldata note
    ) external onlyRole(RSP_ROLE) returns (uint256) {
        uint256 tokenId = _getAndIncrementTokenId();

        _getNonFungibleNotePositionStorage()._lendInfos[tokenId] = note;
        _mint(to, tokenId);

        emit Mint(to, tokenId);
        return tokenId;
    }

    /**
     * @notice Burns a note position token. Only callable by the RSP_ROLE.
     * @param tokenId Id of the token to be burned.
     */
    function burn(uint256 tokenId) external onlyRole(RSP_ROLE) {
        address owner = _requireOwned(tokenId);
        NonFungibleNotePositionStorage
            storage $ = _getNonFungibleNotePositionStorage();
        if (
            getApproved(tokenId) != address($._reserveStabilityPool) &&
            !isApprovedForAll(owner, address($._reserveStabilityPool))
        ) revert NonFungibleNotePosition__TokenNotApproved();

        delete $._lendInfos[tokenId];
        _burn(tokenId);
        emit Burn(owner, tokenId);
    }

    /**
     * @notice Retrieves lending information for a specific note position.
     * @param tokenId Id of the token to fetch information for.
     * @return Note struct with the lending information.
     */
    function getLendInfo(uint256 tokenId) external view returns (Note memory) {
        _requireOwned(tokenId);
        return _getNonFungibleNotePositionStorage()._lendInfos[tokenId];
    }

    /// @inheritdoc IERC165
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721PermitUpgradeable, AccessControlUpgradeable, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @notice Provides the URI for a specific token, containing its metadata.
     * @param tokenId Id of the token to get URI for.
     * @return String representing the token URI.
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);

        NonFungibleNotePositionStorage
            storage $ = _getNonFungibleNotePositionStorage();

        Note memory lendInfo = $._lendInfos[tokenId];

        return
            ParabolNoteDescriptor.tokenURI(
                ParabolNoteDescriptor.ConstructTokenURIParams({
                    tokenId: tokenId,
                    lendTimestamp: lendInfo.lendTimestamp,
                    maturityTimestamp: lendInfo.maturityTimestamp,
                    principal: lendInfo.principal,
                    coupon: lendInfo.coupon,
                    accFixedIncome: $
                        ._reserveStabilityPool
                        .calculateFixedIncome(tokenId),
                    accFloatingIncome: $
                        ._reserveStabilityPool
                        .calculateFloatingIncome(tokenId)
                })
            );
    }

    /**
     * @dev Increments the token Id counter and returns the new Id. Ensures unique Id for each new token minted.
     * @return The newly incremented token Id.
     */
    function _getAndIncrementTokenId() internal returns (uint256) {
        unchecked {
            return
                _getNonFungibleNotePositionStorage()._tokenIdTracker._value++;
        }
    }

    /**
     * @dev Overrides the internal _approve function to include additional checks for pause state and denylist.
     * It sets or updates approval for a given operator to manage a specific token Id.
     * @param to Address to approve.
     * @param tokenId Id of the token for which approval is being set.
     * @param auth Address performing the approval.
     * @param emitEvent Flag indicating whether to emit the Approval event.
     */
    function _approve(
        address to,
        uint256 tokenId,
        address auth,
        bool emitEvent
    ) internal override whenNotPaused notDenylisted(to) notDenylisted(auth) {
        super._approve(to, tokenId, auth, emitEvent);
    }

    /**
     * @dev Overrides the internal _setApprovalForAll function to include additional checks for pause state and denylist.
     * It enables or disables approval for an operator to manage all of the message sender's tokens.
     * @param owner Owner of the tokens.
     * @param operator Operator to grant or revoke permission.
     * @param approved Boolean flag indicating whether the operator is approved.
     */
    function _setApprovalForAll(
        address owner,
        address operator,
        bool approved
    )
        internal
        override
        whenNotPaused
        notDenylisted(owner)
        notDenylisted(operator)
    {
        super._setApprovalForAll(owner, operator, approved);
    }

    /**
     * @dev Internal function overridden to include checks for pause state and denylist.
     * It is intended for updating the ownership data of a token, typically used during token transfers.
     * @param to Address receiving the token.
     * @param tokenId Id of the token being transferred or updated.
     * @param auth Address authorized to perform the update.
     * @return Address of the owner after the token has been updated.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override
        whenNotPaused
        notDenylisted(to)
        notDenylisted(auth)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
