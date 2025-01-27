// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

interface INoncesUpgradeable {
    event NonceUsed(address indexed account, uint256 indexed nonce);
}
