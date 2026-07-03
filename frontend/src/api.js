async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return body;
}

export const api = {
  state: () => request("/api/state"),
  approve: (stageId, payload = {}) =>
    request(`/api/stage/${stageId}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  skip: (stageId) => request(`/api/stage/${stageId}/skip`, { method: "POST" }),
  reject: (stageId) => request(`/api/stage/${stageId}/reject`, { method: "POST" }),
  previewEdit: (payload) =>
    request("/api/edit/preview", { method: "POST", body: JSON.stringify(payload) }),
  reset: () => request("/api/reset", { method: "POST" }),
};

export const gbp = (value, digits = 0) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: digits,
  }).format(value);

export const num = (value) => new Intl.NumberFormat("en-GB").format(value);

export const pct = (value, digits = 2) => `${(value * 100).toFixed(digits)}%`;
