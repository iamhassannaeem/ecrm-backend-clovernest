import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { rolesAPI } from "../services/api";
import RoleForm from "../components/RoleForm";

export default function RolesPage() {
  const { orgId } = useParams();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const fetchRoles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await rolesAPI.getRoles(orgId);
      setRoles(res.data.roles);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [orgId]);

  const handleCreateRole = () => {
    setEditingRole(null);
    setShowRoleForm(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setShowRoleForm(true);
  };

  const handleRoleFormClose = (refresh = false) => {
    setShowRoleForm(false);
    setEditingRole(null);
    if (refresh) fetchRoles();
  };

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Roles</h1>
        <button className="btn-primary px-6 py-2 rounded shadow" onClick={handleCreateRole}>Create Role</button>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => (
            <div key={role.id} className="card p-6 flex flex-col gap-2 rounded-lg shadow border border-gray-200 bg-white hover:shadow-lg transition">
              <div className="font-semibold text-lg text-primary-700">{role.name}</div>
              <div className="text-gray-600 text-sm mb-2">{role.description}</div>
              <div className="text-xs text-gray-500 mb-2">Permissions: {role.rolePermissions?.length || 0}</div>
              <div className="flex gap-2 mt-auto">
                <button className="btn-secondary text-xs" onClick={() => handleEditRole(role)}>Edit</button>
                {/* TODO: Add delete button */}
              </div>
            </div>
          ))}
        </div>
      )}
      {showRoleForm && (
        <RoleForm
          orgId={orgId}
          role={editingRole}
          onClose={handleRoleFormClose}
        />
      )}
    </div>
  );
} 