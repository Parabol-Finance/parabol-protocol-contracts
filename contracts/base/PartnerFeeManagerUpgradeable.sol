// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IPartnerFeeManager} from "../interfaces/IPartnerFeeManager.sol";
import {IPartnerFeeManagerErrors} from "../interfaces/errors/IPartnerFeeManagerErrors.sol";
import {NoncesUpgradeable} from "../utils/NoncesUpgradeable.sol";

contract PartnerFeeManagerUpgradeable is
    NoncesUpgradeable,
    IPartnerFeeManager,
    IPartnerFeeManagerErrors
{
    /**
     * @dev The denominator for fee calculations.
     */
    uint256 public constant DENOMINATOR = 10000;

    /**
     * @dev Internal storage structure for Partner Fee Manager configuration.
     * @custom:storage-location erc7201:parabol.storage.PartnerFeeManager
     */
    struct PartnerFeeManagerStorage {
        mapping(bytes32 => PartnerInfo) _partnerInfo;
    }

    // keccak256(abi.encode(uint256(keccak256("parabol.storage.PartnerFeeManager")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant PartnerFeeManagerStorageLocation =
        0x2b9a2de2a35966db719175388ec75b233becea336ff81842510ad9f9d71a9300;

    /**
     * @dev Internal function to access the `PartnerFeeManagerStorage`.
     * @return $ The storage struct representing the state of the Partner Fee Manager.
     */
    function _getPartnerFeeManagerStorage()
        private
        pure
        returns (PartnerFeeManagerStorage storage $)
    {
        assembly {
            $.slot := PartnerFeeManagerStorageLocation
        }
    }

    /**
     * @dev Internal function to check if the caller is the owner of a given partner.
     * @param partnerId The ID of the partner to check ownership for.
     * @return partnerInfo The storage struct representing the partner's information.
     */
    function _requirePartnerOwner(
        bytes32 partnerId
    ) internal view returns (PartnerInfo storage partnerInfo) {
        partnerInfo = _getPartnerFeeManagerStorage()._partnerInfo[partnerId];
        if (partnerInfo._partnerOwner != msg.sender) {
            revert PartnerFeeManager__NotPartnerOwner();
        }
    }

    /**
     * @dev Internal function to get the partner information by its ID.
     * @param partnerId The ID of the partner to get information for.
     * @return partnerInfo The storage struct representing the partner's information.
     */
    function getPartnerInfoById(
        bytes32 partnerId
    ) public view returns (PartnerInfo memory partnerInfo) {
        return _validatePartnerId(partnerId);
    }

    /**
     * @dev Internal function to get the nonce for a given owner.
     * @param owner The address of the owner to get the nonce for.
     * @return nonce The nonce for the given owner.
     */
    function getPartnerNonce(address owner) public view returns (uint256) {
        return _nonces(owner);
    }

    /**
     * @dev Internal function to get the partner ID by the owner and nonce.
     * @param owner The address of the owner to get the partner ID for.
     * @param nonce The nonce to use for the partner ID.
     * @return partnerId The ID of the partner.
     */
    function getPartnerIdByNonce(
        address owner,
        uint256 nonce
    ) public pure returns (bytes32) {
        if (owner == address(0)) revert PartnerFeeManager__ZeroAddress();
        return keccak256(abi.encodePacked(owner, nonce));
    }

    /**
     * @dev Internal function to get the partner information by the owner and nonce.
     * @param owner The address of the owner to get the partner information for.
     * @param nonce The nonce to use for the partner information.
     * @return partnerInfo The storage struct representing the partner's information.
     */
    function getPartnerInfoByOwner(
        address owner,
        uint256 nonce
    ) public view returns (PartnerInfo memory partnerInfo) {
        return getPartnerInfoById(getPartnerIdByNonce(owner, nonce));
    }

    /**
     * @dev External function to create a new partner.
     * @param partnerVault The address of the partner's vault.
     * @param partnerFeeBPS The fee in basis points for the partner.
     */
    function createPartner(
        address partnerVault,
        uint256 partnerFeeBPS
    ) external {
        if (partnerVault == address(0)) revert PartnerFeeManager__ZeroAddress();
        if (partnerFeeBPS > DENOMINATOR) revert PartnerFeeManager__InvalidFee();

        bytes32 partnerId = keccak256(
            abi.encodePacked(msg.sender, _useNonce(msg.sender))
        );

        _getPartnerFeeManagerStorage()._partnerInfo[partnerId] = PartnerInfo({
            _exists: true,
            _partnerOwner: msg.sender,
            _partnerVault: partnerVault,
            _partnerFeeBPS: partnerFeeBPS
        });

        emit PartnerCreated(partnerId, msg.sender, partnerVault, partnerFeeBPS);
    }

    /**
     * @dev External function to transfer the ownership of a partner.
     * @param partnerId The ID of the partner to transfer ownership for.
     * @param newOwner The new owner of the partner.
     */
    function transferPartnerOwnership(
        bytes32 partnerId,
        address newOwner
    ) external {
        if (newOwner == address(0)) revert PartnerFeeManager__ZeroAddress();
        PartnerInfo storage partnerInfo = _requirePartnerOwner(partnerId);

        if (partnerInfo._partnerOwner == newOwner)
            revert PartnerFeeManager__SameOwner();

        partnerInfo._partnerOwner = newOwner;

        emit PartnerOwnershipTransferred(partnerId, newOwner);
    }

    /**
     * @dev External function to set the vault address for a partner.
     * @param partnerId The ID of the partner to set the vault for.
     * @param newVault The new vault address.
     */
    function setPartnerVault(bytes32 partnerId, address newVault) external {
        if (newVault == address(0)) revert PartnerFeeManager__ZeroAddress();

        PartnerInfo storage partnerInfo = _requirePartnerOwner(partnerId);
        if (partnerInfo._partnerVault == newVault)
            revert PartnerFeeManager__SameVaultAddress();

        partnerInfo._partnerVault = newVault;

        emit PartnerVaultChanged(partnerId, newVault);
    }

    /**
     * @dev External function to set the fee for a partner.
     * @param partnerId The ID of the partner to set the fee for.
     * @param newFeeBPS The new fee in basis points.
     */
    function setPartnerFee(bytes32 partnerId, uint256 newFeeBPS) external {
        if (newFeeBPS > DENOMINATOR) revert PartnerFeeManager__InvalidFee();

        PartnerInfo storage partnerInfo = _requirePartnerOwner(partnerId);
        if (partnerInfo._partnerFeeBPS == newFeeBPS)
            revert PartnerFeeManager__SameFee();

        partnerInfo._partnerFeeBPS = newFeeBPS;

        emit PartnerFeeChanged(partnerId, newFeeBPS);
    }

    /**
     * @dev Internal function to validate a partner ID.
     * @param partnerId The ID of the partner to validate.
     * @return partnerInfo The storage struct representing the partner's information.
     */
    function _validatePartnerId(
        bytes32 partnerId
    ) internal view returns (PartnerInfo memory partnerInfo) {
        partnerInfo = _getPartnerFeeManagerStorage()._partnerInfo[partnerId];
        if (partnerId != bytes32(0) && !partnerInfo._exists)
            revert PartnerFeeManager__PartnerIdNotExists(partnerId);
    }
}
