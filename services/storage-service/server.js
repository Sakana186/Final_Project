import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStorageService } from "./lib/storageService.js";

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

function resolveServicePath(serviceRoot, value, fallback = "") {
  const raw = String(value || fallback || "").trim();
  if (!raw) {
    return "";
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  if (!raw.includes("/") && !raw.includes("\\")) {
    return raw;
  }

  return path.join(serviceRoot, raw);
}

function resolvePythonBin(serviceRoot, explicitValue) {
  const candidates = [
    resolveServicePath(serviceRoot, explicitValue),
    path.join(serviceRoot, ".venv", "bin", "python"),
    "python3",
  ];

  for (const candidate of candidates) {
    const raw = String(candidate || "").trim();
    if (!raw) {
      continue;
    }

    if (!raw.includes("/") && !raw.includes("\\")) {
      return raw;
    }

    if (fs.existsSync(raw)) {
      return raw;
    }
  }

  return "python3";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const env = {
  ...readEnvFile(path.join(repoRoot, ".env")),
  ...readEnvFile(path.join(__dirname, ".env")),
  ...process.env,
};
const envConfig = {
  host: env.MEDCHAIN_STORAGE_HOST || "0.0.0.0",
  port: Number(env.MEDCHAIN_STORAGE_PORT || 4200),
  pinataJwt: env.PINATA_JWT || "",
  pinataGatewayBase: env.PINATA_GATEWAY_BASE || "https://gateway.pinata.cloud/ipfs",
  localPackageDir: resolveServicePath(__dirname, env.MEDCHAIN_LOCAL_PACKAGE_DIR, "data/packages"),
  pythonBin: resolvePythonBin(__dirname, env.MEDCHAIN_PYTHON_BIN),
  charmSrc: resolveServicePath(__dirname, env.MEDCHAIN_CHARM_SRC),
  kpabeCurve: env.MEDCHAIN_KPABE_CURVE || "BN254",
  kpabeKeyStorePath: resolveServicePath(__dirname, env.MEDCHAIN_KPABE_KEYSTORE_PATH),
};
const storageService = createStorageService(envConfig);

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getPathname(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    const pathname = getPathname(req);

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        status: storageService.status(),
        encryptionScheme: "KP-ABE-HYBRID",
        kpabeCurve: envConfig.kpabeCurve,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/seal-record") {
      const body = await parseBody(req);
      const result = await storageService.sealRecord(body.record || {}, body.recordHash || "");
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Storage service failed." });
  }
});

server.listen(envConfig.port, envConfig.host, () => {
  console.log(`Storage service listening on http://${envConfig.host}:${envConfig.port}`);
});
