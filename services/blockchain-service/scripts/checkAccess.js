import { network } from "hardhat";
import { printJson, resolveContractAddress, resolveSigner } from "./shared.js";

async function main() {
  const { ethers } = await network.connect();
  const viewerSigner = await resolveSigner(ethers, process.env.ADMIN_ADDRESS, process.env.ADMIN_PRIVATE_KEY);
  const contract = await ethers.getContractAt("EHRAccessControl", resolveContractAddress(), viewerSigner);
  const hasAccess = await contract.hasAccess(
    Number(process.env.RECORD_ID || "0"),
    process.env.USER_ADDRESS,
  );

  printJson({
    recordId: Number(process.env.RECORD_ID || "0"),
    userAddress: process.env.USER_ADDRESS,
    hasAccess,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
