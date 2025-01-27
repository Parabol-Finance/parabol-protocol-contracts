// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

interface IParabolUSD is IERC20, IERC20Permit {
    /**
     * @dev Emitted when new tokens are minted to an address.
     * @param to The address to which new tokens will be minted.
     * @param amount The amount of tokens minted.
     */
    event Mint(address indexed to, uint256 amount);

    /**
     * @dev Emitted when tokens are burned from an address.
     * @param from The address from which tokens will be burned.
     * @param amount The amount of tokens burned.
     */
    event Burn(address indexed from, uint256 amount);

    /**
     * @dev Emitted when the address of the denylister contract is updated.
     * @param newDenylister The new address of the denylister contract.
     */
    event DenylisterUpdated(address indexed newDenylister);

    event MaxMintLimitUpdated(uint256 newLimit);

    /**
     * @dev Mints new tokens and assigns them to the specified address.
     * @param to The address to which new tokens will be minted.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external;
}
