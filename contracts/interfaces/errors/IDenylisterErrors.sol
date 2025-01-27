// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

interface IDenylisterErrors {
    error Denylister__ZeroAddress();
    error Denylister__EmptyList();
    error Denylister__AlreadyAddedToDenylist(address account);
    error Denylister__NotDenylisted(address account);
}
