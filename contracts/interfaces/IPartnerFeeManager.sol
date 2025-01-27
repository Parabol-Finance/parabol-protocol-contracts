// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IPartnerFeeManager {
    struct PartnerInfo {
        bool _exists;
        address _partnerOwner;
        address _partnerVault;
        uint256 _partnerFeeBPS;
    }

    event PartnerCreated(
        bytes32 partnerId,
        address indexed partnerOwner,
        address indexed partnerVault,
        uint256 partnerFeeBPS
    );

    event PartnerOwnershipTransferred(
        bytes32 partnerId,
        address indexed newOwner
    );

    event PartnerVaultChanged(bytes32 partnerId, address indexed newVault);

    event PartnerFeeChanged(bytes32 partnerId, uint256 newFeeBPS);
}
