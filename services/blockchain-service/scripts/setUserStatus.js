import { network } from "hardhat";
import { printJson, resolveContractAddress, resolveSigner } from "./shared.js";

async function main() {
  const { ethers } = await network.connect();
  const ownerSigner = await resolveSigner(ethers, process.env.ADMIN_ADDRESS, process.env.ADMIN_PRIVATE_KEY);
  const contract = await ethers.getContractAt("EHRAccessControl", resolveContractAddress(), ownerSigner);
  const isActive = String(process.env.USER_ACTIVE || "true") === "true";
  const tx = await contract.setUserStatus(process.env.USER_ADDRESS, isActive);
  const receipt = await tx.wait();

  printJson({
    txHash: receipt.hash,
    blockNumber: Number(receipt.blockNumber),
    userAddress: process.env.USER_ADDRESS,
    isActive,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
