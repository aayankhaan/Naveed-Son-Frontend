// ========================================
// AuthContext.jsx
// Holds the current auth session in memory (restored from localStorage on
// load) and exposes login/logout so any page can read or change it.
// ========================================

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest } from "../lib/authApi";

const SESSION_KEY = "naveed-sons.session";
const AuthContext = createContext(null);

function normalizeRole(role) {
  const r = String(role || "admin").toLowerCase();
  return r === "management" ? "management" : "admin";
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return {
      username: parsed.username || "admin",
      token: parsed.token,
      role: normalizeRole(parsed.role),
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredSession);

  const login = async (username, password) => {
    const data = await loginRequest(username, password);
    const session = {
      username: data.username || username,
      token: data.token,
      role: normalizeRole(data.role),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  useEffect(() => {
    const clearSession = () => setUser(null);
    window.addEventListener("naveed-sons:unauthorized", clearSession);
    return () => window.removeEventListener("naveed-sons:unauthorized", clearSession);
  }, []);

  const role = normalizeRole(user?.role);
  const isAdmin = role === "admin";
  const canWrite = isAdmin;

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin,
      canWrite,
      isAuthenticated: Boolean(user?.token),
      login,
      logout,
    }),
    [user, role, isAdmin, canWrite]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
