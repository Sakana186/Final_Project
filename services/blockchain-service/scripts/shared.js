import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blockchainRoot = path.resolve(__dirname, "..");

export function resolveRoleValue(roleName) {
  const role = String(roleName || "").toUpperCase();
  const map = {
    PATIENT: 1,
    DOCTOR: 2,
    ADMIN: 3,
  };

  return map[role] ?? 0;
}

export function resolveDeploymentPath(networkName) {
  return path.join(blockchainRoot, "deployments", `${networkName}.json`);
}

export function writeDeployment(networkName, payload) {
  const deploymentPath = resolveDeploymentPath(networkName);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(payload, null, 2));
}

export function readDeployment(networkName) {
  const deploymentPath = resolveDeploymentPath(networkName);
  if (!fs.existsSync(deploymentPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

export function resolveContractAddress() {
  const networkName = process.env.MEDCHAIN_NETWORK || process.env.HARDHAT_NETWORK || "localhost";
  return process.env.CONTRACT_ADDRESS || readDeployment(networkName)?.contractAddress || "";
}

export async function resolveSigner(ethers, address, privateKey) {
  const signers = await ethers.getSigners();
  const normalized = String(address || "").toLowerCase();

  if (normalized) {
    const matchingSigner = signers.find((signer) => signer.address.toLowerCase() === normalized);
    if (matchingSigner) {
      return matchingSigner;
    }

    try {
      const rpcSigner = await ethers.provider.getSigner(address);
      const signerAddress = await rpcSigner.getAddress();
      if (signerAddress.toLowerCase() === normalized) {
        return rpcSigner;
      }
    } catch {
      // Fallback to private key resolution below.
    }
  }

  if (privateKey) {
    return new ethers.Wallet(privateKey, ethers.provider);
  }

  if (signers[0]) {
    return signers[0];
  }

  throw new Error("No available signer for this script.");
}

export function printJson(payload) {
  console.log(JSON.stringify(payload));
}
