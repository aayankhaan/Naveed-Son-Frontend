// ========================================
// App.jsx
// Route table. Login is only reachable when signed out; every dashboard
// page requires an active session (see PublicRoute / ProtectedRoute).
// ========================================

import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import EmployeesPage from "./pages/Employees";
import OrdersPage from "./pages/Orders";
import CostingPage from "./pages/Costing";
import ForecastPage from "./pages/Forecast";
import DailyEntryPage from "./pages/DailyEntry";
import ReportsPage from "./pages/Reports";

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/overview" : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <Overview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-entry"
          element={
            <ProtectedRoute>
              <DailyEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/costing"
          element={
            <ProtectedRoute>
              <CostingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forecast"
          element={
            <ProtectedRoute>
              <ForecastPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </AuthProvider>
  );
}
