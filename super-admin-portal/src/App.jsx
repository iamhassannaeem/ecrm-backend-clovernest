import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import UsersPage from "./pages/UsersPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import RolesPage from './pages/RolesPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("superadmin_token"));

  // Listen for changes to localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem("superadmin_token"));
    };

    // Listen for storage events (when localStorage changes in other tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Check authentication status on mount
    const checkAuth = () => {
      const token = localStorage.getItem("superadmin_token");
      setIsAuthenticated(!!token);
    };

    checkAuth();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Function to update authentication state (can be called from LoginPage)
  const updateAuthState = (authenticated) => {
    setIsAuthenticated(authenticated);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={() => updateAuthState(true)} />} />
        <Route path="/organizations/:orgId/roles" element={<RolesPage />} />
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <DashboardLayout />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
