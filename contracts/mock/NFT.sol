// SPDX-License-Identifier: GPL-2.0-or-later
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/ParabolNoteDescriptor.sol";

contract MyNFT is ERC721, Ownable {
    uint256 private _nextTokenId;
    struct LendInfo {
        uint128 lendTimestamp;
        uint128 maturityTimestamp;
        uint256 principal;
        uint256 coupon;
        uint256 fixedIncome;
        uint256 floatingIncome;
    }
    mapping(uint256 => LendInfo) public lendInfos;

    constructor(
        address initialOwner
    ) ERC721("MyToken", "MTK") Ownable(initialOwner) {}

    function safeMint(address to, LendInfo calldata lendInfo) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        lendInfos[tokenId] = lendInfo;
        _safeMint(to, tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        LendInfo memory lendInfo = lendInfos[tokenId];
        return
            ParabolNoteDescriptor.tokenURI(
                ParabolNoteDescriptor.ConstructTokenURIParams({
                    tokenId: tokenId,
                    lendTimestamp: lendInfo.lendTimestamp,
                    maturityTimestamp: lendInfo.maturityTimestamp,
                    principal: lendInfo.principal,
                    coupon: lendInfo.coupon,
                    accFixedIncome: lendInfo.fixedIncome,
                    accFloatingIncome: lendInfo.floatingIncome
                })
            );
    }
}
