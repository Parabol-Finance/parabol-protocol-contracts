import { network } from "hardhat";
import { Signer, TypedDataDomain, Signature } from "ethers";

export interface PriceFeed {
  maturityTimestamp: number;
  coupon: number;
  validAfter: number;
  validBefore: number;
}

// Helper function to sign an ERC20 Permit
export async function signPriceFeed(
  reserveStabilityPoolAddress: string,
  name: string,
  version: string,
  priceFeedSigner: Signer,
  priceFeed: PriceFeed
): Promise<Signature> {
  return Signature.from(
    await priceFeedSigner.signTypedData(
      {
        name: name,
        version: version,
        chainId: await network.provider.send("eth_chainId"),
        verifyingContract: reserveStabilityPoolAddress,
      },
      {
        PriceFeed: [
          { name: "maturityTimestamp", type: "uint128" },
          { name: "coupon", type: "uint256" },
          { name: "validAfter", type: "uint128" },
          { name: "validBefore", type: "uint128" },
        ],
      },
      {
        maturityTimestamp: priceFeed.maturityTimestamp,
        coupon: priceFeed.coupon,
        validAfter: priceFeed.validAfter,
        validBefore: priceFeed.validBefore,
      }
    )
  );
}
