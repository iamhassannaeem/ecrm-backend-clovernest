import React, { useEffect, useState } from "react";
import { rolesAPI, usersAPI } from "../services/api";
import axios from "axios";

export default function AssignRoleModal({ user, onClose }) {
  const mainOrgUser = user.organization_users?.[0];
  const orgId = mainOrgUser?.organizations?.id;
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(mainOrgUser?.roleId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  // Fetch all permissions on mount
  useEffect(() => {
    axios.get("/api/roles/permissions", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(res => {
        setPermissions(res.data.permissions);
      })
      .catch(() => setPermissions([]));
  }, []);

  // Filter lead form permissions
  const leadFormPermissions = permissions.filter(
    perm => perm.resource.startsWith("LEAD_FORM")
  );

  useEffect(() => {
    if (!orgId) return;
    const fetchRoles = async () => {
      try {
        const res = await rolesAPI.getRoles(orgId);
        setRoles(res.data.roles);
      } catch (err) {
        setError("Failed to load roles");
      }
    };
    fetchRoles();
  }, [orgId]);

  const handlePermissionChange = (perm) => {
    setSelectedPermissions(prev =>
      prev.some(p => p.action === perm.action && p.resource === perm.resource)
        ? prev.filter(p => !(p.action === perm.action && p.resource === perm.resource))
        : [...prev, perm]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Send selectedPermissions along with role assignment
      await usersAPI.updateUserRole(user.id, orgId, selectedRoleId, selectedPermissions);
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
      <div className="card w-full max-w-md p-6 relative animate-fade-in">
        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700" onClick={() => onClose(false)}>&times;</button>
        <h2 className="text-xl font-bold mb-4">Assign Role</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Select Role</label>
            <select
              className="input-field w-full"
              value={selectedRoleId}
              onChange={e => setSelectedRoleId(e.target.value)}
              required
            >
              <option value="">Select a role</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Lead Form Permissions</label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
              {leadFormPermissions.map(perm => (
                <label key={perm.action + perm.resource} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.some(
                      p => p.action === perm.action && p.resource === perm.resource
                    )}
                    onChange={() => handlePermissionChange(perm)}
                  />
                  {perm.action} - {perm.resource}
                </label>
              ))}
            </div>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => onClose(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !selectedRoleId}>{loading ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
} 