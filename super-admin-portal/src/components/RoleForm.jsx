import React, { useState, useEffect } from "react";
import { rolesAPI } from "../services/api";

const PERMISSION_CATEGORIES = [
  {
    name: "Organization Management",
    permissions: [
      { action: "MANAGE", resource: "ORGANIZATION_SETTINGS", label: "Manage organization settings" },
      { action: "MANAGE", resource: "ORGANIZATION_USERS", label: "Manage organization users" },
    ],
  },
  {
    name: "User Management",
    permissions: [
      { action: "CREATE", resource: "USER_MANAGEMENT", label: "Invite users" },
      { action: "READ", resource: "USER_MANAGEMENT", label: "View users" },
      { action: "UPDATE", resource: "USER_MANAGEMENT", label: "Edit users" },
      { action: "DELETE", resource: "USER_MANAGEMENT", label: "Remove users" },
      { action: "MANAGE", resource: "USER_MANAGEMENT", label: "Manage users" },
      { action: "MANAGE", resource: "USER_ROLES", label: "Assign roles and permissions" },
    ],
  },
  {
    name: "Lead Management",
    permissions: [
      { action: "CREATE", resource: "LEAD_FORM_CREATION", label: "Create lead forms" },
      { action: "READ", resource: "LEAD_FORM_CREATION", label: "View lead forms" },
      { action: "UPDATE", resource: "LEAD_FORM_CREATION", label: "Edit lead forms" },
      { action: "DELETE", resource: "LEAD_FORM_CREATION", label: "Delete lead forms" },
      { action: "MANAGE", resource: "LEAD_FORM_CREATION", label: "Manage lead forms" },
      { action: "POST", resource: "LEAD_FORM_CREATION", label: "Post/submit lead forms" },
    ],
  },
  {
    name: "Form Customization",
    permissions: [
      { action: "MANAGE", resource: "FORM_CUSTOMIZATION", label: "Add custom fields" },
      { action: "MANAGE", resource: "FIELD_TYPE_CONFIGURATION", label: "Configure field types/validation" },
    ],
  },
  {
    name: "Other Permissions",
    permissions: [
      { action: "READ", resource: "CALL_HISTORY", label: "View call history" },
      { action: "MANAGE", resource: "PROFILE", label: "Manage own profile" },
    ],
  },
];

const CHAT_PERMISSIONS = [
  { resource: "AGENT_TO_AGENT_CHAT", label: "Agent to Agent Chat (org must allow)" },
  { resource: "AGENT_TO_TEAM_LEAD_CHAT", label: "Agent to Team Lead Chat (default enabled)" },
  { resource: "TEAM_LEAD_ALL_CHAT", label: "Team Lead to All Chat" },
  { resource: "CREATE_GROUP_CHAT", label: "Create Group Chat" },
];

export default function RoleForm({ orgId, role, onClose }) {
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [selectedPermissions, setSelectedPermissions] = useState(
    role?.rolePermissions?.map(p => ({ action: p.action, resource: p.resource })) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const togglePermission = (perm) => {
    const exists = selectedPermissions.some(
      p => p.action === perm.action && p.resource === perm.resource
    );
    if (exists) {
      setSelectedPermissions(selectedPermissions.filter(
        p => !(p.action === perm.action && p.resource === perm.resource)
      ));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (role) {
        await rolesAPI.updateRole(orgId, role.id, { name, description, permissions: selectedPermissions });
      } else {
        await rolesAPI.createRole(orgId, { name, description, permissions: selectedPermissions });
      }
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
      <div className="card w-full max-w-lg p-6 relative animate-fade-in">
        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700" onClick={() => onClose(false)}>&times;</button>
        <h2 className="text-xl font-bold mb-2">{role ? "Edit Role" : "Create Role"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold mb-1">Role Name</label>
            <input type="text" className="input-field w-full" value={name} onChange={e => setName(e.target.value)} required minLength={1} maxLength={50} />
          </div>
          <div>
            <label className="block font-semibold mb-1">Description</label>
            <input type="text" className="input-field w-full" value={description} onChange={e => setDescription(e.target.value)} maxLength={200} />
          </div>
          <div>
            <label className="block font-semibold mb-1">Permissions</label>
            <div className="space-y-4 max-h-64 overflow-y-auto bg-primary-50 rounded-lg p-4 border border-primary-100">
              {PERMISSION_CATEGORIES.map(cat => (
                <div key={cat.name} className="mb-2">
                  <div className="font-semibold text-primary-700 mb-2 text-base border-b border-primary-200 pb-1">{cat.name}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    {cat.permissions.map(perm => {
                      const checked = selectedPermissions.some(
                        p => p.action === perm.action && p.resource === perm.resource
                      );
                      return (
                        <label key={perm.action + perm.resource} className="flex items-center gap-2 bg-white rounded px-2 py-1 shadow-sm border border-gray-200 hover:border-primary-400 transition">
                          <input
                            type="checkbox"
                            className="accent-primary-600 w-4 h-4 rounded border-gray-300 focus:ring-primary-500"
                            checked={checked}
                            onChange={() => togglePermission(perm)}
                          />
                          <span className="text-gray-800">{perm.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Chat Permissions</label>
            <div className="space-y-2">
              {CHAT_PERMISSIONS.map(perm => {
                const checked = selectedPermissions.some(
                  p => p.action === "CHAT" && p.resource === perm.resource
                );
                return (
                  <label key={perm.resource} className="flex items-center gap-2 bg-white rounded px-2 py-1 shadow-sm border border-gray-200 hover:border-primary-400 transition">
                    <input
                      type="checkbox"
                      className="accent-primary-600 w-4 h-4 rounded border-gray-300 focus:ring-primary-500"
                      checked={checked}
                      onChange={() => {
                        if (checked) {
                          setSelectedPermissions(selectedPermissions.filter(p => !(p.action === "CHAT" && p.resource === perm.resource)));
                        } else {
                          setSelectedPermissions([...selectedPermissions, { action: "CHAT", resource: perm.resource }]);
                        }
                      }}
                    />
                    <span className="text-gray-800">{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => onClose(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Role"}</button>
          </div>
        </form>
      </div>
    </div>
  );
} 