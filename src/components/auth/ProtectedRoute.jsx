// ========================================
// ProtectedRoute.jsx
// Wraps a route that requires a logged-in user. Unauthenticated visitors
// are sent to /login, with the page they wanted preserved for after login.
// ========================================

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
