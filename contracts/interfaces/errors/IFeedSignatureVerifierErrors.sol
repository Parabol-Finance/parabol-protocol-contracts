// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IFeedSignatureVerifierErrors {
    error FeedSignatureVerifier__ExpiredSignature();
    error FeedSignatureVerifier__InvalidSigner(
        address signer,
        address expectedSigner
    );
    error FeedSignatureVerifier__InvalidSignature();
    error FeedSignatureVerifier__ZeroAddress();
    error FeedSignatureVerifier__SameSigner();
    error FeedSignatureVerifier__FeedNotYetValid(uint128 validAfter);
    error FeedSignatureVerifier__FeedExpired(uint128 validBefore);
    error FeedSignatureVerifier__InvalidMaturityTimestamp(
        uint128 maturityTimestamp
    );
}
