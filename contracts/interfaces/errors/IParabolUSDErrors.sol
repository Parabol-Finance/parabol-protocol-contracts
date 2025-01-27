// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

interface IParabolUSDErrors {
    error ParabolUSD__ZeroAddress();
    error ParabolUSD__ZeroAmount();
    error ParabolUSD__Denylisted(address account);
    error ParabolUSD__InsufficientBalance();
    error ParabolUSD__InvalidAmount();
}
