export const initialAppState = {
  users: [],
  records: [],
  permissions: [],
  accessRequests: [],
  policies: [],
  auditLogs: [],
  systemStatus: [
    ["Gateway API", "ERROR: Chưa kết nối"],
    ["Blockchain Service", "ERROR: Chưa kiểm tra"],
    ["Network", "ERROR: Chưa cấu hình network"],
    ["Smart Contract", "ERROR: Chưa deploy contract"],
  ],
  networkLabel: "N/A",
  contract: {
    ready: false,
    address: "",
    deployment: null,
  },
  actors: {
    PATIENT: {
      name: "Patient Session",
      address: "",
    },
    DOCTOR: {
      name: "Doctor Session",
      address: "",
    },
    ADMIN: {
      name: "Admin Session",
      address: "",
    },
  },
};
