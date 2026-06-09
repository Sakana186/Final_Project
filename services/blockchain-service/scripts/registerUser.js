import { network } from "hardhat";
import { printJson, resolveContractAddress, resolveRoleValue, resolveSigner } from "./shared.js";

async function main() {
  const { ethers } = await network.connect();
  const contractAddress = resolveContractAddress();
  const ownerSigner = await resolveSigner(ethers, process.env.ADMIN_ADDRESS, process.env.ADMIN_PRIVATE_KEY);
  const contract = await ethers.getContractAt("EHRAccessControl", contractAddress, ownerSigner);
  const tx = await contract.registerUser(
    process.env.USER_ADDRESS,
    resolveRoleValue(process.env.USER_ROLE),
    ethers.keccak256(ethers.toUtf8Bytes(process.env.USER_ATTRIBUTES || "")),
  );
  const receipt = await tx.wait();

  printJson({
    txHash: receipt.hash,
    blockNumber: Number(receipt.blockNumber),
    userAddress: process.env.USER_ADDRESS,
    role: process.env.USER_ROLE,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
