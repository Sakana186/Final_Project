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

export function loadMedchainEnv(serviceRoot) {
  const repoRoot = path.resolve(serviceRoot, "..", "..");
  const merged = {
    ...readEnvFile(path.join(repoRoot, ".env")),
    ...readEnvFile(path.join(serviceRoot, ".env")),
    ...process.env,
  };

  return {
    backendHost: merged.MEDCHAIN_GATEWAY_HOST || merged.MEDCHAIN_BACKEND_HOST || "127.0.0.1",
    backendPort: Number(merged.MEDCHAIN_GATEWAY_PORT || merged.MEDCHAIN_BACKEND_PORT || 4001),
    blockchainServiceUrl: (merged.MEDCHAIN_BLOCKCHAIN_SERVICE_URL || "http://127.0.0.1:4100").replace(/\/$/, ""),
    storageServiceUrl: (merged.MEDCHAIN_STORAGE_SERVICE_URL || "http://127.0.0.1:4200").replace(/\/$/, ""),
    actors: {
      PATIENT: {
        name: "",
        address: "",
      },
      DOCTOR: {
        name: "",
        address: "",
      },
      ADMIN: {
        name: merged.MEDCHAIN_ADMIN_DISPLAY_NAME || "Quản trị viên",
        address: "",
      },
    },
  };
}
