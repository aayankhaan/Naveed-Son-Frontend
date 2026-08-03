// ========================================
// authApi.js
// Talks to the backend auth endpoint. Kept separate from AuthContext so the
// request logic and the session-state logic can change independently.
// ========================================

import { API_BASE } from "./api";

export async function loginRequest(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Try again.");
  }

  return data;
}
