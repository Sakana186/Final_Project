import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from "ethers";
import artifact from "../../../shared/abi/EHRAccessControl.json";

async function getSigner() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Không tìm thấy MetaMask trên trình duyệt này.");
  }

  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

async function getContract(contractAddress) {
  if (!contractAddress) {
    throw new Error("Contract address chưa sẵn sàng.");
  }

  const signer = await getSigner();
  return new Contract(contractAddress, artifact.abi, signer);
}

async function assertOwner(contract) {
  const signerAddress = await contract.runner.getAddress();
  const ownerAddress = await contract.owner();

  if (String(signerAddress).toLowerCase() !== String(ownerAddress).toLowerCase()) {
    throw new Error("Ví MetaMask hiện tại không phải owner của contract này.");
  }
}

function shortenMessage(message, fallback) {
  const normalized = String(message || fallback || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
}

function toUserFacingError(error, fallback) {
  const details = [
    error?.shortMessage,
    error?.reason,
    error?.info?.error?.message,
    error?.message,
  ]
    .filter(Boolean)
    .join(" | ");

  if (/user rejected|user denied|ACTION_REJECTED|rejected the request/i.test(details)) {
    return new Error("Bạn đã từ chối giao dịch trong MetaMask.");
  }

  if (/not owner/i.test(details)) {
    return new Error("Ví MetaMask hiện tại không phải owner của contract này.");
  }

  if (/insufficient funds/i.test(details)) {
    return new Error("Ví MetaMask không đủ SepoliaETH để trả phí gas.");
  }

  if (/missing revert data|execution reverted|call exception/i.test(details)) {
    return new Error(shortenMessage(error?.shortMessage || error?.reason || fallback, fallback));
  }

  return new Error(shortenMessage(error?.shortMessage || error?.message || fallback, fallback));
}

function parseLog(contract, receipt, eventName) {
  const log = receipt.logs
    .map((item) => {
      try {
        return contract.interface.parseLog(item);
      } catch {
        return null;
      }
    })
    .find((item) => item?.name === eventName);

  return log || null;
}

export const contractService = {
  hashText(value) {
    return keccak256(toUtf8Bytes(String(value || "")));
  },
  resolveRoleValue(roleName) {
    const role = String(roleName || "").trim().toUpperCase();
    const map = {
      PATIENT: 1,
      DOCTOR: 2,
      ADMIN: 3,
    };

    return map[role] ?? 0;
  },
  async addRecord({ contractAddress, patientAddress, cid, recordHash, policyHash }) {
    try {
      const contract = await getContract(contractAddress);
      const tx = await contract.addRecord(patientAddress, cid, recordHash, policyHash);
      const receipt = await tx.wait();
      const event = parseLog(contract, receipt, "RecordAdded");
      const nextRecordId = await contract.nextRecordId();
      const fallbackRecordId = Number(nextRecordId) - 1;

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        contractRecordId: event ? Number(event.args.recordId) : fallbackRecordId,
      };
    } catch (error) {
      throw toUserFacingError(error, "Không thể ghi hồ sơ lên blockchain.");
    }
  },
  async requestAccess({ contractAddress, contractRecordId, expiredAtUnix, purposeHash }) {
    try {
      const contract = await getContract(contractAddress);
      const tx = await contract.requestAccess(contractRecordId, expiredAtUnix, purposeHash);
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      throw toUserFacingError(error, "Không thể gửi yêu cầu truy cập lên blockchain.");
    }
  },
  async grantAccess({ contractAddress, contractRecordId, granteeAddress, expiredAtUnix, purposeHash }) {
    try {
      const contract = await getContract(contractAddress);
      const tx = await contract.grantAccess(contractRecordId, granteeAddress, expiredAtUnix, purposeHash);
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      throw toUserFacingError(error, "Không thể cấp quyền trên blockchain.");
    }
  },
  async revokeAccess({ contractAddress, contractRecordId, granteeAddress }) {
    try {
      const contract = await getContract(contractAddress);
      const tx = await contract.revokeAccess(contractRecordId, granteeAddress);
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      throw toUserFacingError(error, "Không thể thu hồi quyền trên blockchain.");
    }
  },
  async registerUser({ contractAddress, userAddress, role, attributes, attributeHash }) {
    try {
      const contract = await getContract(contractAddress);
      await assertOwner(contract);
      const tx = await contract.registerUser(
        userAddress,
        this.resolveRoleValue(role),
        attributeHash || this.hashText(attributes || ""),
      );
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      throw toUserFacingError(error, "Không thể đăng ký người dùng trên blockchain.");
    }
  },
  async setUserStatus({ contractAddress, userAddress, isActive }) {
    try {
      const contract = await getContract(contractAddress);
      await assertOwner(contract);
      const tx = await contract.setUserStatus(userAddress, Boolean(isActive));
      const receipt = await tx.wait();

      return {
        txHash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      throw toUserFacingError(error, "Không thể cập nhật trạng thái người dùng trên blockchain.");
    }
  },
};
