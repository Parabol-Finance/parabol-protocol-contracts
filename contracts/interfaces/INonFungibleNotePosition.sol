// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

/**
 * @title Non-Fungible Note Position Interface
 * @dev Interface defining the operations of non-fungible note positions.
 */

import {IERC721Permit} from "./IERC721Permit.sol";

interface INonFungibleNotePosition is IERC721Permit {
    /**
     * @dev Emitted when the address of the denylister contract is updated.
     * @param newDenylister The new address of the denylister contract.
     */
    event DenylisterUpdated(address indexed newDenylister);
    event RSPSet(address indexed rspAddress);
    event Mint(address indexed to, uint256 indexed tokenId);
    event Burn(address indexed owner, uint256 indexed tokenId);
    struct Note {
        uint128 lendTimestamp;
        uint128 maturityTimestamp;
        uint256 coupon;
        uint256 principal;
        uint256 partnerFeeBPS;
        bytes32 partnerId;
    }

    struct Counter {
        uint256 _value;
    }

    /**
     * @dev Mints a new non-fungible note.
     * @param to The address to receive the minted note.
     */
    function mint(address to, Note calldata note) external returns (uint256);

    /**
     * @dev Burns a non-fungible note.
     * @param tokenId The unique ID of the note token to burn.
     */
    function burn(uint256 tokenId) external;

    /**
     * @dev Retrieves the lending information of a note.
     * @param tokenId The unique ID of the note token.
     * @return Note The lending information.
     */
    function getLendInfo(uint256 tokenId) external view returns (Note memory);
}
