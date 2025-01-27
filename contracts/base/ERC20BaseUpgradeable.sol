// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

/**
 * @title ERC20BaseUpgradeable
 * @dev An abstract contract extending OpenZeppelin's ERC20Upgradeable, incorporating upgrade safety,
 * EIP-712 signing, and ERC-165 interface detection. It uses a structured storage pattern for improved data integrity and lower gas costs,
 * and includes signature verification to support interactions with both EOAs and smart contract accounts,
 * accommodating ERC-4337 account abstraction. Designed for flexibility and efficiency in upgradeable token contracts.
 */

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC165Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";
import {NoncesUpgradeable} from "../utils/NoncesUpgradeable.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IERC20BaseErrors} from "../interfaces/errors/IERC20BaseErrors.sol";

abstract contract ERC20BaseUpgradeable is
    ERC20Upgradeable,
    ERC165Upgradeable,
    NoncesUpgradeable,
    IERC20Permit,
    IERC20BaseErrors
{
    /**
     * @dev The EIP-712 type hash for the permit function, used to construct the hashed message that must be signed to grant a permit.
     * The calculation method keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
     */
    bytes32 private constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

    /**
     * @notice A struct for storing the base configuration of the ERC20 token.
     * @dev This struct contains hashed versions of the token name and version for use in EIP-712 domain separation, along with the unhashed version string.
     * @param _nameHash The keccak256 hash of the token's name used in the permit signature verification
     * @param _versionHash The keccak256 hash of the token's version used in the permit signature verification
     * @param _version The version of the token, stored in plain text.
     * @custom:storage-location erc7201:parabol.storage.ERC20Base
     */
    struct ERC20BaseStorage {
        bytes32 _nameHash;
        bytes32 _versionHash;
        string _version;
    }

    /**
     * @dev Represents the storage slot location used to store the `ERC20BaseStorage` struct.
     * This location is determined by the keccak256 hash of a specifically crafted string, ensuring it is unique and does not collide with other storage slots used by inherited contracts.
     * The calculation method `keccak256(abi.encode(uint256(keccak256("parabol.storage.ERC20Base")) - 1)) & ~bytes32(uint256(0xff))`
     * ensures the slot is deterministic, unique, and unlikely to clash with other slots.
     */
    bytes32 private constant ERC20BaseStorageLocation =
        0xb1d73ce282f3a322e3c026f9b511cc0cdd7db0425ea117d11885b4bf777b5b00;

    /**
     * @notice Retrieves the storage structure for the ERC20Base contract.
     * @dev This internal function uses Yul to directly access the storage slot of the contract where `ERC20BaseStorage` is located. This pattern is used to ensure that the storage structure is compatible with upgrades.
     * @return $ The `ERC20BaseStorage` struct containing the contract's state.
     */
    function _getERC20BaseStorage()
        private
        pure
        returns (ERC20BaseStorage storage $)
    {
        assembly {
            $.slot := ERC20BaseStorageLocation
        }
    }

    /**
     * @notice Returns the version of the token as a plain text string.
     * @dev This function allows external entities to retrieve the version of the token.
     * @return The version of the token.
     */
    function version() external view returns (string memory) {
        return _getERC20BaseStorage()._version;
    }

    /**
     * @notice Initializes the ERC20Base contract with a name and version.
     * @dev Sets the initial name and version of the token, hashing both for use in EIP-712 domain separation.
     * This initializer should be called from an inheriting contract's initializer function.
     * @param name_ The name of the token.
     * @param version_ The version of the token.
     */
    function __ERC20BaseUpgradeable_init(
        string memory name_,
        string memory symbol_,
        string memory version_
    ) internal onlyInitializing {
        __ERC20_init(name_, symbol_);
        __ERC20BaseUpgradeable_init_unchained(name_, version_);
    }

    /**
     * @notice Performs the actual initialization logic for the ERC20Base contract.
     * @dev This is separated from the `__ERC20BaseUpgradeable_init` to allow for more granular initialization control in derived contracts.
     *      It directly sets the name and version of the token, including their keccak256 hashes for EIP-712.
     * @param name_ The name of the token.
     * @param version_ The version of the token.
     */
    function __ERC20BaseUpgradeable_init_unchained(
        string memory name_,
        string memory version_
    ) internal onlyInitializing {
        ERC20BaseStorage storage $ = _getERC20BaseStorage();
        $._nameHash = keccak256(bytes(name_));
        $._versionHash = keccak256(bytes(version_));
        $._version = version_;
    }

    /**
     * @dev Sets `value` as the allowance of `spender` over ``owner``'s tokens,
     * given ``owner``'s signed approval.
     *
     * IMPORTANT: The same issues {IERC20-approve} has related to transaction
     * ordering also apply here.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `deadline` must be a timestamp in the future.
     * - `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments.
     * - the signature must use ``owner``'s current nonce (see {nonces}).
     *
     * For more information on the signature format, see the
     * https://eips.ethereum.org/EIPS/eip-2612#specification[relevant EIP
     * section].
     *
     * CAUTION: See Security Considerations above.
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp > deadline)
            revert ERC2612ExpiredSignature(deadline);

        _requireValidSignature(
            owner,
            keccak256(
                abi.encode(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    _useNonce(owner),
                    deadline
                )
            ),
            v,
            r,
            s
        );
        _approve(owner, spender, value);
    }

    /**
     * @notice Returns the current nonce for an owner's account, which must be included in the EIP-712 signature for permits.
     * @dev Every successful call to `permit` increments the owner's nonce, ensuring each permit signature is unique and cannot be reused.
     * @param owner The address whose nonce is being queried.
     * @return The current nonce for the owner's account.
     */
    function nonces(
        address owner
    ) public view virtual override(IERC20Permit) returns (uint256) {
        return _nonces(owner);
    }

    /**
     * @notice Calculates and returns the EIP-712 domain separator for the token.
     * @dev This domain separator is used in EIP-712 typed structured data signing. It is recalculated every time it's called to ensure it reflects the current contract's address and the chain it's on.
     * @return The calculated EIP-712 domain separator for the token.
     */
    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        ERC20BaseStorage storage $ = _getERC20BaseStorage();
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
     * @notice Validates a signature against a given data hash, considering EIP-712 structured data signing.
     * @dev Checks if the provided signature corresponds to the data hash signed by the `owner`.
     * @dev throws ERC20Base__InvalidSignature if the signature does not match the owner or if it is otherwise invalid.
     * @dev throws ERC20Base__InvalidSigner if the recovered signer does not match the expected owner address.
     * It supports signatures from both EOAs and smart contracts (accommodating ERC-4337 account abstraction).
     * For smart contracts, it defers to the `isValidSignature` method as per ERC-1271.
     * @param owner The address presumed to have signed the data. It can be an EOA or a smart contract address.
     * @param dataHash The hash of the data that was supposedly signed.
     * @param v The recovery byte of the signature.
     * @param r Half of the ECDSA signature pair.
     * @param s The other half of the ECDSA signature pair.
     */
    function _requireValidSignature(
        address owner,
        bytes32 dataHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        bytes32 domainSeparator = DOMAIN_SEPARATOR();

        bytes32 digest;

        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, hex"19_01")
            mstore(add(ptr, 0x02), domainSeparator)
            mstore(add(ptr, 0x22), dataHash)
            digest := keccak256(ptr, 0x42)
        }
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(owner)
        }

        if (size > 0) {
            if (
                IERC1271(owner).isValidSignature(
                    digest,
                    abi.encodePacked(r, s, v)
                ) != 0x1626ba7e // isValidSignature.selector
            ) {
                revert ERC20Base__InvalidSignature();
            }
        } else {
            address recoveredAddress = ecrecover(digest, v, r, s);
            if (recoveredAddress == address(0))
                revert ERC20Base__InvalidSignature();
            if (recoveredAddress != owner)
                revert ERC20Base__InvalidSigner(recoveredAddress, owner);
        }
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 value
    ) internal override {
        ERC20Upgradeable._spendAllowance(owner, spender, value);
        emit Approval(owner, spender, allowance(owner, spender));
    }

    /**
     * @notice Checks if the contract implements an interface according to the ERC-165 standard.
     * @dev Overrides `ERC165Upgradeable.supportsInterface` to include checks for the interfaces implemented by this contract.
     * @param interfaceId The identifier of the interface to check.
     * @return True if the contract implements `interfaceId`, false otherwise.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC20Permit).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
