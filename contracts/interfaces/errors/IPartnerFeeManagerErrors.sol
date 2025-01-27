// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IPartnerFeeManagerErrors {
    error PartnerFeeManager__NotPartnerOwner();
    error PartnerFeeManager__PartnerIdNotExists(bytes32 partnerId);
    error PartnerFeeManager__ZeroAddress();
    error PartnerFeeManager__InvalidFee();
    error PartnerFeeManager__SameFee();
    error PartnerFeeManager__SameOwner();
    error PartnerFeeManager__SameVaultAddress();
    error PartnerFeeManager__SamePartnerInfo();
}
