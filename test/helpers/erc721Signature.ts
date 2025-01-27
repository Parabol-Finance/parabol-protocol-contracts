import { network } from "hardhat";
import { Signer, TypedDataDomain } from "ethers";
import { Signature } from "ethers";

// Helper function to sign an ERC721 Permit
export async function signERC721Permit(
  nonFungibleNotePositionAddress: string,
  name: string,
  version: string,
  owner: Signer,
  spender: string,
  tokenId: number,
  nonce: number,
  deadline: number
): Promise<Signature> {
  return Signature.from(
    await owner.signTypedData(
      {
        name: name,
        version: version,
        chainId: await network.provider.send("eth_chainId"),
        verifyingContract: nonFungibleNotePositionAddress,
      },
      {
        Permit: [
          { name: "spender", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        spender: spender,
        tokenId: tokenId,
        nonce: nonce,
        deadline: deadline,
      }
    )
  );
}
