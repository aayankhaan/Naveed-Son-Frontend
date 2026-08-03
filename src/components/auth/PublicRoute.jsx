// ========================================
// PublicRoute.jsx
// Wraps a route meant only for signed-out visitors (the login page).
// Already-authenticated users are bounced to the Overview dashboard.
// ========================================

import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  return children;
}
