import fs from "node:fs";
import path from "node:path";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, "$1");
    result[key] = value;
  }

  return result;
}

export function loadBlockchainEnv(serviceRoot) {
  const repoRoot = path.resolve(serviceRoot, "..", "..");
  const merged = {
    ...readEnvFile(path.join(repoRoot, ".env")),
    ...readEnvFile(path.join(serviceRoot, ".env")),
    ...process.env,
  };

  return {
    host: merged.MEDCHAIN_BLOCKCHAIN_SERVICE_HOST || "0.0.0.0",
    port: Number(merged.MEDCHAIN_BLOCKCHAIN_SERVICE_PORT || 4100),
    networkName: merged.MEDCHAIN_NETWORK || "sepolia",
    rpcUrl: merged.SEPOLIA_RPC_URL || merged.MEDCHAIN_RPC_URL || "",
    contractAddress: merged.CONTRACT_ADDRESS || "",
    adminAddress: merged.ADMIN_ADDRESS || "",
    adminPrivateKey: merged.ADMIN_PRIVATE_KEY || "",
  };
}
