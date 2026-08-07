// ========================================
// AdminRoute.jsx
// Admin-only pages (bulk daily entry, payouts, etc.). Management is redirected.
// ========================================

import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

export default function AdminRoute({ children }) {
  return (
    <ProtectedRoute>
      <AdminOnly>{children}</AdminOnly>
    </ProtectedRoute>
  );
}

function AdminOnly({ children }) {
  const { canWrite } = useAuth();
  if (!canWrite) return <Navigate to="/overview" replace />;
  return children;
}
