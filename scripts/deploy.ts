import { ethers } from "hardhat";
import {
  deployDenylister,
  deployNonFungibleNotePosition,
  deployParabolUSD,
  deployReserveStabilityPool,
} from "./helpers/deployScripts";

async function main() {
  const [deployer] = await ethers.getSigners();

  const DEFAULT_ADMIN_ACCOUNT = "0x7D203C37872a93D968a4cDaDfEA0a55bDD887512";
  const PAUSER_ACCOUNT = "0x31bC5Ce50dc9e33302106A797A8FD6B3132Fa3F3";
  const MINTER_ACCOUNT = "0xffe92E1D0048F2819e8A622c7a0251A1a8484527";
  const BURNER_ACCOUNT = "0x9444A891768638e8cD7E93ee7f179959c35e946b";
  const VERIFIER_SIGNER_ACCOUNT = "0xB016C34B1c12b1d693b58fC7B60238e2a313F559";
  const FLOATING_INCOME_ACCOUNT = "0x4e65869d12C7AE248caB53B74dC924bB105a7672";

  const nonFungibleNotePositionName = "paraUSD RSP Note NFT-V1";
  const nonFungibleNotePositionSymbol = "PARAUSD-RSP-NOTE";
  const nonFungibleNotePositionVersion = "1";

  const paraUSDName = "Parabol USD";
  const paraUSDSymbol = "paraUSD";
  const paraUSDVersion = "1";

  const verifierName = "NoteSignatureVerifier";
  const verifierVersion = "1";

  const { denylister } = await deployDenylister(
    deployer,
    DEFAULT_ADMIN_ACCOUNT
  );

  const { paraUSD } = await deployParabolUSD(
    deployer,
    paraUSDName,
    paraUSDSymbol,
    paraUSDVersion,
    denylister.target as string,
    DEFAULT_ADMIN_ACCOUNT,
    MINTER_ACCOUNT,
    BURNER_ACCOUNT,
    PAUSER_ACCOUNT
  );

  const { nonFungibleNotePosition } = await deployNonFungibleNotePosition(
    deployer,
    nonFungibleNotePositionName,
    nonFungibleNotePositionSymbol,
    nonFungibleNotePositionVersion,
    denylister.target as string,
    DEFAULT_ADMIN_ACCOUNT,
    PAUSER_ACCOUNT
  );

  const { reserveStabilityPool } = await deployReserveStabilityPool(
    deployer,
    paraUSD.target as string,
    nonFungibleNotePosition.target as string,
    verifierName,
    verifierVersion,
    VERIFIER_SIGNER_ACCOUNT,
    DEFAULT_ADMIN_ACCOUNT,
    FLOATING_INCOME_ACCOUNT,
    PAUSER_ACCOUNT
  );


  console.log("Denylister deployed to:", denylister.target);
  console.log(
    "NonFungibleNotePosition deployed to:",
    nonFungibleNotePosition.target
  );
  console.log("ParabolUSD deployed to:", paraUSD.target);
  console.log("ReserveStabilityPool deployed to:", reserveStabilityPool.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
