export const API_BASE_URL = import.meta.env.VITE_MEDCHAIN_API_URL || "http://localhost:4001/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || "Yêu cầu thất bại.");
  }

  return data;
}

export function getJson(path) {
  return request(path);
}

export function postJson(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body || {}),
  });
}

export function patchJson(path, body) {
  return request(path, {
    method: "PATCH",
    body: JSON.stringify(body || {}),
  });
}
