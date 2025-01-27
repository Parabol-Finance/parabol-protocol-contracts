// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

/**
 * @title Feed Signature Verifier Upgradeable
 * @dev An abstract contract that provides functionality for verifying off-chain signed data related to price feeds. It uses EIP-712 structured data signing.
 * This contract is designed to be inherited by other contracts that require verifying signatures for operations like lending, where terms (e.g., coupon rates and maturity dates) are signed off-chain.
 */

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {IFeedSignatureVerifier} from "../interfaces/IFeedSignatureVerifier.sol";
import {IFeedSignatureVerifierErrors} from "../interfaces/errors/IFeedSignatureVerifierErrors.sol";

abstract contract FeedSignatureVerifierUpgradeable is
    Initializable,
    IFeedSignatureVerifierErrors,
    IFeedSignatureVerifier,
    EIP712Upgradeable
{
    /**
     * @dev Type hash for price feed, used in constructing EIP-712 encoded data for signing and verification.
     * The calculation method keccak256("PriceFeed(uint128 maturityTimestamp,uint256 coupon,uint128 validAfter,uint128 validBefore)")
     */
    bytes32 public constant FEED_TYPEHASH =
        0x701231189974352bfaa1569deed55e4112e82929880c1bf8aaf9b14ed4d7796c;

    /**
     * @notice Internal storage structure for Feed Signature Verifier configuration.
     * @custom:storage-location erc7201:parabol.storage.FeedSignatureVerifier
     */
    struct FeedSignatureVerifierStorage {
        address _signer;
        bytes32 _nameHash;
        bytes32 _versionHash;
    }

    /**
     * This location is calculated to ensure no storage collisions with inherited contracts, utilizing a unique identifier.
     * The calculation method keccak256(abi.encode(uint256(keccak256("parabol.storage.FeedSignatureVerifier")) - 1)) & ~bytes32(uint256(0xff))
     */
    bytes32 private constant FeedSignatureVerifierStorageLocation =
        0x2d50a7cd9c750f906a8b1d1a3d86ef8ee90956378c2ec3a58fb384b6ec7e7700;

    /**
     * @dev Internal function to access the `FeedSignatureVerifierStorage`.
     * @return $ The storage struct representing the state of the Feed Signature Verifier.
     */
    function _getFeedSignatureVerifierStorage()
        private
        pure
        returns (FeedSignatureVerifierStorage storage $)
    {
        assembly {
            $.slot := FeedSignatureVerifierStorageLocation
        }
    }

    /**
     * @notice Initializes the FeedSignatureVerifier with given parameters.
     * @param name_ Name for the EIP-712 domain.
     * @param version_ Version for the EIP-712 domain.
     * @param signer_ Address authorized to sign the price feeds.
     */
    function __FeedSignatureVerifier_init(
        string memory name_,
        string memory version_,
        address signer_
    ) internal onlyInitializing {
        __FeedSignatureVerifier_init_unchained(name_, version_, signer_);
    }

    /**
     * @dev Unchained version of the initializer. Sets up the EIP-712 domain and the signer authorized to sign price feeds.
     * This is an internal function that is meant to be called by the chained initializer of the contract that inherits this contract.
     * @param name_ Name used for the EIP-712 domain, aiding in identifying the signing domain.
     * @param version_ Version used for the EIP-712 domain, helps in managing different versions of the signing domain.
     * @param signer_ The address authorized to sign the price feeds, ensuring integrity and authenticity of the data used by the contract.
     */
    function __FeedSignatureVerifier_init_unchained(
        string memory name_,
        string memory version_,
        address signer_
    ) internal onlyInitializing {
        FeedSignatureVerifierStorage
            storage $ = _getFeedSignatureVerifierStorage();
        $._signer = signer_;
        $._nameHash = keccak256(bytes(name_));
        $._versionHash = keccak256(bytes(version_));
    }

    /**
     * @notice Validates a signed price feed.
     * @param priceFeed Struct containing price feed details including maturity timestamp, coupon, and validity window (valid before and after).
     * @param signature Signature object containing the parts of the signature.
     * This function verifies that the price feed data provided is valid and signed by the authorized signer. It checks the signature against the feed's details,
     * ensuring that the data has not been tampered with and is within its validity period.
     */
    function validatePriceFeed(
        PriceFeed calldata priceFeed,
        Signature calldata signature
    ) public view {
        _validatePriceFeed(priceFeed, signature);
    }

    /**
     * @notice Computes the EIP-712 domain separator for the contract.
     * @return The EIP-712 domain separator.
     */
    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        FeedSignatureVerifierStorage
            storage $ = _getFeedSignatureVerifierStorage();

        return
            keccak256(
                abi.encode(
                    // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                    0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                    $._nameHash,
                    $._versionHash,
                    block.chainid,
                    address(this)
                )
            );
    }

    /**
     * @dev Internal function to validate the price feed data and its signature. Ensures that the price feed is within its validity period and
     * that the signature is authentic and signed by the authorized signer.
     * @param priceFeed Struct containing the details of the price feed including the maturity timestamp, coupon rate, and the validity period.
     * @param signature Signature object containing the components (v, r, s) of the signature.
     * Reverts if the current block timestamp is not within the validity period or if the signature verification fails.
     */
    function _validatePriceFeed(
        PriceFeed calldata priceFeed,
        Signature calldata signature
    ) internal view {
        if (block.timestamp <= priceFeed.validAfter)
            revert FeedSignatureVerifier__FeedNotYetValid(priceFeed.validAfter);
        if (block.timestamp >= priceFeed.validBefore)
            revert FeedSignatureVerifier__FeedExpired(priceFeed.validBefore);
        if (block.timestamp >= priceFeed.maturityTimestamp)
            revert FeedSignatureVerifier__InvalidMaturityTimestamp(
                priceFeed.maturityTimestamp
            );

        bytes32 structHash = keccak256(
            abi.encode(
                FEED_TYPEHASH,
                priceFeed.maturityTimestamp,
                priceFeed.coupon,
                priceFeed.validAfter,
                priceFeed.validBefore
            )
        );

        bytes32 domainSeparator = DOMAIN_SEPARATOR();
        bytes32 digest;
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), structHash)
            digest := keccak256(ptr, 0x42)
        }

        address recoveredAddress = ecrecover(
            digest,
            signature.v,
            signature.r,
            signature.s
        );
        if (recoveredAddress != _getFeedSignatureVerifierStorage()._signer) {
            if (recoveredAddress == address(0))
                revert FeedSignatureVerifier__InvalidSignature();

            revert FeedSignatureVerifier__InvalidSigner(
                recoveredAddress,
                _getFeedSignatureVerifierStorage()._signer
            );
        }
    }

    /**
     * @notice Sets a new signer for the price feed validation.
     * @dev This function must be overridden in the inheriting contract to include access control mechanisms.
     * It is intended to update the signer authorized to sign price feeds.
     * @param newSigner The address of the new signer.
     */
    function setVerifierSigner(address newSigner) external virtual;

    /**
     * @dev Internal function to set a new signer for the price feed validation.
     * This function updates the signer address within the `FeedSignatureVerifierStorage` and emits an event upon the update.
     * @param newSigner The address of the new signer.
     * Requirements:
     * - `newSigner` cannot be the zero address.
     * - `newSigner` must be different from the current signer to prevent unnecessary updates.
     */
    function _setVerifierSigner(address newSigner) internal {
        FeedSignatureVerifierStorage
            storage $ = _getFeedSignatureVerifierStorage();

        if (newSigner == address(0))
            revert FeedSignatureVerifier__ZeroAddress();

        if (newSigner == $._signer) revert FeedSignatureVerifier__SameSigner();

        $._signer = newSigner;
        emit FeedSignatureVerifier__SignerChanged(newSigner);
    }
}
