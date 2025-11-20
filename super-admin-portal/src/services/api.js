import axios from "axios";

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("superadmin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("superadmin_token");
      window.location.href = "/login";
    }
    // Log CORS errors for debugging
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.error('CORS Error:', error);
      console.log(`Make sure your backend server is running on ${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}`);
    }
    return Promise.reject(error);
  }
);

// Analytics API
export const analyticsAPI = {
  getAnalytics: () => api.get("/api/super-admin/analytics"),
  getStats: () => api.get("/api/super-admin/stats"),
};

// Users API
export const usersAPI = {
  getUsers: (params) => api.get("/api/super-admin/users", { params }),
  updateUserStatus: (userId, isActive) =>
    api.patch(`/api/super-admin/users/${userId}/status`, { isActive }),
  updateUserRole: (userId, organizationId, roleId) =>
    api.put(`/api/org-admin/users/${userId}/role`, { roleId, organizationId }),
};

// Organizations API
export const organizationsAPI = {
  getOrganizations: (params) => api.get("/api/super-admin/organizations", { params }),
  createOrganization: (data) => api.post("/api/super-admin/organizations", data),
  getOrganizationAnalytics: (organizationId) =>
    api.get(`/api/super-admin/organizations/${organizationId}/analytics`),
  updateOrgAdminPermissions: (organizationId, permissions) =>
    api.put(`/api/super-admin/organizations/${organizationId}/org-admin-permissions`, { permissions }),
  getOrgAdminPermissions: (organizationId) =>
    api.get(`/api/super-admin/organizations/${organizationId}/org-admin-permissions`),
  updateCardValidation: (organizationId, enableCardValidation) =>
    api.patch(`/api/super-admin/organizations/${organizationId}/card-validation`, { enableCardValidation }),
};

// Audit Logs API
export const auditLogsAPI = {
  getAuditLogs: (params) => api.get("/api/super-admin/audit-logs", { params }),
};

// Auth API
export const authAPI = {
  login: (credentials) => api.post("/api/auth/login", credentials),
};

// Roles API
export const rolesAPI = {
  getRoles: (organizationId) => api.get(`/api/organizations/${organizationId}/roles`),
  createRole: (organizationId, data) => api.post(`/api/organizations/${organizationId}/roles`, data),
  updateRole: (organizationId, roleId, data) => api.put(`/api/organizations/${organizationId}/roles/${roleId}`, data),
  // Optionally add deleteRole, assignRole, etc.
  getAllPermissions: () => api.get('/api/roles/permissions'),
};

export default api; 