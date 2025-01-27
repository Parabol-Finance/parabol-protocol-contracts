// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

/**
 * @title Parabol NFT SVG Generator
 * @dev Library for generating SVG images for Parabol NFTs. The SVGs visually represent the attributes of Parabol note positions, such as maturity and income earned. The library provides a scalable vector graphic based on note-specific parameters.
 */

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

library ParabolNoteSVG {
    using Strings for uint256;

    /**
     * @dev Struct representing the parameters required to construct the SVG.
     * @param maturityTimestamp The timestamp when the note matures.
     * @param lendTimestamp The timestamp when the note was lent.
     * @param remainingDays The number of days remaining until the note matures.
     * @param principalString The principal amount of the note as a string.
     * @param principalIntPartLength The length of the integer part of the principal amount.
     * @param couponString The coupon rate of the note as a string.
     * @param couponIntPartLength The length of the integer part of the coupon rate.
     * @param earnedString The amount earned from the note as a string.
     * @param earnedIntPartLength The length of the integer part of the amount earned.
     */
    struct SVGParams {
        uint128 maturityTimestamp;
        uint128 lendTimestamp;
        uint256 remainingDays;
        string principalString;
        uint256 principalIntPartLength;
        string couponString;
        uint256 couponIntPartLength;
        string earnedString;
        uint256 earnedIntPartLength;
    }

    /**
     * @notice Generates SVG for the Parabol NFT based on provided parameters.
     * @param params Struct containing all necessary data to construct the SVG.
     * @return svg The SVG image as a bytes string.
     */
    function generateSVG(
        SVGParams memory params
    ) public view returns (bytes memory) {
        uint256 maturityPercentage = block.timestamp >= params.maturityTimestamp
            ? 100
            : ((block.timestamp - params.lendTimestamp) * 100) /
                (params.maturityTimestamp - params.lendTimestamp);

        string memory color = maturityPercentage < 50
            ? "#58C830"
            : maturityPercentage < 80
            ? "#FFE700"
            : maturityPercentage < 100
            ? "#FF6F42"
            : "#7433FF";

        return
            bytes(
                string.concat(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="540" fill="none"> ',
                    createDefs(color),
                    createBackground(),
                    createLogo(),
                    createAmountDetails(
                        params.principalString,
                        params.principalIntPartLength,
                        params.couponString,
                        params.couponIntPartLength,
                        params.earnedString,
                        params.earnedIntPartLength
                    ),
                    createMaturityDetails(
                        maturityPercentage,
                        params.remainingDays,
                        color
                    ),
                    createMaturityProgress(maturityPercentage, color),
                    "</svg>"
                )
            );
    }

    /**
     * @dev Creates SVG <defs> element with necessary definitions such as gradients.
     * @param color The main color used in the gradient, representing the maturity progress.
     * @return SVG <defs> element as a string.
     */
    function createDefs(
        string memory color
    ) internal pure returns (string memory) {
        return
            string.concat(
                "<defs> ",
                '<radialGradient id="gradient" cx="0" cy="0" r="1" gradientTransform="rotate(-161.682 455.984 196.831) scale(542.49)" gradientUnits="userSpaceOnUse"> <stop stop-color="',
                color,
                '" /> <stop offset="1" stop-color="#1E1F20" /> </radialGradient> ',
                "</defs> "
            );
    }

    /**
     * @dev Constructs the SVG background layer.
     * @return SVG path string for the background.
     */
    function createBackground() internal pure returns (string memory) {
        return
            '<path fill="#1E1F20" d="M0 40C0 17.909 17.909 0 40 0h460c22.091 0 40 17.909 40 40v460c0 22.091-17.909 40-40 40H40c-22.091 0-40-17.909-40-40V40Z" /> <path fill="url(#gradient)" fill-opacity=".4" d="M0 40C0 17.909 17.909 0 40 0h460c22.091 0 40 17.909 40 40v460c0 22.091-17.909 40-40 40H40c-22.091 0-40-17.909-40-40V40Z" /> ';
    }

    /**
     * @dev Generates SVG elements for the Parabol logo within the NFT.
     * @return SVG string containing the logo.
     */
    function createLogo() internal pure returns (string memory) {
        return
            '<path fill="#fff" d="M40 82.533c9.705-.05 18.568-1.38 25.118-3.565 3.328-1.11 6.184-2.481 8.254-4.114C75.419 73.24 77 71.114 77 68.516c0-.847-.168-1.644-.466-2.39-.113.094-.227.186-.34.275-1.125.888-2.39 1.684-3.748 2.398-.104.639-.578 1.506-1.897 2.546-1.502 1.186-3.816 2.351-6.877 3.372-5.978 1.994-14.33 3.28-23.672 3.33v4.486ZM40 70.571c9.705-.05 18.568-1.38 25.118-3.565 3.328-1.11 6.184-2.481 8.254-4.114C75.419 61.278 77 59.152 77 56.554c0-2.597-1.58-4.723-3.628-6.338-2.07-1.632-4.926-3.004-8.254-4.114-6.55-2.185-15.413-3.514-25.118-3.564v4.486c9.342.05 17.694 1.335 23.672 3.33 3.06 1.02 5.375 2.186 6.877 3.371 1.526 1.203 1.92 2.175 1.92 2.83 0 .654-.394 1.625-1.92 2.828-1.502 1.185-3.816 2.351-6.877 3.372-5.978 1.994-14.33 3.28-23.672 3.33v4.486Z" /> <path fill="#fff" d="M40 58.986c5.512.03 10.68.489 15.218 1.27 2.63-.483 4.989-1.079 7.008-1.752.73-.243 1.39-.49 1.985-.732C57.76 55.762 49.263 54.547 40 54.5v4.486Z" /> ';
    }

    /**
     * @dev Generates SVG elements displaying amount details such as principal, APR, and earned amounts.
     * @param principalString The principal amount as a string.
     * @param principalIntPartLength Length of the principal amount's integer part for formatting.
     * @param couponString The coupon rate as a string.
     * @param couponIntPartLength Length of the coupon rate's integer part for formatting.
     * @param earnedString The earned amount as a string.
     * @param earnedIntPartLength Length of the earned amount's integer part for formatting.
     * @return SVG string representing the amount details section.
     */
    function createAmountDetails(
        string memory principalString,
        uint256 principalIntPartLength,
        string memory couponString,
        uint256 couponIntPartLength,
        string memory earnedString,
        uint256 earnedIntPartLength
    ) internal pure returns (string memory) {
        uint256 fontSize = principalIntPartLength <= 6
            ? 56
            : principalIntPartLength == 7
            ? 49
            : principalIntPartLength == 8
            ? 45
            : principalIntPartLength == 9
            ? 42
            : principalIntPartLength == 10
            ? 38
            : principalIntPartLength == 11
            ? 35
            : principalIntPartLength == 12
            ? 33
            : 30;

        uint256 couponRectEndPos = 174 + (couponIntPartLength * 10);

        uint256 earnedRectEndPos = 164 +
            (earnedIntPartLength * 10) +
            (earnedIntPartLength < 3 ? 0 : ((earnedIntPartLength - 1) / 3) * 6);

        return
            string.concat(
                '<text xml:space="preserve" fill="#fff" font-family="Helvetica" font-size="',
                fontSize.toString(),
                '" letter-spacing="-.04em" style="white-space:pre"> <tspan x="40" y="378.012">$',
                principalString,
                '</tspan> </text> <rect width="',
                couponRectEndPos.toString(),
                '" height="39" x="40" y="410" fill="#fff" fill-opacity=".08" rx="19.5" /> <path stroke="#808487" stroke-linecap="round" stroke-width="2.25" d="M65.8 430.7v7.2m-3.6-3.6h7.2m-10.575 3.314a8.406 8.406 0 0 1-5.94-10.288 8.406 8.406 0 0 1 5.94-5.94 8.409 8.409 0 0 1 10.288 5.94" /> <text xml:space="preserve" fill="#fff" font-family="Arial" font-size="18" letter-spacing=".015" style="white-space:pre"> <tspan x="79.243" y="436.045">min ',
                couponString,
                '% APR</tspan> </text> <rect width="',
                earnedRectEndPos.toString(),
                '" height="39" x="40" y="461" fill="#fff" fill-opacity=".08" rx="19.5" /> <path stroke="#808487" stroke-linejoin="round" stroke-width="2.25" d="M61 473a9.482 9.482 0 0 0 7.5 7.5A9.482 9.482 0 0 0 61 488a9.482 9.482 0 0 0-7.5-7.5A9.482 9.482 0 0 0 61 473Z" /> <text xml:space="preserve" fill="#fff" font-family="Arial" font-size="18" letter-spacing=".015" style="white-space:pre"> <tspan x="79.074" y="487.045">earned +$',
                earnedString,
                "</tspan> </text> "
            );
    }

    /**
     * @dev Generates SVG elements related to the note's maturity, including the progress bar and days remaining.
     * @param maturityPercentage The percentage of time passed from the lending date to the maturity date.
     * @param remainingDays The number of days remaining until the note matures.
     * @param color The color representing the note's maturity status.
     * @return SVG string for the maturity details section.
     */
    function createMaturityDetails(
        uint256 maturityPercentage,
        uint256 remainingDays,
        string memory color
    ) internal pure returns (string memory) {
        string memory remainingDaysString = remainingDays == 0
            ? "Unlocked"
            : remainingDays == 1
            ? "Unlock in 1 day"
            : string.concat("Unlock in ", remainingDays.toString(), " days");

        string memory lock = maturityPercentage < 10
            ? 'd="M421.8 396.1c-.497 0-.9.403-.9.9s.403.9.9.9v-1.8Zm2.4 1.8c.497 0 .9-.403.9-.9s-.403-.9-.9-.9v1.8Zm5.1.9v-3.6h-1.8v3.6h1.8Zm-12.6-3.6v3.6h1.8v-3.6h-1.8Zm6.3-6.3c-3.48 0-6.3 2.821-6.3 6.3h1.8c0-2.485 2.014-4.5 4.5-4.5v-1.8Zm6.3 6.3c0-3.479-2.821-6.3-6.3-6.3v1.8c2.485 0 4.5 2.015 4.5 4.5h1.8Zm-6.3 9.9c3.479 0 6.3-2.82 6.3-6.3h-1.8c0 2.485-2.015 4.5-4.5 4.5v1.8Zm0-1.8c-2.486 0-4.5-2.015-4.5-4.5h-1.8c0 3.48 2.82 6.3 6.3 6.3v-1.8Zm-5.4-3.6h-2.4v1.8h2.4v-1.8Zm-2.4-5.4h2.4v-1.8h-2.4v1.8Zm-2.7 2.7c0-1.491 1.208-2.7 2.7-2.7v-1.8c-2.486 0-4.5 2.015-4.5 4.5h1.8Zm2.7 2.7c-1.492 0-2.7-1.209-2.7-2.7h-1.8c0 2.485 2.014 4.5 4.5 4.5v-1.8Zm6.6-1.8h2.4v-1.8h-2.4v1.8Z"'
            : maturityPercentage < 100
            ? 'd="M421.8 385.1c-.497 0-.9.403-.9.9s.403.9.9.9v-1.8Zm2.4 1.8c.497 0 .9-.403.9-.9s-.403-.9-.9-.9v1.8Zm5.1.9v-3.6h-1.8v3.6h1.8Zm-12.6-3.6v3.6h1.8v-3.6h-1.8Zm6.3-6.3c-3.48 0-6.3 2.821-6.3 6.3h1.8c0-2.485 2.014-4.5 4.5-4.5v-1.8Zm6.3 6.3c0-3.479-2.821-6.3-6.3-6.3v1.8c2.485 0 4.5 2.015 4.5 4.5h1.8Zm-6.3 9.9c3.479 0 6.3-2.82 6.3-6.3h-1.8c0 2.485-2.015 4.5-4.5 4.5v1.8Zm0-1.8c-2.486 0-4.5-2.015-4.5-4.5h-1.8c0 3.48 2.82 6.3 6.3 6.3v-1.8Zm-5.4-3.6h-2.4v1.8h2.4v-1.8Zm-2.4-5.4h2.4v-1.8h-2.4v1.8Zm-2.7 2.7c0-1.491 1.208-2.7 2.7-2.7v-1.8c-2.486 0-4.5 2.015-4.5 4.5h1.8Zm2.7 2.7c-1.492 0-2.7-1.209-2.7-2.7h-1.8c0 2.485 2.014 4.5 4.5 4.5v-1.8Zm6.6-1.8h2.4v-1.8h-2.4v1.8Z"'
            : 'd="M421.8 375.1c-.497 0-.9.403-.9.9s.403.9.9.9v-1.8Zm2.4 1.8c.497 0 .9-.403.9-.9s-.403-.9-.9-.9v1.8Zm5.1.9v-3.6h-1.8v3.6h1.8Zm-12.6-3.6v3.6h1.8v-3.6h-1.8Zm6.3-6.3c-3.48 0-6.3 2.821-6.3 6.3h1.8c0-2.485 2.014-4.5 4.5-4.5v-1.8Zm6.3 6.3c0-3.479-2.821-6.3-6.3-6.3v1.8c2.485 0 4.5 2.015 4.5 4.5h1.8Zm-6.3 9.9c3.479 0 6.3-2.82 6.3-6.3h-1.8c0 2.485-2.015 4.5-4.5 4.5v1.8Zm0-1.8c-2.486 0-4.5-2.015-4.5-4.5h-1.8c0 3.48 2.82 6.3 6.3 6.3v-1.8Zm-5.4-3.6h-2.4v1.8h2.4v-1.8Zm-2.4-5.4h2.4v-1.8h-2.4v1.8Zm-2.7 2.7c0-1.491 1.208-2.7 2.7-2.7v-1.8c-2.486 0-4.5 2.015-4.5 4.5h1.8Zm2.7 2.7c-1.492 0-2.7-1.209-2.7-2.7h-1.8c0 2.485 2.014 4.5 4.5 4.5v-1.8Zm6.6-1.8h2.4v-1.8h-2.4v1.8Z"';

        return
            string.concat(
                '<text xml:space="preserve" fill="',
                color,
                '" font-family="Arial" font-size="20" letter-spacing=".01" style="white-space:pre" transform="rotate(-90 462 54)"><tspan x="-5" y="19.273">',
                maturityPercentage.toString(),
                '% maturity</tspan></text> <path fill="',
                color,
                '" ',
                lock,
                ' /> <text xml:space="preserve" fill="#fff" font-family="Arial" font-size="20" letter-spacing=".01" opacity=".3" text-anchor="end" style="white-space:pre" transform="rotate(-90 301 -107)">',
                '<tspan x="175" y="19.273">',
                remainingDaysString,
                "</tspan></text> "
            );
    }

    /**
     * @dev Constructs the SVG representation of the maturity progress bar.
     * @param maturityPercentage The percentage of time passed from the lending date to the maturity date.
     * @param color The color representing the note's maturity status.
     * @return SVG string for the maturity progress bar.
     */
    function createMaturityProgress(
        uint256 maturityPercentage,
        string memory color
    ) internal pure returns (string memory) {
        uint256 emptyBarLimit = (30 - (30 * maturityPercentage) / 100) * 17;

        // don't fill last bar if maturity is not 100%
        if (emptyBarLimit <= 17 && maturityPercentage < 100)
            emptyBarLimit += emptyBarLimit;

        string memory progressBar;

        for (uint256 y = 20; y <= 513; ) {
            progressBar = y < emptyBarLimit
                ? string.concat(
                    progressBar,
                    '<rect width="7" height="72" x="520" y="',
                    y.toString(),
                    '" fill="#fff" fill-opacity=".06" rx="3" transform="rotate(90 520 ',
                    y.toString(),
                    ')" />'
                )
                : string.concat(
                    progressBar,
                    '<rect width="7" height="72" x="520" y="',
                    y.toString(),
                    '" fill="',
                    color,
                    '" rx="3" transform="rotate(90 520 ',
                    y.toString(),
                    ')" /> '
                );
            unchecked {
                y = y + 17;
            }
        }
        return progressBar;
    }
}
