// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

/**
 * @title Parabol NFT Descriptor
 * @dev Library for generating descriptions and URIs for Parabol NFTs.
 * Utilizes components like Base64, Strings, DateTime, and custom SVG generation for comprehensive NFT metadata creation.
 */
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {DateTime} from "./DateTime.sol";
import {ParabolNoteSVG} from "./ParabolNoteSVG.sol";

library ParabolNoteDescriptor {
    using Strings for uint256;
    using Strings for uint128;

    /**
     * @dev Struct representing the parameters required to construct the token's URI.
     * @param tokenId The unique identifier for the NFT.
     * @param lendTimestamp The timestamp representing the lending date.
     * @param maturityTimestamp The timestamp representing the maturity date.
     * @param principal The initial principal amount lent.
     * @param coupon The fixed coupon rate associated with the note.
     * @param accFixedIncome The accumulated fixed income for the note.
     * @param accFloatingIncome The accumulated floating income for the note.
     */
    struct ConstructTokenURIParams {
        uint256 tokenId;
        uint128 lendTimestamp;
        uint128 maturityTimestamp;
        uint256 principal;
        uint256 coupon;
        uint256 accFixedIncome;
        uint256 accFloatingIncome;
    }

    /**
     * @dev Struct representing the prepared parameters for constructing the token's URI.
     * @param lendingDate The human-readable lending date.
     * @param maturityDate The human-readable maturity date.
     * @param principalString The formatted principal amount.
     * @param couponString The formatted coupon rate.
     * @param fixedIncomeString The formatted accumulated fixed income.
     * @param floatingIncomeString The formatted accumulated floating income.
     * @param svgBase64 The base64-encoded SVG representing the note's visual representation.
     */
    struct PreparedParams {
        string lendingDate;
        string maturityDate;
        string principalString;
        string couponString;
        string fixedIncomeString;
        string floatingIncomeString;
        string svgBase64;
    }

    /**
     * @notice Converts a Unix timestamp to a human-readable date string in YYYY-MM-DDThh:mm:ss format.
     * @param timestamp The timestamp to convert.
     * @return The formatted date string.
     */
    function timestampToDateString(
        uint128 timestamp
    ) internal pure returns (string memory) {
        (
            uint256 year,
            uint256 month,
            uint256 day,
            uint256 hour,
            uint256 minute,
            uint256 second
        ) = DateTime.timestampToDateTime(timestamp);

        return
            string.concat(
                year.toString(),
                "-",
                month < 10
                    ? string.concat("0", month.toString())
                    : month.toString(),
                "-",
                day < 10 ? string.concat("0", day.toString()) : day.toString(),
                "T",
                hour < 10
                    ? string.concat("0", hour.toString())
                    : hour.toString(),
                ":",
                minute < 10
                    ? string.concat("0", minute.toString())
                    : minute.toString(),
                ":",
                second < 10
                    ? string.concat("0", second.toString())
                    : second.toString()
            );
    }

    /**
     * @notice Generates the token URI for a Parabol Note, including all relevant attributes and SVG image encoded in Base64.
     * @param params The parameters necessary to construct the NFT's URI.
     * @return The complete token URI in a JSON string format.
     */
    function tokenURI(
        ConstructTokenURIParams memory params
    ) public view returns (string memory) {
        PreparedParams memory preparedParams = prepareParams(params);

        return
            string.concat(
                "data:application/json;base64,",
                Base64.encode(
                    bytes(
                        string.concat(
                            '{"name":"',
                            "Parabol Note Position",
                            '", "description":"',
                            "Parabol Dummy Description",
                            '", "attributes": [',
                            '{"trait_type": "Lending Date", "value": "',
                            preparedParams.lendingDate,
                            '"},',
                            '{"trait_type": "Maturity Date", "value": "',
                            preparedParams.maturityDate,
                            '"},',
                            '{"trait_type": "Principal", "value": "',
                            preparedParams.principalString,
                            '"},',
                            '{"trait_type": "Coupon", "value": "',
                            preparedParams.couponString,
                            '"},',
                            '{"trait_type": "Accumulated Fixed Income", "value": "',
                            preparedParams.fixedIncomeString,
                            '"},',
                            '{"trait_type": "Accumulated Floating Income", "value": "',
                            preparedParams.floatingIncomeString,
                            '"}',
                            '], "image": "',
                            "data:image/svg+xml;base64,",
                            preparedParams.svgBase64,
                            '"}'
                        )
                    )
                )
            );
    }

    /**
     * @dev Prepares parameters for metadata and SVG generation based on ConstructTokenURIParams.
     * @param params Parameters needed to generate the token URI.
     * @return preparedParams Struct containing all prepared parameters for metadata.
     */
    function prepareParams(
        ConstructTokenURIParams memory params
    ) internal view returns (PreparedParams memory) {
        PreparedParams memory preparedParams;

        preparedParams.lendingDate = timestampToDateString(
            params.lendTimestamp
        );
        preparedParams.maturityDate = timestampToDateString(
            params.maturityTimestamp
        );

        uint256 principalIntPartLength;
        (preparedParams.principalString, principalIntPartLength) = formatEther(
            params.principal
        );

        uint256 couponIntPartLength;
        (preparedParams.couponString, couponIntPartLength) = formatCoupon(
            params.coupon
        );

        (preparedParams.fixedIncomeString, ) = formatEther(
            params.accFixedIncome
        );

        (preparedParams.floatingIncomeString, ) = formatEther(
            params.accFloatingIncome
        );

        (string memory earnedString, uint256 earnedIntPartLength) = formatEther(
            params.accFixedIncome + params.accFloatingIncome
        );

        uint256 currentTimestamp = block.timestamp;
        uint256 remainingDays = params.maturityTimestamp <= currentTimestamp
            ? 0
            : DateTime.diffDays(currentTimestamp, params.maturityTimestamp) + 1;

        preparedParams.svgBase64 = Base64.encode(
            ParabolNoteSVG.generateSVG(
                ParabolNoteSVG.SVGParams({
                    maturityTimestamp: params.maturityTimestamp,
                    lendTimestamp: params.lendTimestamp,
                    remainingDays: remainingDays,
                    principalString: preparedParams.principalString,
                    principalIntPartLength: principalIntPartLength,
                    couponString: preparedParams.couponString,
                    couponIntPartLength: couponIntPartLength,
                    earnedString: earnedString,
                    earnedIntPartLength: earnedIntPartLength
                })
            )
        );

        return preparedParams;
    }

    /**
     * @dev Formats a token amount into a string with two decimal places, separating thousands with commas.
     * @param amount Token amount to format.
     * @param decimals Number of decimals the token uses.
     * @return integerPart The integer part of the amount.
     * @return fractionalPart The fractional part of the amount, adjusted to two decimal places.
     */
    function formatUnits(
        uint256 amount,
        uint8 decimals
    ) internal pure returns (uint256 integerPart, uint256 fractionalPart) {
        integerPart = amount / (10 ** decimals); // Get integer part
        fractionalPart = amount % (10 ** decimals); // Get fractional part

        // Adjust fractional part to two decimal places for display purposes
        fractionalPart = (fractionalPart * 100) / (10 ** decimals); // Scale to two decimals

        // Check for rounding if there's a need based on the next digit
        if (((amount * 1000) / (10 ** decimals)) % 10 >= 5) {
            // Increase fractional part due to rounding
            fractionalPart++;
            // Handle overflow from fractional part
            if (fractionalPart >= 100) {
                integerPart++;
                fractionalPart = 0;
            }
        }
    }

    /**
     * @notice Formats a coupon rate for display, ensuring four decimal places.
     * @param couponValue The coupon value to format.
     * @return The coupon rate as a string.
     * @return integerPartLength Length of the integer part for alignment purposes.
     */
    function formatCoupon(
        uint256 couponValue
    ) internal pure returns (string memory, uint256) {
        // Format coupon using typical financial decimals
        (uint256 integerPart, uint256 fractionalPart) = formatUnits(
            couponValue,
            2
        );
        uint256 integerPartLength = bytes(integerPart.toString()).length;
        return (
            string.concat(
                Strings.toString(integerPart),
                ".",
                fractionalPart < 10
                    ? string.concat("0", Strings.toString(fractionalPart))
                    : Strings.toString(fractionalPart)
            ),
            integerPartLength
        );
    }

    /**
     * @notice Formats an ether value for display, ensuring two decimal places and comma separation for thousands.
     * @param amount The amount in wei to format.
     * @return The formatted ether amount as a string.
     * @return integerPartLength Length of the integer part for alignment purposes.
     */
    function formatEther(
        uint256 amount
    ) internal pure returns (string memory, uint256) {
        // Format ether which typically has 18 decimal places
        (uint256 integerPart, uint256 fractionalPart) = formatUnits(amount, 18);
        uint256 integerPartLength = bytes(integerPart.toString()).length;
        string memory integerPartWithCommas = toStringWithCommas(integerPart);
        return (
            string.concat(
                integerPartWithCommas,
                ".",
                fractionalPart < 10
                    ? string.concat("0", Strings.toString(fractionalPart))
                    : Strings.toString(fractionalPart)
            ),
            integerPartLength
        );
    }

    /**
     * @dev Converts a uint256 to a string and formats it with commas.
     * @param value The value to convert and format.
     * @return The formatted string with commas.
     */
    function toStringWithCommas(
        uint256 value
    ) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        // Temporary buffer to store the characters
        bytes memory buffer = new bytes(78); // Maximum length for uint256 with commas
        uint256 index = 0;

        while (value != 0) {
            if (index % 4 == 3) {
                buffer[index++] = ",";
            }
            buffer[index++] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }

        // Reverse the buffer to get the correct order
        return string(reverse(buffer, index));
    }

    /**
     * @dev Reverses a byte array, used in formatting strings.
     * @param buffer The byte array to reverse.
     * @param length The length of the buffer to use.
     * @return The reversed byte array.
     */
    function reverse(
        bytes memory buffer,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory reversed = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            reversed[i] = buffer[length - 1 - i];
        }
        return reversed;
    }
}
