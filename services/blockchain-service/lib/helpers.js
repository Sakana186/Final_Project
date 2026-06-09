export function ensureAddress(value) {
  return String(value || "").trim();
}

export function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

export function resolveRoleValue(roleValue) {
  const role = normalizeRole(roleValue);
  const map = {
    PATIENT: 1,
    DOCTOR: 2,
    ADMIN: 3,
  };

  return map[role] ?? 0;
}

