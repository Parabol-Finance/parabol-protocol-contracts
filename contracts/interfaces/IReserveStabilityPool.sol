// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

/**
 * @title Reserve Stability Pool Interface
 * @dev Interface for functionalities related to the Reserve Stability Pool.
 */
import {IFeedSignatureVerifier} from "./IFeedSignatureVerifier.sol";

interface IReserveStabilityPool is IFeedSignatureVerifier {
    /**
     * @dev Struct for lending parameters.
     * @param beneficiary The address of the beneficiary.
     * @param partnerId The ID of the lending partner.
     * @param partnerFeeBPS The fee percentage charged by the lending partner.
     * @param principal The principal amount lent.
     */
    struct LendParams {
        address beneficiary;
        bytes32 partnerId;
        uint256 partnerFeeBPS;
        uint256 principal;
    }
    /**
     * @dev Emitted when a user lends ParaUSD to the pool.
     * @param initiator The address of the lender.
     * @param tokenId The unique ID of the note token representing the lending position.
     * @param maturityTimestamp The timestamp when the note matures.
     * @param coupon The fixed coupon rate associated with the note.
     * @param principal The initial principal amount lent.
     * @param partnerId The ID of the lending partner.
     * @param partnerFeeBPS The fee percentage charged by the lending partner.
     */
    event Lend(
        address indexed initiator,
        address indexed beneficiary,
        uint256 tokenId,
        uint128 maturityTimestamp,
        uint256 coupon,
        uint256 principal,
        bytes32 partnerId,
        uint256 partnerFeeBPS
    );

    /**
     * @dev Emitted when a user claims their lending position.
     * @param initiator The address of the claimer.
     * @param tokenId The unique ID of the note token representing the lending position.
     * @param principal The initial principal amount lent.
     * @param totalIncome The total income earned from the lending position.
     * @param fee The fee deducted from the income.
     * @param maturityTimestamp The timestamp when the note matures.
     * @param coupon The fixed coupon rate associated with the note.
     */
    event Claim(
        address indexed initiator,
        address indexed beneficiary,
        uint256 tokenId,
        uint128 maturityTimestamp,
        uint256 coupon,
        uint256 principal,
        uint256 totalIncome,
        uint256 fee,
        bytes32 partnerId
    );

    /**
     * @dev Emitted when daily data is updated.
     * @param updatedDay The day of the updated data.
     * @param floatingIncome The daily income for the day.
     * @param accFloatingIncome The accumulated floating income for the day.
     */
    event UpdateDailyFloatingIncome(
        uint256 updatedDay,
        uint256 floatingIncome,
        uint256 accFloatingIncome
    );

    /**
     * @dev Emitted when previous floating income data is updated.
     * @param firstDay The starting day of the updated data.
     * @param floatingIncomes The daily incomes for the days.
     * @param accFloatingIncomes The accumulated floating incomes for the days.
     */
    event UpdatePreviousFloatingIncome(
        uint256 firstDay,
        uint256[] floatingIncomes,
        uint256[] accFloatingIncomes
    );

    /**
     * @dev Emitted when the minimum lend limit is updated.
     * @param newMinLendLimit The new minimum lend limit.
     */
    event MinLendLimitUpdated(uint256 newMinLendLimit);

    /**
     * @dev Emitted when the maximum coupon limit is updated.
     * @param newMaxCouponLimit The new maximum coupon limit.
     */
    event MaxCouponLimitUpdated(uint256 newMaxCouponLimit);

    /**
     * @dev Emitted when the minimum maturity limit is updated.
     * @param newMinMaturityLimit The new minimum maturity limit.
     */
    event MinMaturityLimitUpdated(uint256 newMinMaturityLimit);

    /**
     * @dev Calculates the accumulated floating income for a lending note.
     * @param tokenId The unique ID of the lending note.
     * @return The accumulated floating income for the note.
     */
    function calculateFloatingIncome(
        uint256 tokenId
    ) external view returns (uint256);

    function calculateFixedIncome(
        uint256 tokenId
    ) external view returns (uint256);

    function lend(
        LendParams calldata lendParams,
        PriceFeed calldata priceFeed,
        Signature calldata feedSignature
    ) external;

    function permitLend(
        LendParams calldata lendParams,
        PriceFeed calldata priceFeed,
        Signature calldata feedSignature,
        Signature calldata permitSignature,
        uint256 permitDeadline
    ) external;

    function claim(
        address beneficiary,
        uint256 tokenId
    ) external returns (uint256 principal, uint256 userIncome, uint256 fee);

    function permitClaim(
        address beneficiary,
        uint256 tokenId,
        Signature calldata permitSignature,
        uint256 permitDeadline
    ) external returns (uint256 principal, uint256 userIncome, uint256 fee);

    function batchClaim(
        address[] calldata beneficiaries,
        uint256[] calldata tokenIds
    )
        external
        returns (
            uint256[] memory principals,
            uint256[] memory userIncomes,
            uint256[] memory fees
        );
}
