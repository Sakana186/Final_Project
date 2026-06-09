import { network } from "hardhat";
import { printJson, writeDeployment } from "./shared.js";

async function main() {
  const { ethers } = await network.connect();
  const contract = await ethers.deployContract("EHRAccessControl");
  const deploymentTx = contract.deploymentTransaction();
  const receipt = await deploymentTx.wait();
  await contract.waitForDeployment();

  const networkName = process.env.MEDCHAIN_NETWORK || process.env.HARDHAT_NETWORK || "localhost";
  const contractAddress = await contract.getAddress();
  const payload = {
    contractAddress,
    network: networkName,
    deployedAt: new Date().toISOString(),
    blockNumber: Number(receipt.blockNumber),
  };

  writeDeployment(networkName, payload);
  printJson(payload);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
