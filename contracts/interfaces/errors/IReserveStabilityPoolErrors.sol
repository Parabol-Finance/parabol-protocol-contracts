// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IReserveStabilityPoolErrors {
    error ReserveStabilityPool__ZeroAddress();
    error ReserveStabilityPool__TransferFromFailed();
    error ReserveStabilityPool__NotTokenOwner();
    error ReserveStabilityPool__MaturityNotPassed();
    error ReserveStabilityPool__ClaimMintFailed();
    error ReserveStabilityPool__InvalidProtocolFee();
    error ReserveStabilityPool__InvalidWithdrawalFee();
    error ReserveStabilityPool__InsufficientPrincipal();
    error ReserveStabilityPool__InsufficientAllowance();
    error ReserveStabilityPool__TokenNotApproved();
    error ReserveStabilityPool__MaturityPassed();
    error ReserveStabilityPool__FloatingIncomeNotSynced();
    error ReserveStabilityPool__DailyFloatingIncomeAlreadyUpdated();
    error ReserveStabilityPool__PreviousDayNotUpdated();
    error ReserveStabilityPool__InvalidInputParameter();
    error ReserveStabilityPool__UpdateDayIsNotValid(uint256 day);
    error ReserveStabilityPool__ArrayLengthMismatch();
    error ReserveStabilityPool__NotDenylisted();
    error ReserveStabilityPool__IncorrectAmount();
    error ReserveStabilityPool__ZeroAmount();
    error ReserveStabilityPool__InvalidMaxCouponLimit();
    error ReserveStabilityPool__InvalidCoupon();
    error ReserveStabilityPool__InvalidMaturity();
    error ReserveStabilityPool__InvalidMinLendLimit();
    error ReserveStabilityPool__SameVaultAddress();
    error ReserveStabilityPool__SameProtocolFee();
    error ReserveStabilityPool__SameWithdrawalFee();
    error ReserveStabilityPool__SameMinLendLimit();
    error ReserveStabilityPool__SameMaxCouponLimit();
    error ReserveStabilityPool__SameMinMaturityLimit();
    error ReserveStabilityPool__TokenAlreadyApproved();
    error ReserveStabilityPool__PartnerFeeChanged();
}
