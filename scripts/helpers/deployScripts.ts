import { ethers, upgrades } from "hardhat";
import { SignerWithAddress as Signer } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ParabolUSD,
  Denylister,
  NonFungibleNotePosition,
  ReserveStabilityPool,
} from "../../typechain-types";

export async function deployDenylister(
  deployer: Signer,
  admin: string
): Promise<{
  denylister: Denylister;
}> {
  // Deploy Denylister and SanctionsList contracts
  const denylister = (await upgrades.deployProxy(
    await ethers.getContractFactory("Denylister", deployer),
    [admin]
  )) as unknown as Denylister;

  return {
    denylister,
  };
}

export async function deployParabolUSD(
  deployer: Signer,
  name: string,
  symbol: string,
  version: string,
  denylisterAddress: string,
  admin: string,
  minter: string,
  burner: string,
  pauser: string
): Promise<{
  paraUSD: ParabolUSD;
}> {
  // Deploy ParabolUSD contract
  const paraUSD = (await upgrades.deployProxy(
    await ethers.getContractFactory("ParabolUSD", deployer),
    [name, symbol, version, denylisterAddress, admin, minter, burner, pauser],
    { initializer: "initialize" }
  )) as unknown as ParabolUSD;

  return {
    paraUSD,
  };
}

export async function deployNonFungibleNotePosition(
  deployer: Signer,
  name: string,
  symbol: string,
  version: string,
  denylisterAddress: string,
  admin: string,
  pauser: string
): Promise<{
  nonFungibleNotePosition: NonFungibleNotePosition;
}> {
  const dateTime = await (await ethers.getContractFactory("DateTime")).deploy();
  const parabolNoteSVG = await (
    await ethers.getContractFactory("ParabolNoteSVG")
  ).deploy();
  const parabolNoteDescriptor = await (
    await ethers.getContractFactory("ParabolNoteDescriptor", {
      libraries: {
        DateTime: dateTime.target,
        ParabolNoteSVG: parabolNoteSVG.target,
      },
    })
  ).deploy();
  // Deploy ParabolUSD contract
  const nonFungibleNotePosition = (await upgrades.deployProxy(
    await ethers.getContractFactory("NonFungibleNotePosition", {
      signer: deployer,
      libraries: {
        ParabolNoteDescriptor: parabolNoteDescriptor.target,
      },
    }),
    [name, symbol, version, denylisterAddress, admin, pauser],
    { initializer: "initialize", unsafeAllowLinkedLibraries: true }
  )) as unknown as NonFungibleNotePosition;

  return {
    nonFungibleNotePosition,
  };
}

export async function deployReserveStabilityPool(
  deployer: Signer,
  paraUSDAddress: string,
  nonFungibleNotePositionAddress: string,
  verifierName: string,
  verifierVersion: string,
  verifierSigner: string,
  admin: string,
  floatingIncomeAccount: string,
  pauser: string
): Promise<{
  reserveStabilityPool: ReserveStabilityPool;
}> {
  // Deploy ParabolUSD contract
  const reserveStabilityPool = (await upgrades.deployProxy(
    await ethers.getContractFactory("ReserveStabilityPool", deployer),
    [
      paraUSDAddress,
      nonFungibleNotePositionAddress,
      verifierName,
      verifierVersion,
      verifierSigner,
      admin,
      floatingIncomeAccount,
      pauser,
    ],
    { initializer: "initialize" }
  )) as unknown as ReserveStabilityPool;

  return {
    reserveStabilityPool,
  };
}
