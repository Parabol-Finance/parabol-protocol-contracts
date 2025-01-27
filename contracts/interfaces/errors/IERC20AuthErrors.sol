// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

interface IERC20AuthErrors {
    error ERC20Auth__InvalidCaller(address caller, address payee);
    error ERC20Auth__InvalidSigner(address signer, address owner);
    error ERC20Auth__InvalidSignature();
    error ERC20Auth__AuthUsedOrCanceled(address authorizer, bytes32 nonce);
    error ERC20Auth__AuthNotYetValid(uint256 validAfter);
    error ERC20Auth__AuthExpired(uint256 validBefore);
}
