import React, { useEffect, useState } from "react";
import { usersAPI } from "../services/api";
import { Search, Users, UserCheck, UserX } from "lucide-react";
import AssignRoleModal from '../components/AssignRoleModal';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 20,
        ...(search && { search }),
        ...(status && { status }),
      };
      const res = await usersAPI.getUsers(params);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId, isActive) => {
    try {
      await usersAPI.updateUserStatus(userId, isActive);
      fetchUsers(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user status");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, search, status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage all users across the platform</p>
      </div>
      
      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field w-full md:w-48"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">Error Loading Users</div>
            <div className="text-gray-600">{error}</div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organizations</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const mainOrgUser = user.organization_users?.[0];
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.organization_users?.length > 0 ? (
                          user.organization_users.map((member, index) => (
                            <div key={index} className="mb-1">
                              {member.organizations.name}
                            </div>
                          ))
                        ) : (
                          <span className="text-gray-400">No organizations</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {mainOrgUser?.role?.name || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                        <button
                          onClick={() => { setSelectedUser(user); setShowRoleModal(true); }}
                          className="btn-secondary text-xs"
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() => updateUserStatus(user.id, !user.isActive)}
                          className={`inline-flex items-center px-3 py-1 rounded text-xs transition-colors duration-200 ${
                            user.isActive
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <UserX className="w-3 h-3 mr-1" />
                              Suspend
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" />
                              Activate
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showRoleModal && selectedUser && (
        <AssignRoleModal
          user={selectedUser}
          onClose={(refresh) => {
            setShowRoleModal(false);
            setSelectedUser(null);
            if (refresh) fetchUsers();
          }}
        />
      )}
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