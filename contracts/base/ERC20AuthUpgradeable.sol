// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

/**
 * @title ERC20AuthUpgradeable
 * @dev Extends ERC20BaseUpgradeable with authorization capabilities for actions such as transfers and burns using EIP-712 signed authorizations.
 * This contract allows token holders to pre-approve transactions via off-chain signatures,
 * thereby enabling gasless transactions and improving user experience by reducing the need for on-chain approvals.
 * It is designed to support upgradeable token contracts within the ERC20 framework.
 */

import {ERC20BaseUpgradeable} from "./ERC20BaseUpgradeable.sol";
import {IERC20AuthErrors} from "../interfaces/errors/IERC20AuthErrors.sol";
import {IERC20Auth} from "../interfaces/IERC20Auth.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

abstract contract ERC20AuthUpgradeable is
    ERC20BaseUpgradeable,
    IERC20AuthErrors,
    IERC20Auth
{
    /**
     * @dev Type hash for transfer with authorization, used in constructing EIP-712 encoded data for signing and verification.
     * The calculation method keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
     */
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267;

    /**
     * @dev Type hash for receiving with authorization, enabling third parties to submit transfers that have been pre-approved by token holders.
     * The calculation method keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
     */
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8;

    /**
     * @dev Type hash for burning tokens with authorization, allowing token holders to delegate token burns to trusted operators or for gasless transactions.
     * The calculation method keccak256("BurnWithAuthorization(address from,address burner,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)")
     */
    bytes32 public constant BURN_WITH_AUTHORIZATION_TYPEHASH =
        0xc6ff10fb2285e169dd1d1f8206c0569443fb9d311f70ad1e16e8a778131b7a60;

    /**
     * @dev Type hash for canceling authorizations, providing a mechanism to invalidate previously signed but not yet executed transactions.
     * The calculation method keccak256("CancelAuthorization(address authorizer,bytes32 nonce)")
     */
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        0x158b0a9edf7a828aad02f63cd515c68ef2f50ba807396f6d12842833a1597429;

    /**
     * @dev Struct to store mappings of authorizations, specifically tracking whether a nonce has been used for a given address.
     * This structure is crucial for the operation of the contract's authorization mechanism, ensuring nonces are unique and not reusable.
     * @custom:storage-location erc7201:parabol.storage.ERC20Auth
     */
    struct ERC20AuthStorage {
        mapping(address authorizer => mapping(bytes32 nonce => bool used)) _authorizationStates;
    }

    /**
     * @dev The storage slot location used for the ERC20AuthStorage struct.
     * This location is calculated to ensure no storage collisions with inherited contracts, utilizing a unique identifier.
     * The calculation method keccak256(abi.encode(uint256(keccak256("parabol.storage.ERC20Auth")) - 1)) & ~bytes32(uint256(0xff))
     */
    bytes32 private constant ERC20AuthStorageLocation =
        0xbcf05f70477d120e0db7bf46eed583278bd64f83ca1cbf5d8f6e4328951c6800;

    /**
     * @dev Retrieves the ERC20AuthStorage struct from its designated storage slot.
     * This internal function is used to access the contract's authorization states mapping, leveraging Solidity's assembly features for direct storage slot access.
     * @return $ The ERC20AuthStorage struct instance from the contract's storage.
     */
    function _getERC20AuthStorage()
        private
        pure
        returns (ERC20AuthStorage storage $)
    {
        assembly {
            $.slot := ERC20AuthStorageLocation
        }
    }

    /**
     * @notice Returns the state of an authorization
     * @dev Nonces are randomly generated 32-byte data unique to the
     * authorizer's address
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @return True if the nonce is used
     */
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view returns (bool) {
        return _getERC20AuthStorage()._authorizationStates[authorizer][nonce];
    }

    /**
     * @notice Execute a transfer with a signed authorization
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(
                abi.encode(
                    TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce
                )
            ),
            v,
            r,
            s
        );

        _markAuthorizationAsUsed(from, nonce);
        _transfer(from, to, value);
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address
     * matches the caller of this function to prevent front-running attacks.
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        if (to != msg.sender) revert ERC20Auth__InvalidCaller(msg.sender, to);
        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(
                abi.encode(
                    RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce
                )
            ),
            v,
            r,
            s
        );

        _markAuthorizationAsUsed(from, nonce);
        _transfer(from, to, value);
    }

    /**
     * @notice Allows a token holder to authorize the burn of their tokens.
     * @dev This function verifies the EIP-712 signed authorization for burning tokens. It checks the validity of the signature,
     * the nonce, and the timing constraints before executing the burn. This enables delegated burns and gasless transactions.
     * @param from The address from which tokens will be burned.
     * @param burner The address that is authorized to burn the tokens.
     * @param value The amount of tokens to burn.
     * @param validAfter The time after which the authorization is valid.
     * @param validBefore The time before which the authorization must be executed.
     * @param nonce The unique nonce used to identify the authorization.
     * @param v The recovery byte of the signature.
     * @param r Half of the ECDSA signature pair.
     * @param s The other half of the ECDSA signature pair.
     */
    function burnWithAuthorization(
        address from,
        address burner,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        if (burner != msg.sender)
            revert ERC20Auth__InvalidCaller(msg.sender, burner);

        _requireValidAuthorization(from, nonce, validAfter, validBefore);
        _requireValidSignature(
            from,
            keccak256(
                abi.encode(
                    BURN_WITH_AUTHORIZATION_TYPEHASH,
                    from,
                    burner,
                    value,
                    validAfter,
                    validBefore,
                    nonce
                )
            ),
            v,
            r,
            s
        );

        _markAuthorizationAsUsed(from, nonce);
        _burn(from, value);
    }

    /**
     * @notice Attempt to cancel an authorization
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _requireUnusedAuthorization(authorizer, nonce);
        _requireValidSignature(
            authorizer,
            keccak256(
                abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce)
            ),
            v,
            r,
            s
        );

        _getERC20AuthStorage()._authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    /**
     * @notice Check that an authorization is unused
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     */
    function _requireUnusedAuthorization(
        address authorizer,
        bytes32 nonce
    ) private view {
        if (_getERC20AuthStorage()._authorizationStates[authorizer][nonce])
            revert ERC20Auth__AuthUsedOrCanceled(authorizer, nonce);
    }

    /**
     * @notice Check that authorization is valid
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     */
    function _requireValidAuthorization(
        address authorizer,
        bytes32 nonce,
        uint256 validAfter,
        uint256 validBefore
    ) private view {
        if (block.timestamp <= validAfter)
            revert ERC20Auth__AuthNotYetValid(validAfter);
        if (block.timestamp >= validBefore)
            revert ERC20Auth__AuthExpired(validBefore);
        _requireUnusedAuthorization(authorizer, nonce);
    }

    /**
     * @notice Mark an authorization as used
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     */
    function _markAuthorizationAsUsed(
        address authorizer,
        bytes32 nonce
    ) private {
        _getERC20AuthStorage()._authorizationStates[authorizer][nonce] = true;
        emit AuthorizationUsed(authorizer, nonce);
    }
}
