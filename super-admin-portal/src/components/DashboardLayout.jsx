import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, Routes, Route } from "react-router-dom";
import { LogOut, BarChart3, Users, Building2, FileText, Menu, X } from "lucide-react";
import AnalyticsPage from "../pages/AnalyticsPage";
import UsersPage from "../pages/UsersPage";
import OrganizationsPage from "../pages/OrganizationsPage";
import AuditLogsPage from "../pages/AuditLogsPage";

const navItems = [
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Users", path: "/users", icon: Users },
  { name: "Organizations", path: "/organizations", icon: Building2 },
  { name: "Audit Logs", path: "/audit-logs", icon: FileText },
];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("superadmin_token");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden fixed top-0 left-0 p-4 z-50">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-600 focus:outline-none">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg flex flex-col transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">Super Admin</h1>
        </div>
        
        <nav className="flex-1 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)} // Close sidebar on nav item click
                className={`flex items-center px-6 py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 ${
                  isActive 
                    ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600" 
                    : ""
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col md:ml-0">
        {/* Topbar */}
        <header className="h-16 bg-white shadow-sm flex items-center px-6 justify-between border-b border-gray-200">
          <div className="md:hidden w-6"></div> {/* Spacer for mobile toggle */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-500">Super Admin Portal</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-semibold text-sm">SA</span>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/" element={<AnalyticsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
} 