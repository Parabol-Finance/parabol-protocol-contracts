// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ERC721 with permit
 * @dev Extension to ERC721 that includes a permit function for signature based approvals
 */
interface IERC721Permit is IERC721 {
    /**
     * @dev The permit typehash used in the permit signature
     * @return The typehash for the permit
     */
    event NonceUsed(uint256 tokenId, uint256 nonce);

    /**
     * @dev The domain separator used in the permit signature
     * @return The domain seperator used in encoding of permit signature
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /**
     * @dev Approve of a specific token ID for spending by spender via signature
     * @param spender The account that is being approved
     * @param tokenId The ID of the token that is being approved for spending
     * @param deadline The deadline timestamp by which the call must be mined for the approve to work
     */
    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable;
}
