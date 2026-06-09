import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const networks = {};

if (process.env.SEPOLIA_RPC_URL && process.env.ADMIN_PRIVATE_KEY) {
  networks.sepolia = {
    type: "http",
    chainType: "l1",
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.ADMIN_PRIVATE_KEY],
  };
}

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: "0.8.28",
  paths: {
    sources: path.join(__dirname, "contracts"),
    cache: path.join(__dirname, "cache"),
    artifacts: path.join(__dirname, "artifacts"),
  },
  networks,
});
