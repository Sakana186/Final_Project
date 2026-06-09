import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildKpabePackage } from "./kpabeBridge.js";

async function uploadPackageToPinata(packageJson, envConfig) {
  const body = new FormData();
  const blob = new Blob([JSON.stringify(packageJson, null, 2)], { type: "application/json" });
  body.append("file", blob, `${packageJson.recordId || "ehr-record"}.json`);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${envConfig.pinataJwt}`,
    },
    body,
  });

  const responseBody = await response.json();
  if (!response.ok) {
    throw new Error(`Upload IPFS thất bại: ${JSON.stringify(responseBody)}`);
  }

  return {
    cid: responseBody.IpfsHash,
    gatewayUrl: `${envConfig.pinataGatewayBase}/${responseBody.IpfsHash}`,
  };
}

function persistPackageLocally(packageJson, envConfig) {
  const serialized = JSON.stringify(packageJson, null, 2);
  const cid = `local-${crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 32)}`;
  const outputDir = envConfig.localPackageDir;
  const outputPath = path.join(outputDir, `${cid}.json`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, serialized);

  return {
    cid,
    gatewayUrl: `local://storage-service/packages/${cid}.json`,
  };
}

export function createStorageService(envConfig) {
  function mode() {
    return envConfig.pinataJwt ? "PINATA_READY" : "LOCAL_FALLBACK";
  }

  return {
    status: mode,
    async sealRecord(record, recordHash) {
      if (!recordHash) {
        throw new Error("Thiếu recordHash để mã hoá package bệnh án.");
      }

      const packageJson = await buildKpabePackage(record, recordHash, envConfig);
      const uploadResult = envConfig.pinataJwt
        ? await uploadPackageToPinata(packageJson, envConfig)
        : persistPackageLocally(packageJson, envConfig);

      return {
        cid: uploadResult.cid,
        gatewayUrl: uploadResult.gatewayUrl,
        packageJson,
        mode: mode(),
      };
    },
  };
}
