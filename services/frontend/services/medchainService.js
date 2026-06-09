import { getJson, patchJson, postJson } from "./api";

export const medchainService = {
  getState() {
    return getJson("/state");
  },
  login(payload) {
    return postJson("/auth/login", payload);
  },
  prepareRecord(payload) {
    return postJson("/records/prepare", payload);
  },
  commitRecord(payload) {
    return postJson("/records/commit", payload);
  },
  prepareRequestAccess(payload) {
    return postJson("/access-requests/prepare", payload);
  },
  commitRequestAccess(payload) {
    return postJson("/access-requests/commit", payload);
  },
  prepareGrantAccess(payload) {
    return postJson("/access/grant/prepare", payload);
  },
  commitGrantAccess(payload) {
    return postJson("/access/grant/commit", payload);
  },
  rejectAccess(payload) {
    return postJson("/access/reject", payload);
  },
  prepareRevokeAccess(payload) {
    return postJson("/access/revoke/prepare", payload);
  },
  commitRevokeAccess(payload) {
    return postJson("/access/revoke/commit", payload);
  },
  checkAccess(payload) {
    return postJson("/access/check", payload);
  },
  addUser(payload) {
    return postJson("/users", payload);
  },
  toggleUserStatus(address, payload) {
    return patchJson(`/users/${encodeURIComponent(address)}/status`, payload);
  },
  assignRole(address, payload) {
    return patchJson(`/users/${encodeURIComponent(address)}/role`, payload);
  },
  addPolicy(payload) {
    return postJson("/policies", payload);
  },
  updatePolicy(id, payload) {
    return patchJson(`/policies/${encodeURIComponent(id)}`, payload);
  },
};
