// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface IERC721PermitErrors {
    error ERC721Permit__Unauthorized();
    error ERC721Permit__InvalidSignature();
    error ERC721Permit__InvalidSigner(address signer, address expectedSigner);
    error ERC721Permit__DeadlineExpired();
    error ERC721Permit__TokenIdDoesNotExist();
    error ERC721Permit__ApprovalToCurrentOwner();
}
