// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

/**
 * @title Reserve Stability Pool
 * @dev This contract manages lending, claiming, and interest rate calculations for a decentralized Reserve Stability Pool.
 *
 * The pool accepts deposits in a stablecoin (ParaUSD) and issues interest-bearing notes represented as ERC-721 tokens.
 * Lenders deposit ParaUSD, and in return, they receive an note token representing their lending position.
 * These notes generate income both from risk-free fixed-rate notes and floating overnight repo market yields.
 * The contract is designed to be upgradeable to adapt to changing requirements and can only be managed by the DEFAULT_ADMIN_ROLE.
 *
 * The key functions and features of this contract include:
 * - Lending ParaUSD to the pool in exchange for notes.
 * - Claiming the principal and earned income from notes.
 * - Daily updates of the floating income based on the pool's total and locked supply.
 * - Admin functionality to manage contract parameters.
 *
 * Roles:
 * - PAUSER_ROLE: Allows an account to pause and unpause lending and claiming.
 * - DEFAULT_ADMIN_ROLE: Allows an account to manage administrative setter functions.
 * - FLOATING_INCOME_ROLE: Allows an account to update daily and previous day's floating income.
 */

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {FeedSignatureVerifierUpgradeable} from "./base/FeedSignatureVerifierUpgradeable.sol";
import {PartnerFeeManagerUpgradeable} from "./base/PartnerFeeManagerUpgradeable.sol";
import {INonFungibleNotePosition} from "./interfaces/INonFungibleNotePosition.sol";
import {IParabolUSD} from "./interfaces/IParabolUSD.sol";
import {IReserveStabilityPool} from "./interfaces/IReserveStabilityPool.sol";
import {IReserveStabilityPoolErrors} from "./interfaces/errors/IReserveStabilityPoolErrors.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract ReserveStabilityPool is
    Initializable,
    UUPSUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    FeedSignatureVerifierUpgradeable,
    PartnerFeeManagerUpgradeable,
    IReserveStabilityPoolErrors,
    IReserveStabilityPool
{
    /**
     * @dev Role identifier for accounts allowed to pause and unpause the contract functionalities.
     * The calculation method keccak256("PAUSER")
     */
    bytes32 public constant PAUSER_ROLE =
        0x539440820030c4994db4e31b6b800deafd503688728f932addfe7a410515c14c;

    /**
     * @dev Role identifier for the default admin role, which is granted to the contract deployer.
     * The calculation method keccak256("FLOATING_INCOME")
     */
    bytes32 public constant FLOATING_INCOME_ROLE =
        0x0ecb55fc9466b7170e423f72ef5c786fa873575a722f10d8946decfa077740a1;

    /**
     * @dev Storage structure encapsulating all state variables of the Reserve Stability Pool.
     *      - `_paraUSD`: The ParabolUSD stablecoin contract interface.
     *      - `_nonFungibleNotePosition`: Interface for interacting with non-fungible notes representing lending positions.
     *      - `_minLendLimit`: The minimum amount of ParaUSD that can be lent into the pool.
     *      - `_maxCouponLimit`: The maximum coupon rate that can be applied to a lending position.
     *      - `_lastFloatingIncomeUpdateDay`: Tracks the last day when the floating income was updated.
     *      - `_minMaturityLimit`: The minimum maturity limit for lending positions.
     *      - `_accFloatingIncome`: Maps each day to the total accumulated floating income, facilitating interest calculations.
     * @custom:storage-location erc7201:parabol.storage.ReserveStabilityPool
     */
    struct ReserveStabilityPoolStorage {
        IParabolUSD _paraUSD;
        INonFungibleNotePosition _nonFungibleNotePosition;
        uint256 _minLendLimit;
        uint256 _maxCouponLimit;
        uint256 _lastFloatingIncomeUpdateDay;
        uint128 _minMaturityLimit;
        mapping(uint256 day => uint256 accfloatingIncome) _accFloatingIncome;
    }

    /**
     * @dev Represents the storage slot location used to store the `ReserveStabilityPoolStorage` struct.
     * This location is determined by the keccak256 hash of a specifically crafted string, ensuring it is unique and does not collide with other storage slots used by inherited contracts.
     * The calculation method `keccak256(abi.encode(uint256(keccak256("parabol.storage.ReserveStabilityPool")) - 1)) & ~bytes32(uint256(0xff))`
     * ensures the slot is deterministic, unique, and unlikely to clash with other slots.
     */
    bytes32 private constant ReserveStabilityPoolStorageLocation =
        0x030d259693df83873330f86abeddae6a3ea94185fb1c088ba468a516ad6ea600;

    /**
     * @dev Internal function to access the ReserveStabilityPoolStorage struct.
     * @return $ The storage struct representing the state of the Reserve Stability Pool.
     */
    function _getReserveStabilityPoolStorage()
        private
        pure
        returns (ReserveStabilityPoolStorage storage $)
    {
        assembly {
            $.slot := ReserveStabilityPoolStorageLocation
        }
    }

    /**
     * @return The ParabolUSD contract interface.
     */
    function paraUSD() external view returns (IParabolUSD) {
        return _getReserveStabilityPoolStorage()._paraUSD;
    }

    /**
     * @return The NonFungibleNotePosition contract interface.
     */
    function nonFungibleNotePosition()
        external
        view
        returns (INonFungibleNotePosition)
    {
        return _getReserveStabilityPoolStorage()._nonFungibleNotePosition;
    }

    /**
     * @return The minimum lending limit.
     */
    function minLendLimit() external view returns (uint256) {
        return _getReserveStabilityPoolStorage()._minLendLimit;
    }

    /**
     * @return The last day when the floating income was updated.
     */
    function lastFloatingIncomeUpdateDay() external view returns (uint256) {
        return _getReserveStabilityPoolStorage()._lastFloatingIncomeUpdateDay;
    }

    /**
     * @return The accumulated floating income for a given day.
     */
    function accFloatingIncome(uint256 day) external view returns (uint256) {
        return _getReserveStabilityPoolStorage()._accFloatingIncome[day];
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the Reserve Stability Pool contract with essential components and configuration.
     * This setup includes defining the main contracts (e.g., ParabolUSD and NonFungibleNotePosition),
     * setting up roles, and initializing the Feed Signature Verifier with a name, version, and signer.
     * @param paraUSD_ The interface of the ParabolUSD contract.
     * @param nonFungibleNotePosition_ The interface of the NonFungibleNotePosition contract.
     * @param verifierName_ The name of the verifier used in EIP-712 domain separation.
     * @param verifierVersion_ The version of the verifier used in EIP-712 domain separation.
     * @param verifierSigner_ The signer's address used to verify EIP-712 signatures.
     * @param adminAccount_ The address of the initial admin, who is granted the DEFAULT_ADMIN_ROLE.
     * @param floatingIncomeAccount_ The address of the account granted the FLOATING_INCOME_ROLE.
     * @param pauserAccount_ The address of the account granted the PAUSER_ROLE.
     */
    function initialize(
        IParabolUSD paraUSD_,
        INonFungibleNotePosition nonFungibleNotePosition_,
        string memory verifierName_,
        string memory verifierVersion_,
        address verifierSigner_,
        address adminAccount_,
        address floatingIncomeAccount_,
        address pauserAccount_
    ) external initializer {
        if (
            address(paraUSD_) == address(0) ||
            address(nonFungibleNotePosition_) == address(0) ||
            verifierSigner_ == address(0) ||
            adminAccount_ == address(0) ||
            floatingIncomeAccount_ == address(0) ||
            pauserAccount_ == address(0)
        ) revert ReserveStabilityPool__ZeroAddress();

        __Pausable_init_unchained();
        __EIP712_init_unchained(verifierName_, verifierVersion_);
        __FeedSignatureVerifier_init_unchained(
            verifierName_,
            verifierVersion_,
            verifierSigner_
        );

        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        $._paraUSD = paraUSD_;
        $._nonFungibleNotePosition = nonFungibleNotePosition_;
        $._minLendLimit = 1000 ether; // 1000 ParaUSD
        $._maxCouponLimit = 1000; // 10% coupon
        $._minMaturityLimit = 2 days;

        _grantRole(DEFAULT_ADMIN_ROLE, adminAccount_);
        _grantRole(FLOATING_INCOME_ROLE, floatingIncomeAccount_);
        _grantRole(PAUSER_ROLE, pauserAccount_);

        emit MinLendLimitUpdated($._minLendLimit);
        emit MaxCouponLimitUpdated($._maxCouponLimit);
        emit MinMaturityLimitUpdated($._minMaturityLimit);
    }

    /**
     * @dev Allows the owner to pause the contract.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Allows the owner to unpause the contract.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Sets the minimum lending limit.
     * @param minLendLimit_ The new minimum lending limit.
     */
    function setMinLendLimit(
        uint256 minLendLimit_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (minLendLimit_ == 0)
            revert ReserveStabilityPool__InvalidMinLendLimit();

        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();
        if ($._minLendLimit == minLendLimit_)
            revert ReserveStabilityPool__SameMinLendLimit();

        $._minLendLimit = minLendLimit_;

        emit MinLendLimitUpdated(minLendLimit_);
    }

    /**
     * @dev Updates the signer used for validating price feeds within the Reserve Stability Pool.
     * This function overrides the base FeedSignatureVerifierUpgradeable contract's setVerifierSigner method
     * to incorporate access control, ensuring only accounts with DEFAULT_ADMIN_ROLE can change the signer.
     * @param newSigner_ The address of the new signer.
     */
    function setVerifierSigner(
        address newSigner_
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        _setVerifierSigner(newSigner_);
    }

    /**
     * @notice Updates the maximum coupon limit for lending notes.
     * @dev Only callable by an account with the DEFAULT_ADMIN_ROLE. Reverts if the new limit exceeds 100% or is the same as the current limit.
     * @param maxCouponLimit_ The new maximum coupon limit as a percentage basis points (e.g., 1000 for 10%).
     */
    function setMaxCouponLimit(
        uint256 maxCouponLimit_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (maxCouponLimit_ > DENOMINATOR)
            revert ReserveStabilityPool__InvalidMaxCouponLimit();

        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        if (maxCouponLimit_ == $._maxCouponLimit)
            revert ReserveStabilityPool__SameMaxCouponLimit();

        $._maxCouponLimit = maxCouponLimit_;

        emit MaxCouponLimitUpdated(maxCouponLimit_);
    }

    /**
     * @notice Updates the minimum maturity limit in seconds for lending notes.
     * @dev Only callable by an account with the DEFAULT_ADMIN_ROLE. Reverts if the new limit is the same as the current limit.
     * @param minMaturityLimit_ The new minimum maturity limit in seconds.
     */
    function setMinMaturityLimit(
        uint128 minMaturityLimit_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();
        if (minMaturityLimit_ == $._minMaturityLimit)
            revert ReserveStabilityPool__SameMinMaturityLimit();

        $._minMaturityLimit = minMaturityLimit_;

        emit MinMaturityLimitUpdated(minMaturityLimit_);
    }

    /**
     * @dev Allows a user to lend ParaUSD using an EIP-2612 permit, avoiding the need for a separate token approval transaction.
     * @param lendParams The parameters for the lending operation.
     * @param priceFeed The price feed data including the maturity timestamp and coupon rate, ensuring the operation is within valid parameters.
     * @param feedSignature The signature for the price feed data, ensuring it's verified and valid.
     * @param permitSignature The signature for the permit operation, ensuring it's verified and valid.
     * @param permitDeadline The deadline for the permit signature.
     */
    function permitLend(
        LendParams calldata lendParams,
        PriceFeed calldata priceFeed,
        Signature calldata feedSignature,
        Signature calldata permitSignature,
        uint256 permitDeadline
    ) external whenNotPaused {
        try
            _getReserveStabilityPoolStorage()._paraUSD.permit(
                msg.sender,
                address(this),
                lendParams.principal,
                permitDeadline,
                permitSignature.v,
                permitSignature.r,
                permitSignature.s
            )
        {} catch {}

        _lend(lendParams, priceFeed, feedSignature);
    }

    /**
     * @dev Allows a user to claim ParaUSD using an EIP-2612 permit, avoiding the need for a separate token approval transaction.
     * @param beneficiary The address to which the claimed funds will be sent.
     * @param tokenId The unique identifier of the NFT position to claim.
     * @param permitSignature The signature for the permit operation, ensuring it's verified and valid.
     * @param permitDeadline The deadline for the permit signature.
     * @return principal The principal amount of the position.
     * @return userIncome The user's income from the position.
     * @return fee The fee charged for the position.
     */
    function permitClaim(
        address beneficiary,
        uint256 tokenId,
        Signature calldata permitSignature,
        uint256 permitDeadline
    )
        external
        whenNotPaused
        returns (uint256 principal, uint256 userIncome, uint256 fee)
    {
        try
            _getReserveStabilityPoolStorage()._nonFungibleNotePosition.permit(
                address(this),
                tokenId,
                permitDeadline,
                permitSignature.v,
                permitSignature.r,
                permitSignature.s
            )
        {} catch {}

        (principal, userIncome, fee) = _claim(beneficiary, tokenId);
    }

    /**
     * @dev Updates the floating income data for previous days.
     * @param floatingIncomes An array of previous floating income values.
     */
    function updatePreviousFloatingIncome(
        uint256 firstDay,
        uint256 dayCount,
        uint256[] calldata floatingIncomes
    ) external onlyRole(FLOATING_INCOME_ROLE) {
        if (firstDay == 0 || dayCount == 0)
            revert ReserveStabilityPool__InvalidInputParameter();

        if (dayCount != floatingIncomes.length)
            revert ReserveStabilityPool__ArrayLengthMismatch();

        uint256 currentDay = getDay(block.timestamp);
        uint256 lastUpdateDay = firstDay + dayCount - 1;

        if (lastUpdateDay >= currentDay)
            revert ReserveStabilityPool__UpdateDayIsNotValid(lastUpdateDay);

        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        uint256 _lastFloatingIncomeUpdateDay = $._lastFloatingIncomeUpdateDay;

        if (
            _lastFloatingIncomeUpdateDay != 0 &&
            _lastFloatingIncomeUpdateDay < firstDay - 1
        ) revert ReserveStabilityPool__FloatingIncomeNotSynced();

        uint256 lastAccFloatingIncome = $._accFloatingIncome[firstDay - 1];
        uint256[] memory accFloatingIncomes = new uint256[](dayCount);

        for (uint256 i; i < dayCount; ) {
            $._accFloatingIncome[
                firstDay + i
            ] = lastAccFloatingIncome += floatingIncomes[i];
            accFloatingIncomes[i] = lastAccFloatingIncome;

            unchecked {
                i++;
            }
        }

        if (_lastFloatingIncomeUpdateDay < lastUpdateDay)
            $._lastFloatingIncomeUpdateDay = lastUpdateDay;
        else if (
            $._accFloatingIncome[lastUpdateDay + 1] <
            $._accFloatingIncome[lastUpdateDay] &&
            lastUpdateDay < _lastFloatingIncomeUpdateDay
        ) {
            revert ReserveStabilityPool__FloatingIncomeNotSynced();
        }

        emit UpdatePreviousFloatingIncome(
            firstDay,
            floatingIncomes,
            accFloatingIncomes
        );
    }

    /**
     * @dev Updates the daily floating income data.
     * @param income The calculated per token per wei per second income generated in the protocol since the last update multiplied by 1e25.
     */
    function updateDailyFloatingIncome(
        uint256 income
    ) external onlyRole(FLOATING_INCOME_ROLE) {
        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        uint256 updatedDay = getDay(block.timestamp) - 1;

        if ($._accFloatingIncome[updatedDay] != 0)
            revert ReserveStabilityPool__DailyFloatingIncomeAlreadyUpdated();

        uint256 _lastFloatingIncomeUpdateDay = $._lastFloatingIncomeUpdateDay;

        if (
            _lastFloatingIncomeUpdateDay != updatedDay - 1 &&
            _lastFloatingIncomeUpdateDay != 0
        ) revert ReserveStabilityPool__PreviousDayNotUpdated();

        uint256 newAccFloatingIncome = $._accFloatingIncome[updatedDay - 1] +
            income;
        $._accFloatingIncome[updatedDay] = newAccFloatingIncome;

        $._lastFloatingIncomeUpdateDay = updatedDay;

        emit UpdateDailyFloatingIncome(
            updatedDay,
            income,
            newAccFloatingIncome
        );
    }

    /**
     * @dev Checks if the maturity date of a position has passed.
     * @param tokenId The unique ID of the position.
     * @return A boolean indicating whether the maturity date has passed.
     */
    function isMaturityPassed(
        uint256 tokenId
    ) external view whenNotPaused returns (bool) {
        return
            _isMaturityPassed(
                _getReserveStabilityPoolStorage()
                    ._nonFungibleNotePosition
                    .getLendInfo(tokenId)
                    .maturityTimestamp
            );
    }

    function isFloatingIncomeSynced() external view returns (bool) {
        return
            _getReserveStabilityPoolStorage()._lastFloatingIncomeUpdateDay ==
            getDay(block.timestamp) - 1;
    }

    /**
     * @notice Allows a user to lend ParaUSD to the ReserveStabilityPool.
     * @dev Users lend ParaUSD to the pool and receive an ERC-721 NFT representing their position. The position accrues interest over time.
     * @param lendParams The parameters for the lending operation.
     * @param priceFeed The price feed data including the maturity timestamp and coupon rate, ensuring the operation is within valid parameters.
     * @param feedSignature The signature for the price feed data, ensuring it's verified and valid.
     */
    function lend(
        LendParams calldata lendParams,
        PriceFeed calldata priceFeed,
        Signature calldata feedSignature
    ) external whenNotPaused {
        _lend(lendParams, priceFeed, feedSignature);
    }

    /**
     * @notice Allows a position holder to claim the principal and earned income on their position after maturity.
     * @dev Upon claiming, the position is burned, and the holder receives both the principal and the earned income. This function ensures that
     * only the position's owner can claim and that the position has reached maturity.
     * @param beneficiary The address to which the claimed funds will be sent.
     * @param tokenId The ID of the position token to be claimed.
     * @return principal The principal amount of the position.
     * @return userIncome The user's income from the position.
     * @return fee The fee charged for the position.
     */
    function claim(
        address beneficiary,
        uint256 tokenId
    )
        external
        whenNotPaused
        returns (uint256 principal, uint256 userIncome, uint256 fee)
    {
        (principal, userIncome, fee) = _claim(beneficiary, tokenId);
    }

    /**
     * @notice Allows a user to claim multiple positions at once.
     * @dev This function is used to claim multiple positions at once, reducing the number of transactions required.
     * @param beneficiaries An array of addresses to which the claimed funds will be sent.
     * @param tokenIds An array of unique IDs of the positions to be claimed.
     * @return principals An array of the principal amounts of the positions.
     * @return userIncomes An array of the user's income from the positions.
     * @return fees An array of the fees charged for the positions.
     */
    function batchClaim(
        address[] calldata beneficiaries,
        uint256[] calldata tokenIds
    )
        external
        whenNotPaused
        returns (
            uint256[] memory principals,
            uint256[] memory userIncomes,
            uint256[] memory fees
        )
    {
        uint256 length = beneficiaries.length;
        if (length != tokenIds.length)
            revert ReserveStabilityPool__ArrayLengthMismatch();

        principals = new uint256[](length);
        userIncomes = new uint256[](length);
        fees = new uint256[](length);

        for (uint256 i; i < length; ) {
            (principals[i], userIncomes[i], fees[i]) = _claim(
                beneficiaries[i],
                tokenIds[i]
            );

            unchecked {
                i++;
            }
        }
    }

    /**
     * @dev Calculates the income generated by a position.
     * @param tokenId The unique ID of the position.
     * @return The income generated by the position.
     */
    function calculateFixedIncome(
        uint256 tokenId
    ) external view whenNotPaused returns (uint256) {
        INonFungibleNotePosition.Note
            memory lendInfo = _getReserveStabilityPoolStorage()
                ._nonFungibleNotePosition
                .getLendInfo(tokenId);
        return
            _calculateFixedIncome(
                lendInfo.principal,
                lendInfo.coupon,
                block.timestamp < lendInfo.maturityTimestamp
                    ? uint128(block.timestamp)
                    : lendInfo.maturityTimestamp,
                lendInfo.lendTimestamp
            );
    }

    /**
     * @dev Calculates the accumulated floating income for a position.
     * @param tokenId The unique ID of the position.
     * @return The accumulated floating income for the position.
     */
    function calculateFloatingIncome(
        uint256 tokenId
    ) external view whenNotPaused returns (uint256) {
        INonFungibleNotePosition.Note
            memory lendInfo = _getReserveStabilityPoolStorage()
                ._nonFungibleNotePosition
                .getLendInfo(tokenId);

        return
            _calculateFloatingIncome(
                lendInfo.principal,
                block.timestamp < lendInfo.maturityTimestamp
                    ? uint128(block.timestamp)
                    : lendInfo.maturityTimestamp,
                lendInfo.lendTimestamp
            );
    }

    /**
     * @dev Calculates the day number based on a given timestamp.
     * @param timestamp The timestamp for which to determine the day.
     * @return The day number as calculated from the timestamp.
     */
    function getDay(uint256 timestamp) public pure returns (uint128) {
        return uint128(timestamp) / 1 days;
    }

    /**
     * @dev Checks whether the maturity date of a position has been reached.
     * @param maturityTimestamp The maturity date to check.
     * @return true if the maturity date has passed; otherwise, false.
     */
    function _isMaturityPassed(
        uint128 maturityTimestamp
    ) internal view returns (bool) {
        return maturityTimestamp <= block.timestamp;
    }

    /**
     * @dev Calculates the total income for a position combining both fixed and floating income.
     * @param lendInfo The position information.
     * @return The total income for the position.
     */
    function _calculateTotalIncome(
        INonFungibleNotePosition.Note memory lendInfo
    ) internal view returns (uint256) {
        return
            _calculateFixedIncome(
                lendInfo.principal,
                lendInfo.coupon,
                lendInfo.maturityTimestamp,
                lendInfo.lendTimestamp
            ) +
            _calculateFloatingIncome(
                lendInfo.principal,
                lendInfo.maturityTimestamp,
                lendInfo.lendTimestamp
            );
    }

    /**
     * @dev Internal function to calculate the income generated by a position.
     * @param principal The principal amount.
     * @param coupon The fixed coupon rate.
     * @param lastTimestamp The last timestamp (maturity or current time).
     * @param lendTimestamp The lending timestamp.
     * @return The income generated by the position.
     */
    function _calculateFixedIncome(
        uint256 principal,
        uint256 coupon,
        uint128 lastTimestamp,
        uint128 lendTimestamp
    ) internal pure returns (uint256) {
        return
            (principal * coupon * (lastTimestamp - lendTimestamp)) /
            (DENOMINATOR * 360 days);
    }

    /**
     * @dev Internal function to calculate the accumulated floating income for a position.
     * @param principal The principal amount.
     * @param lastTimestamp The last timestamp (maturity or current time).
     * @param lendTimestamp The lending timestamp.
     * @return The accumulated floating income for the position.
     */
    function _calculateFloatingIncome(
        uint256 principal,
        uint128 lastTimestamp,
        uint128 lendTimestamp
    ) internal view returns (uint256) {
        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        uint256 _lastFloatingIncomeUpdateDay = $._lastFloatingIncomeUpdateDay;

        if (_lastFloatingIncomeUpdateDay == 0) return 0;

        uint128 lendDay = getDay(lendTimestamp);
        if (_lastFloatingIncomeUpdateDay < lendDay) return 0;

        uint128 maturityDay = getDay(lastTimestamp);

        uint256 lastRemainingAccFloatingIncome;
        uint256 maturityDayUserIncome;

        if (_lastFloatingIncomeUpdateDay >= maturityDay) {
            lastRemainingAccFloatingIncome = $._accFloatingIncome[
                maturityDay - 1
            ];

            maturityDayUserIncome =
                (($._accFloatingIncome[maturityDay] -
                    lastRemainingAccFloatingIncome) *
                    principal *
                    (lastTimestamp - (maturityDay * 1 days))) /
                1e25;
        } else {
            lastRemainingAccFloatingIncome = $._accFloatingIncome[
                _lastFloatingIncomeUpdateDay
            ];
        }

        uint256 lendDayAccIncome = $._accFloatingIncome[lendDay];

        uint256 lendDayUserIncome = ((lendDayAccIncome -
            $._accFloatingIncome[lendDay - 1]) *
            principal *
            (((lendDay + 1) * 1 days) - lendTimestamp)) / 1e25;

        uint256 remainingDaysUserIncome = ((lastRemainingAccFloatingIncome -
            lendDayAccIncome) *
            principal *
            1 days) / 1e25;

        return
            lendDayUserIncome + remainingDaysUserIncome + maturityDayUserIncome;
    }

    /**
     * @dev Lends ParaUSD to the pool and mints a position NFT.
     * @param lendParams The parameters for the lending operation.
     * @param priceFeed The price feed data including the maturity timestamp and coupon rate, ensuring the operation is within valid parameters.
     * @param feedSignature The signature for the price feed data, ensuring it's verified and valid.
     */
    function _lend(
        LendParams calldata lendParams,
        PriceFeed calldata priceFeed,
        Signature calldata feedSignature
    ) internal {
        _validatePriceFeed(priceFeed, feedSignature);
        PartnerFeeManagerUpgradeable.PartnerInfo
            memory partnerInfo = _validatePartnerId(lendParams.partnerId);

        if (partnerInfo._partnerFeeBPS != lendParams.partnerFeeBPS)
            revert ReserveStabilityPool__PartnerFeeChanged();

        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        if (priceFeed.coupon > $._maxCouponLimit || priceFeed.coupon == 0)
            revert ReserveStabilityPool__InvalidCoupon();

        if (priceFeed.maturityTimestamp < block.timestamp + $._minMaturityLimit)
            revert ReserveStabilityPool__InvalidMaturity();

        if (lendParams.principal < $._minLendLimit)
            revert ReserveStabilityPool__InsufficientPrincipal();

        $._paraUSD.transferFrom(
            msg.sender,
            address(this),
            lendParams.principal
        );

        uint256 tokenId = $._nonFungibleNotePosition.mint(
            lendParams.beneficiary,
            INonFungibleNotePosition.Note({
                lendTimestamp: uint128(block.timestamp),
                maturityTimestamp: priceFeed.maturityTimestamp,
                coupon: priceFeed.coupon,
                principal: lendParams.principal,
                partnerFeeBPS: lendParams.partnerFeeBPS,
                partnerId: lendParams.partnerId
            })
        );

        emit Lend({
            initiator: msg.sender,
            beneficiary: lendParams.beneficiary,
            tokenId: tokenId,
            maturityTimestamp: priceFeed.maturityTimestamp,
            coupon: priceFeed.coupon,
            principal: lendParams.principal,
            partnerId: lendParams.partnerId,
            partnerFeeBPS: lendParams.partnerFeeBPS
        });
    }

    /**
     * @dev Claims the principal and earned income from a position.
     * @param beneficiary The address to receive the claimed funds.
     * @param tokenId The unique ID of the position to claim
     * @return principal The principal amount of the position.
     * @return userIncome The user's income from the position.
     * @return fee The fee charged for the position.
     */
    function _claim(
        address beneficiary,
        uint256 tokenId
    ) internal returns (uint256 principal, uint256 userIncome, uint256 fee) {
        ReserveStabilityPoolStorage
            storage $ = _getReserveStabilityPoolStorage();

        INonFungibleNotePosition _nonFungibleNotePosition = $
            ._nonFungibleNotePosition;

        if (msg.sender != _nonFungibleNotePosition.ownerOf(tokenId))
            revert ReserveStabilityPool__NotTokenOwner();

        INonFungibleNotePosition.Note memory lendInfo = _nonFungibleNotePosition
            .getLendInfo(tokenId);

        if (!_isMaturityPassed(lendInfo.maturityTimestamp))
            revert ReserveStabilityPool__MaturityNotPassed();

        uint256 totalIncome = _calculateTotalIncome(lendInfo);
        fee = (totalIncome * lendInfo.partnerFeeBPS) / DENOMINATOR;
        userIncome = totalIncome - fee;

        _nonFungibleNotePosition.burn(tokenId);

        IParabolUSD _paraUSD = $._paraUSD;
        if (fee > 0)
            _paraUSD.mint(
                getPartnerInfoById(lendInfo.partnerId)._partnerVault,
                fee
            );

        if (userIncome > 0) _paraUSD.mint(beneficiary, userIncome);

        principal = lendInfo.principal;
        _paraUSD.transfer(beneficiary, principal);

        emit Claim({
            initiator: msg.sender,
            beneficiary: beneficiary,
            tokenId: tokenId,
            maturityTimestamp: lendInfo.maturityTimestamp,
            coupon: lendInfo.coupon,
            principal: principal,
            totalIncome: totalIncome,
            fee: fee,
            partnerId: lendInfo.partnerId
        });
    }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
