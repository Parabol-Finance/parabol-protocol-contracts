import { config as loadEnv } from "dotenv";
loadEnv();
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "@openzeppelin/hardhat-upgrades";

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY environment variable is not set");
}

const INFURA_KEY = process.env.INFURA_KEY!;
if (!INFURA_KEY) {
  throw new Error("INFURA_KEY environment variable is not set");
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          evmVersion: "shanghai",
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
              yulDetails: {
                optimizerSteps: "u",
              },
            },
          },
        },
      },
    ],
  },
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY!],
    },
    base: {
      url: `https://base-mainnet.infura.io/v3/${INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY!],
    },
    base_sepolia: {
      url: `https://base-sepolia.infura.io/v3/${INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY!],
    },
    zksync_era: {
      url: `https://zksync-mainnet.infura.io/v3/${INFURA_KEY}`,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY!,
    },
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
