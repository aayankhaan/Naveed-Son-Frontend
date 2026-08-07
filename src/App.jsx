// ========================================
// App.jsx
// Route table. Login is only reachable when signed out; every dashboard
// page requires an active session (see PublicRoute / ProtectedRoute).
// ========================================

import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeScope } from "./context/ThemeContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import AdminRoute from "./components/auth/AdminRoute";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import EmployeesPage from "./pages/Employees";
import OrdersPage from "./pages/Orders";
import CostingPage from "./pages/Costing";
import ForecastPage from "./pages/Forecast";
import DailyEntryPage from "./pages/DailyEntry";
import ShipmentPage from "./pages/Shipment";
import SecurityHistoryPage from "./pages/SecurityHistory";
import DailyExpensesPage from "./pages/DailyExpenses";
import PayoutsPage from "./pages/Payouts";

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/overview" : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeScope>
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
          path="/payouts"
          element={
            <AdminRoute>
              <PayoutsPage />
            </AdminRoute>
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
          path="/shipment"
          element={
            <ProtectedRoute>
              <ShipmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/security"
          element={
            <ProtectedRoute>
              <SecurityHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <DailyExpensesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-entry"
          element={
            <AdminRoute>
              <DailyEntryPage />
            </AdminRoute>
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
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </ThemeScope>
    </AuthProvider>
  );
}
