require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "1337", // Ganache
    },
    sepolia: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.INFURA_URL
        ),
      network_id: 11155111,     // Sepolia network ID
      gas: 5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      networkCheckTimeout: 100000,
      skipDryRun: true,
    },
  },

  compilers: {
    solc: {
      version: "0.8.20",
    },
  },

  contracts_directory: "./contracts",
  contracts_build_directory: "./build/contracts",
};
