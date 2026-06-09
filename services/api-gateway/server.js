import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./lib/store.js";
import { buildId, clone, ensureAddress, normalizeRole, nowDisplay, sha256Hex, toExpiry } from "./lib/helpers.js";
import { loadMedchainEnv } from "./lib/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envConfig = loadMedchainEnv(__dirname);
const store = createStore(path.join(__dirname, "data", "state.json"));

async function requestService(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || `Service call failed: ${url}`);
  }

  return data;
}

function getServiceJson(baseUrl, pathname) {
  return requestService(`${baseUrl}${pathname}`);
}

function postServiceJson(baseUrl, pathname, body) {
  return requestService(`${baseUrl}${pathname}`, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}

function patchServiceJson(baseUrl, pathname, body) {
  return requestService(`${baseUrl}${pathname}`, {
    method: "PATCH",
    body: JSON.stringify(body || {}),
  });
}

async function fetchBlockchainSnapshot() {
  return getServiceJson(envConfig.blockchainServiceUrl, "/status");
}

async function fetchBlockchainUsers() {
  const response = await getServiceJson(envConfig.blockchainServiceUrl, "/users");
  return response.users || [];
}

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

function buildSystemState(state, users = state.users || [], blockchainSnapshot = null, storageStatus = "OK") {
  const activeUsers = users.filter((user) => user.status === "Active");
  const runtimeState = {
    ...state,
    users: activeUsers,
  };
  const blockchainStatus = blockchainSnapshot?.systemStatus || [
    ["Blockchain Service", "ERROR: Chưa kết nối"],
    ["RPC Provider", "ERROR: Chưa cấu hình"],
    ["Network", "ERROR: Chưa có dữ liệu"],
    ["Smart Contract", "ERROR: Chưa có dữ liệu"],
  ];
  const contract = blockchainSnapshot?.contract || {
    ready: false,
    address: "",
    deployment: null,
  };
  const networkLabel = blockchainSnapshot?.networkLabel || "N/A";

  return {
    users: activeUsers,
    records: state.records,
    permissions: state.permissions,
    accessRequests: state.accessRequests.filter((item) => item.status === "PENDING"),
    policies: state.policies,
    auditLogs: [...normalizeAuditLogs(runtimeState)].reverse(),
    systemStatus: [
      ["Gateway API", "OK"],
      ["Storage Service", storageStatus],
      ...blockchainStatus,
    ],
    networkLabel,
    contract,
    actors: clone(envConfig.actors),
  };
}

function normalizeProfileName(value) {
  return String(value || "").trim();
}

function buildAuditActor(address, role, name) {
  return {
    actorAddress: ensureAddress(address),
    actorRole: normalizeRole(role),
    actorName: normalizeProfileName(name),
  };
}

function mergeUsersWithProfiles(users, userProfiles = {}) {
  return users.map((user) => {
    const displayName = normalizeProfileName(userProfiles[user.address.toLowerCase()]);
    if (!displayName) {
      return user;
    }

    return {
      ...user,
      displayName,
      name: displayName,
    };
  });
}

function filterActiveUsers(users = []) {
  return users.filter((user) => user.status === "Active");
}

function resolveRecordForAudit(state, auditLog) {
  if (auditLog.recordId) {
    return findRecordByBusinessId(state, auditLog.recordId);
  }

  if (auditLog.txHash) {
    return state.records.find((record) => record.txHash === auditLog.txHash);
  }

  return null;
}

function resolveRequestForAudit(state, auditLog) {
  if (auditLog.txHash) {
    const matchedByTx = state.accessRequests.find((request) => request.txHash === auditLog.txHash);
    if (matchedByTx) {
      return matchedByTx;
    }
  }

  if (auditLog.recordId) {
    const matchedByRecord = state.accessRequests.find((request) => request.recordId === auditLog.recordId);
    if (matchedByRecord) {
      return matchedByRecord;
    }
  }

  return null;
}

function inferAuditActor(state, auditLog) {
  if (auditLog.actorAddress || auditLog.actorRole || auditLog.actorName) {
    return buildAuditActor(auditLog.actorAddress, auditLog.actorRole, auditLog.actorName);
  }

  if (["UserRegistered", "UserStatusUpdated", "RoleAssigned", "PolicyCreated", "PolicyUpdated"].includes(auditLog.event)) {
    return buildAuditActor(envConfig.actors.ADMIN.address, "ADMIN", envConfig.actors.ADMIN.name);
  }

  if (auditLog.event === "RecordAdded") {
    const record = resolveRecordForAudit(state, auditLog);
    return buildAuditActor(record?.creatorAddress, "DOCTOR", record?.creator);
  }

  if (auditLog.event === "AccessRequested") {
    const request = resolveRequestForAudit(state, auditLog);
    return buildAuditActor(request?.requesterAddress, request?.requesterRole || "DOCTOR", request?.requesterName);
  }

  if (["AccessGranted", "AccessRevoked", "AccessRejected"].includes(auditLog.event)) {
    const record = resolveRecordForAudit(state, auditLog);
    const patient = record
      ? findUserByAddress(state, record.patientAddress) || {
        address: record.patientAddress,
        role: "PATIENT",
        name: record.patient,
      }
      : null;

    return buildAuditActor(patient?.address, patient?.role || "PATIENT", patient?.name);
  }

  return buildAuditActor("", "", "");
}

function normalizeAuditLogs(state) {
  return (state.auditLogs || []).map((auditLog) => ({
    ...auditLog,
    ...inferAuditActor(state, auditLog),
  }));
}

async function readRuntimeState() {
  const state = store.read();
  state.userProfiles ||= {};
  state.users = filterActiveUsers(mergeUsersWithProfiles(await fetchBlockchainUsers(), state.userProfiles));
  state.auditLogs = normalizeAuditLogs(state);
  return state;
}

function appendAudit(state, event, description, extra = {}) {
  state.auditLogs.push({
    id: buildId("audit"),
    event,
    description,
    time: nowDisplay(),
    ...extra,
  });
}

function findUserByAddress(state, address) {
  const normalized = ensureAddress(address).toLowerCase();
  return state.users.find((user) => user.address.toLowerCase() === normalized);
}

function findRecordByBusinessId(state, recordId) {
  return state.records.find((record) => record.id === recordId);
}

function resolveAdminActor(state, actorAddress = "") {
  const matched = actorAddress ? findUserByAddress(state, actorAddress) : null;

  return {
    address: matched?.address || ensureAddress(actorAddress),
    role: "ADMIN",
    name: matched?.name || envConfig.actors.ADMIN.name,
  };
}

async function handlePrepareRecord(body) {
  const state = await readRuntimeState();
  const patientAddress = ensureAddress(body.patientAddress);
  const doctorAddress = ensureAddress(body.creatorAddress);
  const patientUser = findUserByAddress(state, patientAddress);
  const doctorUser = findUserByAddress(state, doctorAddress);

  if (!patientAddress || !doctorAddress) {
    throw new Error("Thiếu địa chỉ patient hoặc doctor cho giao dịch.");
  }

  if (!patientUser) {
    throw new Error("Patient chưa được đăng ký trong MedChain.");
  }

  if (!doctorUser || doctorUser.role !== "DOCTOR") {
    throw new Error("Doctor chưa được đăng ký đúng vai trò trong MedChain.");
  }

  if (doctorUser.status !== "Active") {
    throw new Error("Doctor hiện đang bị vô hiệu hoá trên blockchain.");
  }

  const recordDraft = {
    id: body.id,
    patientAddress,
    doctorAddress,
    birthday: body.birthday || "",
    gender: body.gender || "",
    diagnosis: body.diagnosis || "",
    lab: body.lab || "",
    treatment: body.treatment || "",
    note: body.note || "",
    policy: body.policy || "",
  };
  const recordHash = sha256Hex(
    JSON.stringify({
      id: body.id,
      patientAddress,
      diagnosis: body.diagnosis,
      lab: body.lab,
      treatment: body.treatment,
      note: body.note,
      policy: body.policy,
    }),
  );
  const uploadResult = await postServiceJson(envConfig.storageServiceUrl, "/seal-record", {
    record: recordDraft,
    recordHash,
  });

  return {
    message: `Đã chuẩn bị giao dịch tạo hồ sơ ${body.id || "mới"}.`,
    prepared: {
      patientAddress,
      doctorAddress,
      recordHash,
      policyHash: sha256Hex(body.policy || ""),
      patientName: patientUser.name,
      doctorName: doctorUser.name,
      cid: uploadResult.cid,
      gatewayUrl: uploadResult.gatewayUrl,
    },
  };
}

async function handleCommitRecord(body) {
  const state = await readRuntimeState();
  const patientAddress = ensureAddress(body.patientAddress);
  const doctorAddress = ensureAddress(body.creatorAddress);
  const patientUser = findUserByAddress(state, patientAddress);
  const doctorUser = findUserByAddress(state, doctorAddress);

  if (!patientUser || !doctorUser) {
    throw new Error("Không tìm thấy patient hoặc doctor để ghi nhận giao dịch hồ sơ.");
  }

  if (!body.contractRecordId && body.contractRecordId !== 0) {
    throw new Error("Thiếu contractRecordId sau khi ghi on-chain.");
  }

  if (!body.txHash) {
    throw new Error("Thiếu txHash để ghi nhận giao dịch hồ sơ.");
  }

  const nextState = store.read();
  const newRecord = {
    id: body.id,
    contractRecordId: Number(body.contractRecordId),
    patient: patientUser.name,
    patientAddress,
    birthday: body.birthday || "",
    gender: body.gender || "",
    creator: doctorUser.name,
    creatorAddress: doctorAddress,
    diagnosis: body.diagnosis || "",
    lab: body.lab || "",
    treatment: body.treatment || "",
    note: body.note || "",
    policy: body.policy || "",
    cid: body.cid,
    recordHash: body.recordHash,
    policyHash: body.policyHash,
    txHash: body.txHash,
    block: String(body.blockNumber || ""),
    createdAt: nowDisplay(),
    status: "Đã ghi on-chain",
    owner: "PATIENT",
  };

  nextState.records.unshift(newRecord);
  nextState.permissions.unshift({
    id: buildId("perm"),
    recordId: newRecord.id,
    contractRecordId: newRecord.contractRecordId,
    granteeName: doctorUser.name,
    granteeAddress: doctorAddress,
    role: doctorUser.role,
    purpose: "Tạo và điều trị hồ sơ",
    purposeHash: sha256Hex("Tạo và điều trị hồ sơ"),
    expiredAt: "Không giới hạn",
    expiredAtUnix: Number.MAX_SAFE_INTEGER,
    status: "Đang hiệu lực",
    grantedBy: patientUser.name,
    grantedAt: nowDisplay(),
    txHash: newRecord.txHash,
  });
  appendAudit(nextState, "RecordAdded", `${doctorUser.name} tạo hồ sơ ${newRecord.id}`, {
    recordId: newRecord.id,
    txHash: newRecord.txHash,
    ...buildAuditActor(doctorAddress, doctorUser.role, doctorUser.name),
  });
  store.write(nextState);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã ghi nhận hồ sơ ${newRecord.id} sau khi giao dịch on-chain thành công.`,
    record: newRecord,
    state: buildSystemState(nextState, state.users, blockchainSnapshot, "OK"),
  };
}

async function handlePrepareRequestAccess(body) {
  const state = await readRuntimeState();
  const record = findRecordByBusinessId(state, body.recordId);
  const requesterAddress = ensureAddress(body.requesterAddress);
  const requester = findUserByAddress(state, requesterAddress);

  if (!record) {
    throw new Error("Không tìm thấy record cần yêu cầu truy cập.");
  }

  if (!requester || requester.role !== "DOCTOR") {
    throw new Error("Requester chưa được đăng ký đúng vai trò DOCTOR.");
  }

  if (requester.status !== "Active") {
    throw new Error("Doctor hiện đang bị vô hiệu hoá trên blockchain.");
  }

  const expiry = toExpiry(body.durationDays || 7);
  const purposeHash = sha256Hex(body.purpose || "");

  return {
    message: `Đã chuẩn bị giao dịch yêu cầu truy cập cho hồ sơ ${record.id}.`,
    prepared: {
      recordId: record.id,
      contractRecordId: record.contractRecordId,
      requesterAddress,
      purpose: body.purpose || "",
      purposeHash,
      durationDays: Number(body.durationDays) || 7,
      expiredAtUnix: expiry.unix,
    },
  };
}

async function handleCommitRequestAccess(body) {
  const state = await readRuntimeState();
  const record = findRecordByBusinessId(state, body.recordId);
  const requesterAddress = ensureAddress(body.requesterAddress);
  const requester = findUserByAddress(state, requesterAddress);

  if (!record || !requester) {
    throw new Error("Không tìm thấy record hoặc requester để ghi nhận yêu cầu truy cập.");
  }

  const nextState = store.read();
  const request = {
    id: buildId("req"),
    recordId: record.id,
    contractRecordId: record.contractRecordId,
    requesterName: requester.name,
    requesterAddress,
    requesterRole: requester.role,
    purpose: body.purpose || "",
    durationDays: Number(body.durationDays) || 7,
    requestedAt: nowDisplay(),
    status: "PENDING",
    txHash: body.txHash,
  };

  nextState.accessRequests.unshift(request);
  appendAudit(nextState, "AccessRequested", `${requester.name} yêu cầu truy cập hồ sơ ${record.id}`, {
    recordId: record.id,
    txHash: request.txHash,
    ...buildAuditActor(requesterAddress, requester.role, requester.name),
  });
  store.write(nextState);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã ghi nhận yêu cầu truy cập cho hồ sơ ${record.id}.`,
    request,
    state: buildSystemState(nextState, state.users, blockchainSnapshot, "OK"),
  };
}

async function handlePrepareGrantAccess(body) {
  const state = await readRuntimeState();
  const request = body.requestId ? state.accessRequests.find((item) => item.id === body.requestId) : null;
  const record = findRecordByBusinessId(state, body.recordId || request?.recordId);
  const granteeAddress = ensureAddress(body.granteeAddress || request?.requesterAddress);
  const grantee = findUserByAddress(state, granteeAddress);

  if (!record || !grantee) {
    throw new Error("Không tìm thấy record hoặc grantee để cấp quyền.");
  }

  const expiry = toExpiry(body.durationDays || request?.durationDays || 7);
  const purpose = body.purpose || request?.purpose || "";
  const purposeHash = sha256Hex(purpose);

  return {
    message: `Đã chuẩn bị giao dịch cấp quyền cho ${grantee.name}.`,
    prepared: {
      requestId: request?.id || "",
      recordId: record.id,
      contractRecordId: record.contractRecordId,
      granteeAddress,
      purpose,
      purposeHash,
      durationDays: Number(body.durationDays || request?.durationDays || 7),
      expiredAtUnix: expiry.unix,
    },
  };
}

async function handleCommitGrantAccess(body) {
  const state = await readRuntimeState();
  const request = body.requestId ? state.accessRequests.find((item) => item.id === body.requestId) : null;
  const record = findRecordByBusinessId(state, body.recordId || request?.recordId);
  const granteeAddress = ensureAddress(body.granteeAddress || request?.requesterAddress);
  const grantee = findUserByAddress(state, granteeAddress);

  if (!record || !grantee) {
    throw new Error("Không tìm thấy record hoặc grantee để ghi nhận cấp quyền.");
  }

  const expiry = toExpiry(body.durationDays || request?.durationDays || 7);
  const purpose = body.purpose || request?.purpose || "";
  const purposeHash = sha256Hex(purpose);
  const nextState = store.read();
  const permission =
    nextState.permissions.find(
      (item) =>
        item.recordId === record.id &&
        item.granteeAddress.toLowerCase() === granteeAddress.toLowerCase(),
    ) || {
      id: buildId("perm"),
      recordId: record.id,
      contractRecordId: record.contractRecordId,
      granteeName: grantee.name,
      granteeAddress,
      role: grantee.role,
      grantedBy: state.users.find((user) => user.address.toLowerCase() === record.patientAddress.toLowerCase())?.name || "Patient",
      grantedAt: nowDisplay(),
    };

  Object.assign(permission, {
    purpose,
    purposeHash,
    expiredAt: expiry.display,
    expiredAtUnix: expiry.unix,
    status: "Đang hiệu lực",
    txHash: body.txHash,
  });

  if (!nextState.permissions.find((item) => item.id === permission.id)) {
    nextState.permissions.unshift(permission);
  }

  if (request) {
    const currentRequest = nextState.accessRequests.find((item) => item.id === request.id);
    if (currentRequest) {
      currentRequest.status = "APPROVED";
    }
  }

  const patientActor = findUserByAddress(state, record.patientAddress) || {
    address: record.patientAddress,
    role: "PATIENT",
    name: record.patient,
  };

  appendAudit(nextState, "AccessGranted", `${permission.grantedBy} cấp quyền cho ${grantee.name}`, {
    recordId: record.id,
    txHash: body.txHash,
    ...buildAuditActor(patientActor.address, patientActor.role, patientActor.name),
  });
  store.write(nextState);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã ghi nhận cấp quyền cho ${grantee.name}.`,
    state: buildSystemState(nextState, state.users, blockchainSnapshot, "OK"),
  };
}

async function handleRejectAccess(body) {
  const state = await readRuntimeState();
  const nextState = store.read();
  nextState.userProfiles ||= {};
  const request = nextState.accessRequests.find((item) => item.id === body.requestId);

  if (!request) {
    throw new Error("Không tìm thấy yêu cầu cần từ chối.");
  }

  const record = findRecordByBusinessId(state, request.recordId);
  const patientAddress = ensureAddress(body.patientAddress) || record?.patientAddress;
  const patientActor = findUserByAddress(state, patientAddress) || {
    address: patientAddress,
    role: "PATIENT",
    name: record?.patient || "Patient",
  };

  request.status = "REJECTED";
  appendAudit(nextState, "AccessRejected", `${patientActor.name} từ chối yêu cầu của ${request.requesterName}`, {
    recordId: request.recordId,
    ...buildAuditActor(patientActor.address, patientActor.role, patientActor.name),
  });
  store.write(nextState);
  const users = mergeUsersWithProfiles(await fetchBlockchainUsers(), nextState.userProfiles);

  return {
    message: `Đã từ chối yêu cầu của ${request.requesterName}.`,
    state: buildSystemState(nextState, users),
  };
}

async function handlePrepareRevokeAccess(body) {
  const state = await readRuntimeState();
  const record = findRecordByBusinessId(state, body.recordId);
  const permission = state.permissions.find(
    (item) =>
      item.recordId === body.recordId &&
      item.granteeAddress.toLowerCase() === ensureAddress(body.granteeAddress).toLowerCase(),
  );

  if (!record || !permission) {
    throw new Error("Không tìm thấy quyền cần thu hồi.");
  }

  return {
    message: `Đã chuẩn bị giao dịch thu hồi quyền của ${permission.granteeName}.`,
    prepared: {
      recordId: record.id,
      contractRecordId: record.contractRecordId,
      granteeAddress: permission.granteeAddress,
    },
  };
}

async function handleCommitRevokeAccess(body) {
  const state = await readRuntimeState();
  const record = findRecordByBusinessId(state, body.recordId);
  const permission = state.permissions.find(
    (item) =>
      item.recordId === body.recordId &&
      item.granteeAddress.toLowerCase() === ensureAddress(body.granteeAddress).toLowerCase(),
  );

  if (!record || !permission) {
    throw new Error("Không tìm thấy quyền cần ghi nhận thu hồi.");
  }

  const nextState = store.read();
  const nextPermission = nextState.permissions.find((item) => item.id === permission.id);
  if (nextPermission) {
    nextPermission.status = "Đã thu hồi";
    nextPermission.txHash = body.txHash;
  }

  const patientActor = findUserByAddress(state, record.patientAddress) || {
    address: record.patientAddress,
    role: "PATIENT",
    name: record.patient,
  };

  appendAudit(
    nextState,
    "AccessRevoked",
    `${patientActor.name} thu hồi quyền của ${permission.granteeName}`,
    {
      recordId: record.id,
      txHash: body.txHash,
      ...buildAuditActor(patientActor.address, patientActor.role, patientActor.name),
    },
  );
  store.write(nextState);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã ghi nhận thu hồi quyền của ${permission.granteeName}.`,
    state: buildSystemState(nextState, state.users, blockchainSnapshot, "OK"),
  };
}

async function handleCheckAccess(body) {
  const state = await readRuntimeState();
  const record = findRecordByBusinessId(state, body.recordId);

  if (!record) {
    throw new Error("Không tìm thấy hồ sơ để kiểm tra quyền.");
  }

  const result = await postServiceJson(envConfig.blockchainServiceUrl, "/access/check", {
    contractRecordId: record.contractRecordId,
    userAddress: ensureAddress(body.userAddress),
  });

  return {
    hasAccess: Boolean(result.hasAccess),
    message: result.hasAccess
      ? `Địa chỉ ${body.userAddress} có quyền với hồ sơ ${record.id}.`
      : `Địa chỉ ${body.userAddress} chưa có quyền với hồ sơ ${record.id}.`,
  };
}

async function handleLogin(body) {
  const address = ensureAddress(body.address);
  const role = normalizeRole(body.role);

  if (!address || !role) {
    throw new Error("Thiếu public key hoặc role để đăng nhập.");
  }

  return postServiceJson(envConfig.blockchainServiceUrl, "/auth/login", { address, role });
}

async function handleAddUser(body) {
  const state = await readRuntimeState();
  const address = ensureAddress(body.address);
  const role = normalizeRole(body.role);
  const displayName = normalizeProfileName(body.displayName);
  const adminActor = resolveAdminActor(state, body.actorAddress);

  if (!address || !role) {
    throw new Error("Thiếu address hoặc role để đăng ký user.");
  }

  const existingUser = findUserByAddress(state, address);
  if (existingUser && !body.txHash) {
    throw new Error(
      `Địa chỉ ví này đã được đăng ký với vai trò ${existingUser.role}. Nếu muốn đổi vai trò, hãy dùng mục Gán vai trò on-chain.`,
    );
  }

  const newUser = {
    address,
    role,
    name: displayName || existingUser?.name || `${role} ${address.slice(0, 6)}...${address.slice(-4)}`,
    attributes: body.attributes || existingUser?.attributes || "",
    attributeHash: sha256Hex(body.attributes || existingUser?.attributes || ""),
    status: existingUser?.status || "Active",
  };

  const contractResult = body.txHash
    ? {
        txHash: body.txHash,
        blockNumber: Number(body.blockNumber || 0),
      }
    : await postServiceJson(envConfig.blockchainServiceUrl, "/users", newUser);
  const nextState = store.read();
  nextState.userProfiles ||= {};
  if (displayName) {
    nextState.userProfiles[address.toLowerCase()] = displayName;
  }
  appendAudit(nextState, "UserRegistered", `${adminActor.name} đăng ký ${newUser.name} với role ${newUser.role}`, {
    txHash: contractResult.txHash,
    ...buildAuditActor(adminActor.address, adminActor.role, adminActor.name),
  });
  store.write(nextState);
  const users = mergeUsersWithProfiles(await fetchBlockchainUsers(), nextState.userProfiles);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã thêm ${newUser.name} vào hệ thống.`,
    state: buildSystemState(nextState, users, blockchainSnapshot, "OK"),
  };
}

async function handleToggleUserStatus(address, body) {
  const state = await readRuntimeState();
  const user = findUserByAddress(state, address);
  const adminActor = resolveAdminActor(state, body.actorAddress);

  if (!user) {
    throw new Error("Không tìm thấy người dùng cần cập nhật trạng thái.");
  }

  const nextIsActive = typeof body.isActive === "boolean" ? body.isActive : user.status !== "Active";
  const nextStatus = nextIsActive ? "Active" : "Disabled";
  const contractResult = body.txHash
    ? {
        txHash: body.txHash,
        blockNumber: Number(body.blockNumber || 0),
      }
    : await patchServiceJson(
        envConfig.blockchainServiceUrl,
        `/users/${encodeURIComponent(user.address)}/status`,
        { isActive: nextIsActive },
      );

  const nextState = store.read();
  nextState.userProfiles ||= {};
  const nextUser = findUserByAddress(state, address) || user;
  if (!nextIsActive) {
    delete nextState.userProfiles[user.address.toLowerCase()];
  }
  appendAudit(nextState, "UserStatusUpdated", `${adminActor.name} cập nhật trạng thái ${nextUser.name} thành ${nextStatus}`, {
    txHash: contractResult.txHash,
    ...buildAuditActor(adminActor.address, adminActor.role, adminActor.name),
  });
  store.write(nextState);
  const users = mergeUsersWithProfiles(await fetchBlockchainUsers(), nextState.userProfiles);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: nextStatus === "Active" ? `Đã kích hoạt lại ${nextUser.name}.` : `Đã xoá ${nextUser.name} khỏi danh sách người dùng.`,
    state: buildSystemState(nextState, users, blockchainSnapshot, "OK"),
  };
}

async function handleAssignRole(address, body) {
  const state = await readRuntimeState();
  const user = findUserByAddress(state, address);
  const adminActor = resolveAdminActor(state, body.actorAddress);

  if (!user) {
    throw new Error("Không tìm thấy user để gán role.");
  }

  const nextRole = normalizeRole(body.role);
  const contractResult = body.txHash
    ? {
        txHash: body.txHash,
        blockNumber: Number(body.blockNumber || 0),
      }
    : await postServiceJson(envConfig.blockchainServiceUrl, "/users", {
        address: user.address,
        role: nextRole,
        attributeHash: body.attributeHash || user.attributeHash || user.attributes || "",
      });

  const nextState = store.read();
  const nextUser = findUserByAddress(state, address) || user;
  appendAudit(nextState, "RoleAssigned", `${adminActor.name} gán role ${nextRole} cho ${nextUser.name}`, {
    txHash: contractResult.txHash,
    ...buildAuditActor(adminActor.address, adminActor.role, adminActor.name),
  });
  store.write(nextState);
  const users = mergeUsersWithProfiles(await fetchBlockchainUsers(), nextState.userProfiles);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã cập nhật ${nextUser.name} sang vai trò ${nextRole}.`,
    state: buildSystemState(nextState, users, blockchainSnapshot, "OK"),
  };
}

async function handleAddPolicy(body) {
  const nextState = store.read();
  nextState.userProfiles ||= {};
  const raw = String(body.raw || "").trim();
  const name = String(body.name || "").trim();

  if (!name || !raw) {
    throw new Error("Thiếu tên hoặc biểu thức policy.");
  }

  const newPolicy = {
    id: buildId("policy"),
    name,
    raw,
    hash: sha256Hex(raw),
    status: "Active",
  };

  nextState.policies.unshift(newPolicy);
  appendAudit(nextState, "PolicyCreated", `${envConfig.actors.ADMIN.name} tạo policy ${newPolicy.name}`, {
    ...buildAuditActor(envConfig.actors.ADMIN.address, "ADMIN", envConfig.actors.ADMIN.name),
  });
  store.write(nextState);
  const users = mergeUsersWithProfiles(await fetchBlockchainUsers(), nextState.userProfiles);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã thêm ${newPolicy.name}.`,
    state: buildSystemState(nextState, users, blockchainSnapshot, "OK"),
  };
}

async function handleUpdatePolicy(policyId, body) {
  const nextState = store.read();
  nextState.userProfiles ||= {};
  const policy = nextState.policies.find((item) => item.id === policyId);

  if (!policy) {
    throw new Error("Không tìm thấy policy cần cập nhật.");
  }

  policy.name = String(body.name || policy.name).trim();
  policy.raw = String(body.raw || policy.raw).trim();
  policy.hash = sha256Hex(policy.raw);
  appendAudit(nextState, "PolicyUpdated", `${envConfig.actors.ADMIN.name} cập nhật policy ${policy.name}`, {
    ...buildAuditActor(envConfig.actors.ADMIN.address, "ADMIN", envConfig.actors.ADMIN.name),
  });
  store.write(nextState);
  const users = mergeUsersWithProfiles(await fetchBlockchainUsers(), nextState.userProfiles);
  const blockchainSnapshot = await fetchBlockchainSnapshot();

  return {
    message: `Đã cập nhật ${policy.name}.`,
    state: buildSystemState(nextState, users, blockchainSnapshot, "OK"),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    const pathname = getPathname(req);

    if (req.method === "GET" && pathname === "/api/health") {
      const blockchainSnapshot = await fetchBlockchainSnapshot();
      const storageHealth = await getServiceJson(envConfig.storageServiceUrl, "/health");
      sendJson(res, 200, {
        ok: true,
        systemStatus: [["Gateway API", "OK"], ["Storage Service", storageHealth.status || "OK"], ...blockchainSnapshot.systemStatus],
        contract: blockchainSnapshot.contract,
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/state") {
      const state = await readRuntimeState();
      const blockchainSnapshot = await fetchBlockchainSnapshot();
      const storageHealth = await getServiceJson(envConfig.storageServiceUrl, "/health");
      sendJson(res, 200, buildSystemState(state, state.users, blockchainSnapshot, storageHealth.status || "OK"));
      return;
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      sendJson(res, 200, await handleLogin(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/records/prepare") {
      sendJson(res, 200, await handlePrepareRecord(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/records/commit") {
      sendJson(res, 200, await handleCommitRecord(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access-requests/prepare") {
      sendJson(res, 200, await handlePrepareRequestAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access-requests/commit") {
      sendJson(res, 200, await handleCommitRequestAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access/grant/prepare") {
      sendJson(res, 200, await handlePrepareGrantAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access/grant/commit") {
      sendJson(res, 200, await handleCommitGrantAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access/reject") {
      sendJson(res, 200, await handleRejectAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access/revoke/prepare") {
      sendJson(res, 200, await handlePrepareRevokeAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access/revoke/commit") {
      sendJson(res, 200, await handleCommitRevokeAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/access/check") {
      sendJson(res, 200, await handleCheckAccess(await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/users") {
      sendJson(res, 200, await handleAddUser(await parseBody(req)));
      return;
    }

    const statusMatch = pathname.match(/^\/api\/users\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      sendJson(res, 200, await handleToggleUserStatus(decodeURIComponent(statusMatch[1]), await parseBody(req)));
      return;
    }

    const roleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
    if (req.method === "PATCH" && roleMatch) {
      sendJson(res, 200, await handleAssignRole(decodeURIComponent(roleMatch[1]), await parseBody(req)));
      return;
    }

    if (req.method === "POST" && pathname === "/api/policies") {
      sendJson(res, 200, await handleAddPolicy(await parseBody(req)));
      return;
    }

    const policyMatch = pathname.match(/^\/api\/policies\/([^/]+)$/);
    if (req.method === "PATCH" && policyMatch) {
      sendJson(res, 200, await handleUpdatePolicy(decodeURIComponent(policyMatch[1]), await parseBody(req)));
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Unknown error" });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `MedChain gateway không khởi động được vì cổng ${envConfig.backendPort} đang được dùng. Hãy đổi MEDCHAIN_GATEWAY_PORT trong services/api-gateway/.env.`,
    );
    return;
  }

  if (error.code === "EPERM") {
    console.error(
      `MedChain gateway không bind được vào ${envConfig.backendHost}:${envConfig.backendPort}. Hãy đổi MEDCHAIN_GATEWAY_HOST hoặc MEDCHAIN_GATEWAY_PORT trong services/api-gateway/.env.`,
    );
    return;
  }

  console.error(error);
});

server.listen(envConfig.backendPort, envConfig.backendHost, () => {
  console.log(`MedChain API gateway listening on http://${envConfig.backendHost}:${envConfig.backendPort}`);
});
