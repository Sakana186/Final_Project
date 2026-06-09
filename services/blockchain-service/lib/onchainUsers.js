import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";

function resolveRole(roleValue) {
  const map = {
    1: "PATIENT",
    2: "DOCTOR",
    3: "ADMIN",
  };

  return map[Number(roleValue)] || "NONE";
}

function shortAddress(address) {
  if (!address) {
    return "Unknown";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readAbi(blockchainRoot) {
  const abiPath = path.resolve(blockchainRoot, "..", "..", "shared", "abi", "EHRAccessControl.json");
  if (!fs.existsSync(abiPath)) {
    throw new Error("Thiếu ABI runtime của EHRAccessControl trong shared/abi.");
  }

  return JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;
}

function readDeployment(blockchainRoot, networkName) {
  const deploymentPath = path.join(blockchainRoot, "deployments", `${networkName}.json`);

  if (!fs.existsSync(deploymentPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

export function createOnchainUserDirectory(blockchainRoot, envConfig) {
  const abi = readAbi(blockchainRoot);

  function resolveContract() {
    const deployment = readDeployment(blockchainRoot, envConfig.networkName);
    const contractAddress = envConfig.contractAddress || deployment?.contractAddress || "";

    if (!contractAddress) {
      return null;
    }

    if (!envConfig.rpcUrl) {
      throw new Error("Thiếu SEPOLIA_RPC_URL để tải danh sách người dùng từ blockchain.");
    }

    const provider = new ethers.JsonRpcProvider(envConfig.rpcUrl);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    return {
      contract,
      deployment,
      contractAddress,
    };
  }

  return {
    async listUsers() {
      const resolved = resolveContract();

      if (!resolved) {
        return [];
      }

      const { contract, deployment } = resolved;
      const fromBlock = Number(deployment.blockNumber || 0);
      const logs = await contract.queryFilter(contract.filters.UserRegistered(), fromBlock, "latest");
      const ownerAddress = await contract.owner();
      const addresses = new Set([ownerAddress.toLowerCase()]);

      for (const log of logs) {
        if (log.args?.user) {
          addresses.add(String(log.args.user).toLowerCase());
        }
      }

      const rows = await Promise.all(
        [...addresses].map(async (address) => {
          const user = await contract.users(address);
          const role = resolveRole(user.role);

          if (role === "NONE") {
            return null;
          }

          const isOwner = address === ownerAddress.toLowerCase();

          return {
            name: isOwner ? "Owner Admin" : `${role} ${shortAddress(address)}`,
            address,
            role,
            attributes: user.attributeHash,
            attributeHash: user.attributeHash,
            status: user.isActive ? "Active" : "Disabled",
          };
        }),
      );

      return rows
        .filter(Boolean)
        .sort((left, right) => {
          if (left.role === right.role) {
            return left.address.localeCompare(right.address);
          }

          return left.role.localeCompare(right.role);
        });
    },
    async findUser(address) {
      const normalized = String(address || "").trim().toLowerCase();

      if (!normalized) {
        return null;
      }

      const users = await this.listUsers();
      return users.find((user) => user.address.toLowerCase() === normalized) || null;
    },
  };
}
