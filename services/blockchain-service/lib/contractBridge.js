import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { resolveRoleValue } from "./helpers.js";

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

export function createContractBridge(blockchainRoot, envConfig) {
  const abi = readAbi(blockchainRoot);

  function deployment() {
    return readDeployment(blockchainRoot, envConfig.networkName);
  }

  function activeContractAddress() {
    return envConfig.contractAddress || deployment()?.contractAddress || "";
  }

  function requireRpcUrl() {
    if (!envConfig.rpcUrl) {
      throw new Error("Thiếu SEPOLIA_RPC_URL để kết nối blockchain-service tới Sepolia.");
    }

    return envConfig.rpcUrl;
  }

  function requireContractAddress() {
    const address = activeContractAddress();
    if (!address) {
      throw new Error(
        `Chưa tìm thấy deployment cho network ${envConfig.networkName}. Hãy deploy contract trước khi chạy service.`,
      );
    }

    return address;
  }

  function buildReadContract() {
    const provider = new ethers.JsonRpcProvider(requireRpcUrl());
    const contract = new ethers.Contract(requireContractAddress(), abi, provider);

    return { provider, contract };
  }

  function buildWriteContract() {
    if (!envConfig.adminPrivateKey) {
      throw new Error("Thiếu ADMIN_PRIVATE_KEY để thực hiện thao tác quản trị on-chain từ blockchain-service.");
    }

    const provider = new ethers.JsonRpcProvider(requireRpcUrl());
    const signer = new ethers.Wallet(envConfig.adminPrivateKey, provider);
    const contract = new ethers.Contract(requireContractAddress(), abi, signer);

    return { provider, signer, contract };
  }

  function normalizeAttributeHash(payload) {
    if (payload.attributeHash && /^0x[0-9a-fA-F]{64}$/.test(String(payload.attributeHash))) {
      return String(payload.attributeHash);
    }

    return ethers.keccak256(ethers.toUtf8Bytes(String(payload.attributes || "")));
  }

  return {
    get ready() {
      return Boolean(activeContractAddress() && envConfig.rpcUrl);
    },
    get address() {
      return activeContractAddress();
    },
    deployment,
    statusRows() {
      return [
        ["Blockchain Service", "OK"],
        ["RPC Provider", envConfig.rpcUrl ? "OK" : "ERROR: Chưa cấu hình SEPOLIA_RPC_URL"],
        ["Network", envConfig.networkName ? envConfig.networkName.toUpperCase() : "ERROR: Chưa cấu hình network"],
        ["Smart Contract", activeContractAddress() ? "OK" : "ERROR: Chưa có deployment contract"],
      ];
    },
    async registerUser(payload) {
      const { contract } = buildWriteContract();
      const tx = await contract.registerUser(
        payload.address,
        resolveRoleValue(payload.role),
        normalizeAttributeHash(payload),
      );
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        userAddress: payload.address,
        role: payload.role,
      };
    },
    async setUserStatus(payload) {
      const { contract } = buildWriteContract();
      const tx = await contract.setUserStatus(payload.address, Boolean(payload.isActive));
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        userAddress: payload.address,
        isActive: Boolean(payload.isActive),
      };
    },
    async checkAccess(payload) {
      const { contract } = buildReadContract();
      const hasAccess = await contract.hasAccess(Number(payload.contractRecordId), payload.userAddress);

      return {
        recordId: Number(payload.contractRecordId),
        userAddress: payload.userAddress,
        hasAccess,
      };
    },
  };
}
