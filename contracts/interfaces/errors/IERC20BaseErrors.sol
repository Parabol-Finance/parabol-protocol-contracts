// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

interface IERC20BaseErrors {
    error ERC2612ExpiredSignature(uint256 deadline);
    error ERC2612InvalidSigner(address signer, address owner);
    error ERC2612InvalidSignature();
    error ERC20Base__InvalidSigner(address signer, address expectedSigner);
    error ERC20Base__InvalidSignature();
}
