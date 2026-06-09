import { useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import ActionNotice from "./components/common/ActionNotice";
import OperationOverlay from "./components/common/OperationOverlay";
import PublicKeyGate from "./components/auth/PublicKeyGate";
import { initialAppState } from "./data/initialState";
import { menus } from "./data/menus";
import { renderPage } from "./pages/pageRegistry.jsx";
import { contractService } from "./services/contractService";
import { medchainService } from "./services/medchainService";
import { walletService } from "./services/walletService";

export default function App() {
  const [role, setRole] = useState("ADMIN");
  const [page, setPage] = useState("admin-overview");
  const [patientRecordDetail, setPatientRecordDetail] = useState(null);
  const [appState, setAppState] = useState(initialAppState);
  const [session, setSession] = useState(null);
  const [bootstrapError, setBootstrapError] = useState("");
  const [operationPhase, setOperationPhase] = useState("");
  const [operationMessage, setOperationMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const state = await medchainService.getState();
        if (!cancelled) {
          setAppState((current) => ({ ...current, ...state }));
          setBootstrapError("");
        }
      } catch (error) {
        if (!cancelled) {
          setBootstrapError(`Không kết nối được API gateway MedChain. ${error.message}`);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || session.role === "ADMIN") {
      return undefined;
    }

    let dispose = null;

    try {
      dispose = walletService.onAccountsChanged((accounts) => {
        const nextAddress = accounts?.[0] ? String(accounts[0]).toLowerCase() : "";
        if (!nextAddress || nextAddress !== session.address.toLowerCase()) {
          setSession(null);
          setPatientRecordDetail(null);
          setPage("auth");
        }
      });
    } catch {
      return undefined;
    }

    return () => {
      if (dispose) {
        dispose();
      }
    };
  }, [session]);

  function applyState(result) {
    const nextState = result.state || result;
    if (nextState.users && nextState.records) {
      setAppState((current) => ({ ...current, ...nextState }));
    }
    return result;
  }

  async function runWithOperationOverlay(task) {
    setOperationPhase("pending");
    setOperationMessage("");
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });

    try {
      const result = await task();
      setOperationPhase("success");
      setOperationMessage("Yêu cầu đã được thực hiện thành công.");
      await new Promise((resolve) => {
        window.setTimeout(resolve, 900);
      });
      return result;
    } catch (error) {
      setOperationPhase("error");
      setOperationMessage(error?.message || "Đã có lỗi xảy ra trong quá trình xử lý.");
      await new Promise((resolve) => {
        window.setTimeout(resolve, 1200);
      });
      throw error;
    } finally {
      setOperationPhase("");
      setOperationMessage("");
    }
  }

  function handleRoleChange(nextRole, fallbackPage = menus[nextRole][0].id) {
    if (session?.role === nextRole) {
      setRole(nextRole);
      setPage(fallbackPage);
      return;
    }

    setPatientRecordDetail(null);
    setRole(nextRole);
    setPage("auth");
  }

  function logout() {
    setSession(null);
    setPatientRecordDetail(null);
    setPage("auth");
  }

  const matchedUser = session
    ? appState.users.find((user) => user.address.toLowerCase() === session.address.toLowerCase())
    : null;

  const sessionActors = {
    ...appState.actors,
    ...(session
      ? {
          [session.role]: {
            name: matchedUser?.name || session.name,
            address: session.address,
          },
        }
      : {}),
  };

  const contractAddress = appState.contract.address;
  const contractReady = Boolean(appState.contract.ready && contractAddress);

  function ensureContractReady() {
    if (!contractReady) {
      throw new Error("Smart contract chưa sẵn sàng. Kiểm tra CONTRACT_ADDRESS hoặc đợi hệ thống tải lại trạng thái.");
    }

    return contractAddress;
  }

  const actions = {
    async login(payload) {
      return runWithOperationOverlay(async () => {
        const result = await medchainService.login(payload);
        setSession(result.session);
        setRole(result.session.role);
        setPage(menus[result.session.role][0].id);
        return result;
      });
    },
    async createRecord(payload) {
      return runWithOperationOverlay(async () => {
        if (!session?.address) {
          throw new Error("Bạn cần đăng nhập doctor bằng MetaMask trước.");
        }

        const prepared = await medchainService.prepareRecord({
          ...payload,
          creatorAddress: session.address,
        });
        const txResult = await contractService.addRecord({
          contractAddress: ensureContractReady(),
          patientAddress: prepared.prepared.patientAddress,
          cid: prepared.prepared.cid,
          recordHash: prepared.prepared.recordHash,
          policyHash: prepared.prepared.policyHash,
        });

        return applyState(
          await medchainService.commitRecord({
            ...payload,
            creatorAddress: session.address,
            patientAddress: prepared.prepared.patientAddress,
            cid: prepared.prepared.cid,
            recordHash: prepared.prepared.recordHash,
            policyHash: prepared.prepared.policyHash,
            contractRecordId: txResult.contractRecordId,
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async requestAccess(payload) {
      return runWithOperationOverlay(async () => {
        if (!session?.address) {
          throw new Error("Bạn cần đăng nhập doctor bằng MetaMask trước.");
        }

        const prepared = await medchainService.prepareRequestAccess({
          ...payload,
          requesterAddress: session.address,
        });
        const txResult = await contractService.requestAccess({
          contractAddress: ensureContractReady(),
          contractRecordId: prepared.prepared.contractRecordId,
          expiredAtUnix: prepared.prepared.expiredAtUnix,
          purposeHash: prepared.prepared.purposeHash,
        });

        return applyState(
          await medchainService.commitRequestAccess({
            recordId: prepared.prepared.recordId,
            requesterAddress: session.address,
            purpose: prepared.prepared.purpose,
            durationDays: prepared.prepared.durationDays,
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async approveRequest(request) {
      return runWithOperationOverlay(async () => {
        if (!session?.address) {
          throw new Error("Bạn cần đăng nhập patient bằng MetaMask trước.");
        }

        const prepared = await medchainService.prepareGrantAccess({ requestId: request.id });
        const txResult = await contractService.grantAccess({
          contractAddress: ensureContractReady(),
          contractRecordId: prepared.prepared.contractRecordId,
          granteeAddress: prepared.prepared.granteeAddress,
          expiredAtUnix: prepared.prepared.expiredAtUnix,
          purposeHash: prepared.prepared.purposeHash,
        });

        return applyState(
          await medchainService.commitGrantAccess({
            requestId: prepared.prepared.requestId,
            recordId: prepared.prepared.recordId,
            granteeAddress: prepared.prepared.granteeAddress,
            purpose: prepared.prepared.purpose,
            durationDays: prepared.prepared.durationDays,
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async rejectRequest(requestId) {
      return runWithOperationOverlay(async () => {
        if (!session?.address) {
          throw new Error("Bạn cần đăng nhập patient bằng MetaMask trước.");
        }

        return applyState(await medchainService.rejectAccess({ requestId, patientAddress: session.address }));
      });
    },
    async togglePermission(permission) {
      return runWithOperationOverlay(async () => {
        if (permission.status === "Đang hiệu lực") {
          if (!session?.address) {
            throw new Error("Bạn cần đăng nhập patient bằng MetaMask trước.");
          }

          const prepared = await medchainService.prepareRevokeAccess({
            recordId: permission.recordId,
            granteeAddress: permission.granteeAddress,
          });
          const txResult = await contractService.revokeAccess({
            contractAddress: ensureContractReady(),
            contractRecordId: prepared.prepared.contractRecordId,
            granteeAddress: prepared.prepared.granteeAddress,
          });

          return applyState(
            await medchainService.commitRevokeAccess({
              recordId: prepared.prepared.recordId,
              granteeAddress: prepared.prepared.granteeAddress,
              txHash: txResult.txHash,
              blockNumber: txResult.blockNumber,
            }),
          );
        }

        if (!session?.address) {
          throw new Error("Bạn cần đăng nhập patient bằng MetaMask trước.");
        }

        const prepared = await medchainService.prepareGrantAccess({
          recordId: permission.recordId,
          granteeAddress: permission.granteeAddress,
          purpose: permission.purpose,
          durationDays: 7,
        });
        const txResult = await contractService.grantAccess({
          contractAddress: ensureContractReady(),
          contractRecordId: prepared.prepared.contractRecordId,
          granteeAddress: prepared.prepared.granteeAddress,
          expiredAtUnix: prepared.prepared.expiredAtUnix,
          purposeHash: prepared.prepared.purposeHash,
        });

        return applyState(
          await medchainService.commitGrantAccess({
            recordId: prepared.prepared.recordId,
            granteeAddress: prepared.prepared.granteeAddress,
            purpose: prepared.prepared.purpose,
            durationDays: prepared.prepared.durationDays,
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async checkAccess(payload) {
      return runWithOperationOverlay(async () => medchainService.checkAccess(payload));
    },
    async addUser(payload) {
      return runWithOperationOverlay(async () => {
        if (!session?.address || session.role !== "ADMIN") {
          throw new Error("Bạn cần đăng nhập admin bằng MetaMask trước.");
        }

        const txResult = await contractService.registerUser({
          contractAddress: ensureContractReady(),
          userAddress: payload.address,
          role: payload.role,
          attributes: payload.attributes,
        });

        return applyState(
          await medchainService.addUser({
            ...payload,
            actorAddress: session.address,
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async toggleUserStatus(address) {
      return runWithOperationOverlay(async () => {
        if (!session?.address || session.role !== "ADMIN") {
          throw new Error("Bạn cần đăng nhập admin bằng MetaMask trước.");
        }

        const user = appState.users.find((item) => item.address.toLowerCase() === String(address).toLowerCase());
        if (!user) {
          throw new Error("Không tìm thấy người dùng cần cập nhật trạng thái.");
        }

        const nextIsActive = user.status !== "Active";
        const txResult = await contractService.setUserStatus({
          contractAddress: ensureContractReady(),
          userAddress: user.address,
          isActive: nextIsActive,
        });

        return applyState(
          await medchainService.toggleUserStatus(user.address, {
            actorAddress: session.address,
            isActive: nextIsActive,
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async assignRole(address, roleName) {
      return runWithOperationOverlay(async () => {
        if (!session?.address || session.role !== "ADMIN") {
          throw new Error("Bạn cần đăng nhập admin bằng MetaMask trước.");
        }

        const user = appState.users.find((item) => item.address.toLowerCase() === String(address).toLowerCase());
        if (!user) {
          throw new Error("Không tìm thấy người dùng cần gán vai trò.");
        }

        const txResult = await contractService.registerUser({
          contractAddress: ensureContractReady(),
          userAddress: user.address,
          role: roleName,
          attributeHash: user.attributeHash || user.attributes || "",
        });

        return applyState(
          await medchainService.assignRole(user.address, {
            role: roleName,
            actorAddress: session.address,
            attributeHash: user.attributeHash || user.attributes || "",
            txHash: txResult.txHash,
            blockNumber: txResult.blockNumber,
          }),
        );
      });
    },
    async addPolicy(payload) {
      return runWithOperationOverlay(async () => applyState(await medchainService.addPolicy(payload)));
    },
    async updatePolicy(policyId, payload) {
      return runWithOperationOverlay(async () => applyState(await medchainService.updatePolicy(policyId, payload)));
    },
  };

  const patientAddress = role === "PATIENT" && session?.role === "PATIENT" ? session.address : "";
  const doctorAddress = role === "DOCTOR" && session?.role === "DOCTOR" ? session.address : "";
  const patientRecords = patientAddress
    ? appState.records.filter((record) => record.patientAddress.toLowerCase() === patientAddress.toLowerCase())
    : [];
  const doctorPermissions = doctorAddress
    ? appState.permissions.filter(
      (permission) =>
        permission.status === "Đang hiệu lực"
        && permission.granteeAddress.toLowerCase() === doctorAddress.toLowerCase(),
    )
    : [];
  const doctorRecordIds = new Set(doctorPermissions.map((permission) => permission.recordId));
  const doctorRecords = doctorAddress
    ? appState.records
      .filter((record) => doctorRecordIds.has(record.id))
      .map((record) => ({
        ...record,
        activePermission: doctorPermissions.find((permission) => permission.recordId === record.id) || null,
      }))
    : [];
  const doctorPendingRequests = doctorAddress
    ? appState.accessRequests.filter(
      (request) =>
        request.status === "PENDING"
        && request.requesterAddress.toLowerCase() === doctorAddress.toLowerCase(),
    )
    : [];
  const doctorPendingRequestIds = new Set(doctorPendingRequests.map((request) => request.recordId));
  const doctorRequestableRecords = doctorAddress
    ? appState.records.filter(
      (record) => !doctorRecordIds.has(record.id) && !doctorPendingRequestIds.has(record.id),
    )
    : [];
  const patientRecordIds = new Set(patientRecords.map((record) => record.id));
  const patientPermissions = appState.permissions.filter((permission) => patientRecordIds.has(permission.recordId));
  const patientRequests = appState.accessRequests.filter((request) => patientRecordIds.has(request.recordId));
  const visibleAuditLogs = role === "ADMIN"
    ? appState.auditLogs
    : session?.address
      ? appState.auditLogs.filter(
        (event) => event.actorAddress?.toLowerCase() === session.address.toLowerCase(),
      )
      : [];
  const auditScopeLabel = role === "ADMIN"
    ? "Toàn bộ hoạt động trong hệ thống"
    : "Những hoạt động do bạn trực tiếp thực hiện";
  const needsAuth = session?.role !== role;

  return (
    <AppShell
      role={role}
      onRoleChange={handleRoleChange}
      page={page}
      setPage={setPage}
      actors={sessionActors}
      session={session}
      onLogout={logout}
    >
      <>
        {bootstrapError ? <ActionNotice tone="error">{bootstrapError}</ActionNotice> : null}
        {needsAuth ? (
          <PublicKeyGate role={role} onLogin={actions.login} />
        ) : (
          renderPage(page, {
            setPage,
            users: appState.users,
            allRecords: appState.records,
            patientRecords,
            doctorRecords,
            doctorRequestableRecords,
            doctorPendingRequests,
            permissions: patientPermissions,
            accessRequests: patientRequests,
            policies: appState.policies,
            auditLogs: visibleAuditLogs,
            auditScopeLabel,
            systemStatus: appState.systemStatus,
            networkLabel: appState.networkLabel,
            contractReady,
            actors: sessionActors,
            patientRecordDetail,
            setPatientRecordDetail,
            actions,
          })
        )}
        <OperationOverlay phase={operationPhase} message={operationMessage} />
      </>
    </AppShell>
  );
}
