// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

/**
 * @title ERC721 with permit
 * @dev Extension to ERC721 that includes a permit function for signature based approvals
 */
interface IFeedSignatureVerifier {
    event FeedSignatureVerifier__SignerChanged(address indexed signer);
    struct PriceFeed {
        uint128 maturityTimestamp;
        uint256 coupon;
        uint128 validAfter;
        uint128 validBefore;
    }

    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /**
     * @dev Approve of a specific token ID for spending by spender via signature
     * @param priceFeed The account feed data to validate
     */
    // function validatePriceFeed(
    //     PriceFeed calldata priceFeed,
    //     uint8 v,
    //     bytes32 r,
    //     bytes32 s
    // ) external view;
    function validatePriceFeed(
        PriceFeed calldata priceFeed,
        Signature calldata signature
    ) external view;
}
