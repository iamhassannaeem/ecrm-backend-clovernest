import React, { useEffect, useState } from "react";
import { auditLogsAPI } from "../services/api";
import { organizationsAPI } from "../services/api";
import { Search, FileText, User, Calendar, Activity } from "lucide-react";

export default function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    action: "",
    resource: "",
    userId: "",
    organizationId: "",
  });
  const [organizations, setOrganizations] = useState([]);

  // Fetch organizations for filter dropdown
  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await organizationsAPI.getOrganizations({ limit: 1000 });
        setOrganizations(res.data.organizations || []);
      } catch (err) {
        // ignore error
      }
    };
    fetchOrgs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 50,
        ...(filters.action && { action: filters.action }),
        ...(filters.resource && { resource: filters.resource }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
      };
      const res = await auditLogsAPI.getAuditLogs(params);
      setAuditLogs(res.data.auditLogs);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [page, filters]);

  const getActionColor = (action) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800';
    if (action.includes('DELETE') || action.includes('SUSPEND') || action.includes('DEACTIVATE')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Logs</h1>
        <p className="text-gray-600">Track all system activities and changes</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Organization Filter */}
          <select
            value={filters.organizationId}
            onChange={e => setFilters({ ...filters, organizationId: e.target.value })}
            className="input-field w-full"
          >
            <option value="">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="input-field w-full"
          >
            <option value="">All Actions</option>
            <option value="USER_ACTIVATED">User Activated</option>
            <option value="USER_SUSPENDED">User Suspended</option>
            <option value="ORGANIZATION_STATUS_CHANGED">Organization Status Changed</option>
            <option value="CREATE_ORGANIZATION">Create Organization</option>
            <option value="UPDATE_ORGANIZATION">Update Organization</option>
            <option value="INVITE_USER">Invite User</option>
            <option value="UPDATE_USER_ROLE">Update User Role</option>
            <option value="DEACTIVATE_USER">Deactivate User</option>
          </select>
          <select
            value={filters.resource}
            onChange={(e) => setFilters({ ...filters, resource: e.target.value })}
            className="input-field w-full"
          >
            <option value="">All Resources</option>
            <option value="USER">User</option>
            <option value="ORGANIZATION">Organization</option>
            <option value="ORGANIZATION_USER">Organization User</option>
          </select>
          <input
            type="text"
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            className="input-field w-full"
          />
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">Error Loading Audit Logs</div>
            <div className="text-gray-600">{error}</div>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No audit logs found</p>
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.user?.firstName} {log.user?.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{log.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 mr-1 text-gray-400" />
                        {log.resource}
                        {log.resourceId && (
                          <div className="text-xs text-gray-500">ID: {log.resourceId}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {log.newValues && Object.keys(log.newValues).length > 0 && (
                        <div>
                          <div className="font-medium">New Values:</div>
                          {Object.entries(log.newValues).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              {key}: {JSON.stringify(value)}
                            </div>
                          ))}
                        </div>
                      )}
                      {log.oldValues && Object.keys(log.oldValues).length > 0 && (
                        <div className="mt-1">
                          <div className="font-medium">Old Values:</div>
                          {Object.entries(log.oldValues).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              {key}: {JSON.stringify(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="card">
          <div className="flex justify-center">
            <nav className="flex space-x-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-2 rounded transition-colors duration-200 ${
                    pageNum === page
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
} 