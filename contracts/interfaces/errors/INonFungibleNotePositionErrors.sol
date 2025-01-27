// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

interface INonFungibleNotePositionErrors {
    error NonFungibleNotePosition__ZeroAddress();
    error NonFungibleNotePosition__OnlyRSPCanCallThisFunction();
    error NonFungibleNotePosition__TokenNotApproved();
    error NonFungibleNotePosition__Denylisted(address account);
}
