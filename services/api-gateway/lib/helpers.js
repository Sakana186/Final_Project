import crypto from "node:crypto";

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function nowDisplay() {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date());
}

export function sha256Hex(value) {
  return `0x${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

export function buildId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

export function ensureAddress(value) {
  return String(value || "").trim();
}

export function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

export function toExpiry(days) {
  const amount = Number(days) > 0 ? Number(days) : 7;
  const expiresAt = new Date(Date.now() + amount * 24 * 60 * 60 * 1000);

  return {
    display: new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(expiresAt),
    unix: Math.floor(expiresAt.getTime() / 1000),
  };
}
