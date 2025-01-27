import { network } from "hardhat";
import { TypedDataDomain } from "ethers";
import { Signature } from "ethers";
import { SignerWithAddress as Signer } from "@nomicfoundation/hardhat-ethers/signers";

// Helper function to sign an ERC20 Permit
export async function signERC20Permit(
  paraUSDAddress: string,
  name: string,
  version: string,
  owner: string | Signer,
  spender: string,
  value: bigint,
  nonce: number,
  deadline: number,
  signer?: Signer
): Promise<Signature> {
  const domain: TypedDataDomain = {
    name: name,
    version: version,
    chainId: await network.provider.send("eth_chainId"),
    verifyingContract: paraUSDAddress,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const data = {
    owner: signer ? owner : (owner as Signer).address,
    spender: spender,
    value: value,
    nonce: nonce,
    deadline: deadline,
  };
  const sig = await (signer ? signer : (owner as Signer)).signTypedData(
    domain,
    types,
    data
  );
  return Signature.from(sig);
}

// export async function signERC20PermitForSmartAccount(
//   paraUSDAddress: string,
//   name: string,
//   version: string,
//   signer: Signer,
//   owner: string,
//   spender: string,
//   value: bigint,
//   nonce: number,
//   deadline: number
// ): Promise<Signature> {
//   const domain: TypedDataDomain = {
//     name: name,
//     version: version,
//     chainId: await network.provider.send("eth_chainId"),
//     verifyingContract: paraUSDAddress,
//   };

//   const types = {
//     Permit: [
//       { name: "owner", type: "address" },
//       { name: "spender", type: "address" },
//       { name: "value", type: "uint256" },
//       { name: "nonce", type: "uint256" },
//       { name: "deadline", type: "uint256" },
//     ],
//   };

//   const data = {
//     owner: owner,
//     spender: spender,
//     value: value,
//     nonce: nonce,
//     deadline: deadline,
//   };

//   const sig = await signer.signTypedData(domain, types, data);
//   return Signature.from(sig);
// }

export async function signTransferWithAuthorization(
  paraUSDAddress: string,
  name: string,
  version: string,
  from: string | Signer,
  to: string,
  value: bigint,
  validAfter: number,
  validBefore: number,
  nonce: string,
  signer?: Signer
): Promise<Signature> {
  const domain = {
    name: name,
    version: version,
    chainId: await network.provider.send("eth_chainId"),
    verifyingContract: paraUSDAddress,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const data = {
    from: signer ? from : (from as Signer).address,
    to: to,
    value: value,
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: nonce,
  };
  const sig = await (signer ? signer : (from as Signer)).signTypedData(
    domain,
    types,
    data
  );
  return Signature.from(sig);
}

export async function signReceiveWithAuthorization(
  paraUSDAddress: string,
  name: string,
  version: string,
  from: string | Signer,
  to: string,
  value: bigint,
  validAfter: number,
  validBefore: number,
  nonce: string,
  signer?: Signer
): Promise<Signature> {
  const domain = {
    name: name,
    version: version,
    chainId: await network.provider.send("eth_chainId"),
    verifyingContract: paraUSDAddress,
  };

  const types = {
    ReceiveWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const data = {
    from: signer ? from : (from as Signer).address,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const sig = await (signer ? signer : (from as Signer)).signTypedData(
    domain,
    types,
    data
  );
  return Signature.from(sig);
}

export async function signBurnWithAuthorization(
  paraUSDAddress: string,
  name: string,
  version: string,
  from: string | Signer,
  burner: string,
  value: bigint,
  validAfter: number,
  validBefore: number,
  nonce: string,
  signer?: Signer
): Promise<Signature> {
  const domain = {
    name: name,
    version: version,
    chainId: await network.provider.send("eth_chainId"),
    verifyingContract: paraUSDAddress,
  };

  const types = {
    BurnWithAuthorization: [
      { name: "from", type: "address" },
      { name: "burner", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const data = {
    from: signer ? from : (from as Signer).address,
    burner: burner,
    value: value,
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: nonce,
  };

  const sig = await (signer ? signer : (from as Signer)).signTypedData(
    domain,
    types,
    data
  );
  return Signature.from(sig);
}

export async function signCancelAuthorization(
  paraUSDAddress: string,
  name: string,
  version: string,
  authorizer: string | Signer,
  nonce: string,
  signer?: Signer
): Promise<Signature> {
  const domain = {
    name: name,
    version: version,
    chainId: await network.provider.send("eth_chainId"),
    verifyingContract: paraUSDAddress,
  };

  const types = {
    CancelAuthorization: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const data = {
    authorizer: signer ? authorizer : (authorizer as Signer).address,
    nonce: nonce,
  };

  const sig = await (signer ? signer : (authorizer as Signer)).signTypedData(
    domain,
    types,
    data
  );
  return Signature.from(sig);
}
