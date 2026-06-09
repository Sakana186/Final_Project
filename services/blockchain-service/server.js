import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContractBridge } from "./lib/contractBridge.js";
import { loadBlockchainEnv } from "./lib/env.js";
import { ensureAddress, normalizeRole } from "./lib/helpers.js";
import { createOnchainUserDirectory } from "./lib/onchainUsers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blockchainRoot = path.resolve(__dirname);
const envConfig = loadBlockchainEnv(__dirname);
const bridge = createContractBridge(blockchainRoot, envConfig);
const onchainUsers = createOnchainUserDirectory(blockchainRoot, envConfig);
const host = envConfig.host;
const port = envConfig.port;

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
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

async function buildStatusResponse() {
  return {
    systemStatus: bridge.statusRows(),
    networkLabel: envConfig.networkName.toUpperCase(),
    contract: {
      ready: bridge.ready,
      address: bridge.address,
      deployment: bridge.deployment(),
    },
  };
}

async function handleLogin(body) {
  const address = ensureAddress(body.address);
  const role = normalizeRole(body.role);

  if (!address || !role) {
    throw new Error("Thiếu public key hoặc role để đăng nhập.");
  }

  const user = await onchainUsers.findUser(address);
  if (!user) {
    throw new Error("Public key này chưa được admin đăng ký trên blockchain.");
  }

  if (user.role !== role) {
    throw new Error(`Public key này không thuộc vai trò ${role}.`);
  }

  if (user.status !== "Active") {
    throw new Error("Tài khoản on-chain hiện đang bị vô hiệu hoá.");
  }

  return {
    message: `Đã xác thực ${user.name}.`,
    session: {
      name: user.name,
      address: user.address,
      role: user.role,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    const pathname = getPathname(req);

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, { ok: true, status: "OK" });
      return;
    }

    if (req.method === "GET" && pathname === "/status") {
      sendJson(res, 200, await buildStatusResponse());
      return;
    }

    if (req.method === "GET" && pathname === "/users") {
      sendJson(res, 200, { users: await onchainUsers.listUsers() });
      return;
    }

    const userMatch = pathname.match(/^\/users\/([^/]+)$/);
    if (req.method === "GET" && userMatch) {
      sendJson(res, 200, { user: await onchainUsers.findUser(decodeURIComponent(userMatch[1])) });
      return;
    }

    if (req.method === "POST" && pathname === "/auth/login") {
      sendJson(res, 200, await handleLogin(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/users") {
      const body = await parseBody(req);
      const result = await bridge.registerUser({
        address: ensureAddress(body.address),
        role: normalizeRole(body.role),
        attributes: body.attributes || "",
        attributeHash: body.attributeHash || "",
      });
      sendJson(res, 200, result);
      return;
    }

    const statusMatch = pathname.match(/^\/users\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      const body = await parseBody(req);
      const result = await bridge.setUserStatus({
        address: ensureAddress(decodeURIComponent(statusMatch[1])),
        isActive: Boolean(body.isActive),
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && pathname === "/access/check") {
      const body = await parseBody(req);
      const result = await bridge.checkAccess({
        contractRecordId: Number(body.contractRecordId),
        userAddress: ensureAddress(body.userAddress),
      });
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Blockchain service failed." });
  }
});

server.listen(port, host, () => {
  console.log(`Blockchain service listening on http://${host}:${port}`);
});
