// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

/**
 * @title ERC721Permit - ERC721 token with permit functionality
 * @notice This contract introduces permit functionality to a standard ERC721 token, allowing for gas-less approvals.
 * @dev It utilizes OpenZeppelin's upgradeable contract patterns for future-proof iterations.
 */

import {ERC721Upgradeable, IERC165} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC721Permit} from "../interfaces/IERC721Permit.sol";
import {IERC721PermitErrors} from "../interfaces/errors/IERC721PermitErrors.sol";

abstract contract ERC721PermitUpgradeable is
    ERC721Upgradeable,
    IERC721PermitErrors,
    IERC721Permit
{
    //@notice The constant hash used for EIP712 permit functionality
    //keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 public constant PERMIT_TYPEHASH =
        0x49ecf333e5b8c95c40fdafc95c1ad136e8914a8fb55e9dc8bb01eaa83a2df9ad;

    /// @custom:storage-location erc7201:parabol.storage.ERC721Permit
    struct ERC721PermitStorage {
        //@notice The keccak256 hash of the token's name used in the permit signature verification
        bytes32 _nameHash;
        //@notice The keccak256 hash of the token's version used in the permit signature verification
        bytes32 _versionHash;
        mapping(uint256 account => uint256 nonce) _nonces;
    }

    // keccak256(abi.encode(uint256(keccak256("parabol.storage.ERC721Permit")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant ERC721PermitStorageLocation =
        0x766d32171dda1ceaa371f652223d8fbe3356c65432b5cadb25212214ac569500;

    function _getERC721PermitStorage()
        private
        pure
        returns (ERC721PermitStorage storage $)
    {
        assembly {
            $.slot := ERC721PermitStorageLocation
        }
    }

    /**
     * @notice Initializes the contract with the given name, symbol, and version
     * @param name_ The name of the token
     * @param version_ The version of the token
     */
    function __ERC721Permit_init(
        string memory name_,
        string memory version_
    ) internal onlyInitializing {
        __ERC721Permit_init_unchained(name_, version_);
    }

    /**
     * @dev Internal function to initialize contract during upgrade, it sets up the token's name, symbol, and the version.
     * @param name_ The name for the token.
     * @param version_ The version of the token.
     */
    function __ERC721Permit_init_unchained(
        string memory name_,
        string memory version_
    ) internal onlyInitializing {
        ERC721PermitStorage storage $ = _getERC721PermitStorage();
        $._nameHash = keccak256(bytes(name_));
        $._versionHash = keccak256(bytes(version_));
    }

    function nonces(uint256 tokenId) public view returns (uint256) {
        return _getERC721PermitStorage()._nonces[tokenId];
    }

    /// @inheritdoc IERC721Permit
    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        ERC721PermitStorage storage $ = _getERC721PermitStorage();
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

    /// @inheritdoc IERC721Permit
    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable override {
        if (block.timestamp > deadline) revert ERC721Permit__DeadlineExpired();
        address owner = _requireOwned(tokenId);
        if (spender == owner) revert ERC721Permit__ApprovalToCurrentOwner();

        bytes32 domainSeparator = DOMAIN_SEPARATOR();
        bytes32 dataHash = keccak256(
            abi.encode(
                PERMIT_TYPEHASH,
                spender,
                tokenId,
                _getAndIncrementNonce(tokenId),
                deadline
            )
        );

        bytes32 digest;
        // _toTypedDataHash(DOMAIN_SEPERATOR(), dataHash);
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
                revert ERC721Permit__InvalidSignature();
            }
        } else {
            address recoveredAddress = ecrecover(digest, v, r, s);

            if (recoveredAddress == address(0))
                revert ERC721Permit__InvalidSignature();
            if (recoveredAddress != owner)
                revert ERC721Permit__InvalidSigner(recoveredAddress, owner);
        }
        _approve(spender, tokenId, owner);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        address from = ERC721Upgradeable._update(to, tokenId, auth);
        if (from != address(0)) {
            emit Approval(from, address(0), tokenId);
        }
        return from;
    }

    /**
     * @dev Internal function to retrieve and increment nonce for given tokenId.
     * @param tokenId ID of the token for which nonce is to be incremented.
     * @return New nonce value.
     */
    function _getAndIncrementNonce(uint256 tokenId) internal returns (uint256) {
        ERC721PermitStorage storage $ = _getERC721PermitStorage();
        emit NonceUsed(tokenId, $._nonces[tokenId]);
        unchecked {
            return $._nonces[tokenId]++;
        }
    }

    /// @inheritdoc ERC721Upgradeable
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721Upgradeable, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
