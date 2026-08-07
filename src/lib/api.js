export const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://naveedandsons.online";

const SESSION_KEY = "naveed-sons.session";

export function apiFetch(path, options = {}) {
  let session = null;
  try {
    session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  const headers = new Headers(options.headers);
  if (session?.token) headers.set("Authorization", `Bearer ${session.token}`);
  return fetch(`${API_BASE}${path}`, { ...options, headers }).then((response) => {
    if (response.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new Event("naveed-sons:unauthorized"));
    }
    return response;
  });
}

