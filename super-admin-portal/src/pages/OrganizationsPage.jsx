import React, { useEffect, useState } from "react";
import { organizationsAPI } from "../services/api";
import { rolesAPI } from "../services/api";
import { Search, Building2, Plus, Users, Calendar, Mail, Globe, User, Info, X, Shield, CreditCard } from "lucide-react";
import { useNavigate } from 'react-router-dom';


function truncateWords(str, numWords = 4) {
  if (!str) return '-';
  const words = str.split(' ');
  return words.length > numWords ? words.slice(0, numWords).join(' ') + '...' : str;
}

// Helper to get admin user from organization_users
function getAdminUser(org) {
  if (!org.organization_users) return null;
  
  const adminRole = org.organization_users.find(
    ou => ou.role === 'ORGANIZATION_ADMIN' || ou.role === 'SUPER_ADMIN'
  );
  return adminRole ? adminRole.users : null;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    domain: "",
    description: "",
    website: "",
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
    adminPassword: "",
  });
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [editingOrg, setEditingOrg] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showOrgAdminPerms, setShowOrgAdminPerms] = useState(false);
  const [orgAdminPerms, setOrgAdminPerms] = useState([]);
  const [orgAdminPermsLoading, setOrgAdminPermsLoading] = useState(false);
  const [orgAdminPermsError, setOrgAdminPermsError] = useState("");
  const [orgAdminPermsSuccess, setOrgAdminPermsSuccess] = useState("");
  const [allPermissions, setAllPermissions] = useState([]);
  const [cardValidationLoading, setCardValidationLoading] = useState(false);
  const [cardValidationError, setCardValidationError] = useState("");
  const [cardValidationSuccess, setCardValidationSuccess] = useState("");

  const navigate = useNavigate();

  // Effect to manage body overflow when modal is open
  useEffect(() => {
    if (showCreateForm || selectedOrg || showOrgAdminPerms) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCreateForm, selectedOrg, showOrgAdminPerms]);

  // Auto-generate slug from name
  const handleNameChange = (e) => {
    const name = e.target.value;
    setCreateForm((prev) => ({
      ...prev,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    }));
  };

  const fetchOrganizations = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 20,
        ...(search && { search }),
        ...(status && { status }),
      };
      const res = await organizationsAPI.getOrganizations(params);
      
      setOrganizations(res.data.organizations);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (e) => {
    e.preventDefault();
    try {
      const res = await organizationsAPI.createOrganization(createForm);
      setShowCreateForm(false);
      setCreateForm({
        name: "",
        domain: "",
        description: "",
        website: "",
        adminEmail: "",
        adminFirstName: "",
        adminLastName: "",
        adminPassword: "",
      });
      // Add the new organization to the list (with full details)
      if (res.data && res.data.organization) {
        setOrganizations((prev) => [res.data.organization, ...prev]);
      } else {
        fetchOrganizations();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create organization");
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [page, search, status]);

  // Handler for starting edit
  const handleEditOrg = () => {
    setEditForm({
      name: selectedOrg.name || '',
      domain: selectedOrg.domain || '',
      description: selectedOrg.description || '',
      website: selectedOrg.website || '',
      // Add more fields as needed
    });
    setEditingOrg(true);
  };

  // Handler for submitting edit (placeholder)
  const handleUpdateOrg = async (e) => {
    e.preventDefault();
    // TODO: Replace with actual update API call
    // await organizationsAPI.updateOrganization(selectedOrg.id, editForm);
    // For now, just close the form and update local state
    setSelectedOrg({ ...selectedOrg, ...editForm });
    setEditingOrg(false);
    fetchOrganizations();
  };

  // Helper to fetch current ORGANIZATION_ADMIN permissions for selectedOrg
  const fetchOrgAdminPermissions = async (orgId) => {
    setOrgAdminPermsLoading(true);
    setOrgAdminPermsError("");
    try {
      const res = await organizationsAPI.getOrgAdminPermissions(orgId);
      setOrgAdminPerms(res.data.permissions || []);
    } catch (err) {
      setOrgAdminPermsError("Failed to load Org Admin permissions");
    } finally {
      setOrgAdminPermsLoading(false);
    }
  };

  // Handler to open the modal
  const handleEditOrgAdminPerms = () => {
    if (selectedOrg) {
      fetchOrgAdminPermissions(selectedOrg.id);
      setShowOrgAdminPerms(true);
      setOrgAdminPermsSuccess("");
      setOrgAdminPermsError("");
    }
  };

  // Handler for checkbox change
  const handlePermCheckbox = (action, resource) => {
    setOrgAdminPerms((prev) => {
      const exists = prev.some(p => p.action === action && p.resource === resource);
      if (exists) {
        return prev.filter(p => !(p.action === action && p.resource === resource));
      } else {
        return [...prev, { action, resource }];
      }
    });
  };

  // Handler to submit updated permissions
  const handleSaveOrgAdminPerms = async (e) => {
    e.preventDefault();
    setOrgAdminPermsLoading(true);
    setOrgAdminPermsError("");
    setOrgAdminPermsSuccess("");
    try {
      await organizationsAPI.updateOrgAdminPermissions(selectedOrg.id, orgAdminPerms);
      setOrgAdminPermsSuccess("Permissions updated successfully");
      fetchOrgAdminPermissions(selectedOrg.id);
    } catch (err) {
      setOrgAdminPermsError("Failed to update Org Admin permissions");
    } finally {
      setOrgAdminPermsLoading(false);
    }
  };

  const handleToggleCardValidation = async (organizationId, currentValue) => {
    setCardValidationLoading(true);
    setCardValidationError("");
    setCardValidationSuccess("");
    try {
      const newValue = !currentValue;
      await organizationsAPI.updateCardValidation(organizationId, newValue);
      setCardValidationSuccess(`Card validation ${newValue ? 'enabled' : 'disabled'} successfully`);
      setSelectedOrg({ ...selectedOrg, enableCardValidation: newValue });
      setOrganizations(prev => prev.map(org => 
        org.id === organizationId 
          ? { ...org, enableCardValidation: newValue }
          : org
      ));
      setTimeout(() => setCardValidationSuccess(""), 3000);
    } catch (err) {
      setCardValidationError(err.response?.data?.error || "Failed to update card validation setting");
      setTimeout(() => setCardValidationError(""), 5000);
    } finally {
      setCardValidationLoading(false);
    }
  };

  // Fetch all possible permissions when Org Admin Perms modal opens
  useEffect(() => {
    if (showOrgAdminPerms) {
      rolesAPI.getAllPermissions()
        .then(res => setAllPermissions(res.data.permissions || []))
        .catch(() => setAllPermissions([]));
    }
  }, [showOrgAdminPerms]);

  // Dynamically get all unique resources and actions from permissions
  const allResources = Array.from(new Set(allPermissions.map(p => p.resource)));
  const allActions = Array.from(new Set(allPermissions.map(p => p.action)));

  // Helper functions
  const isLeadFormSubfield = (resource) => resource.startsWith('LEAD_FORM_') && resource !== 'LEAD_FORM_CREATION';
  const isChatResource = (resource) =>
    ['AGENT_TO_AGENT_CHAT', 'AGENT_TO_TEAM_LEAD_CHAT', 'TEAM_LEAD_ALL_CHAT'].includes(resource);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
          <p className="text-gray-600">Manage all organizations on the platform</p>
        </div>
        <button
          className="btn-primary w-full md:w-auto"
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="inline-block w-4 h-4 mr-2" /> Create Organization
        </button>
      </div>

      {/* Create Organization Modal */}
      {showCreateForm && (
        <div className="fixed  inset-0 bg-black bg-opacity-10 flex items-center justify-center z-[999]">
          <div className="card w-full max-w-lg relative animate-fade-in">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
              onClick={() => setShowCreateForm(false)}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold mb-2 text-primary-700 flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Create Organization
            </h2>
            <p className="text-gray-500 mb-6">Fill in the details below to create a new organization and its admin.</p>
            <form onSubmit={createOrganization} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-1"><Info className="w-4 h-4" /> Organization Info</h3>
                  <input type="text" placeholder="Organization Name" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} className="input-field mb-2" required />
                  <input type="text" placeholder="Domain" value={createForm.domain} onChange={e => setCreateForm({ ...createForm, domain: e.target.value })} className="input-field mb-2" />
                  <input type="text" placeholder="Description" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className="input-field mb-2" />
                  <input type="text" placeholder="Website" value={createForm.website} onChange={e => setCreateForm({ ...createForm, website: e.target.value })} className="input-field mb-2" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-1"><User className="w-4 h-4" /> Admin Info</h3>
                  <input type="email" placeholder="Admin Email" value={createForm.adminEmail} onChange={e => setCreateForm({ ...createForm, adminEmail: e.target.value })} className="input-field mb-2" required />
                  <input type="text" placeholder="Admin First Name" value={createForm.adminFirstName} onChange={e => setCreateForm({ ...createForm, adminFirstName: e.target.value })} className="input-field mb-2" required />
                  <input type="text" placeholder="Admin Last Name" value={createForm.adminLastName} onChange={e => setCreateForm({ ...createForm, adminLastName: e.target.value })}
                  className="input-field mb-2" required />
                  <input type="password" placeholder="Admin Password" value={createForm.adminPassword} onChange={e => setCreateForm({ ...createForm, adminPassword: e.target.value })} className="input-field mb-2" required />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full mt-2">Create Organization</button>
            </form>
          </div>
        </div>
      )}

      {/* Organization Details Modal (for mobile) */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]">
          <div className="card w-full max-w-lg relative animate-fade-in max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
              onClick={() => { setSelectedOrg(null); setEditingOrg(false); }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> {selectedOrg.name}
            </h2>
            {editingOrg ? (
              <form onSubmit={handleUpdateOrg} className="space-y-4">
                <input type="text" className="input-field" placeholder="Organization Name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                <input type="text" className="input-field" placeholder="Domain" value={editForm.domain} onChange={e => setEditForm({ ...editForm, domain: e.target.value })} />
                <input type="text" className="input-field" placeholder="Description" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                <input type="text" className="input-field" placeholder="Website" value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })} />
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setEditingOrg(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Update</button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-700"><Info className="w-4 h-4" /> {selectedOrg.description || 'No description'}</div>
                <div className="flex items-center gap-2 text-gray-700"><Globe className="w-4 h-4" /> <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer" className="underline">{selectedOrg.website || 'No website'}</a></div>
                <div className="flex items-center gap-2 text-gray-700"><Mail className="w-4 h-4" /> {selectedOrg.domain}</div>
                <div className="flex items-center gap-2 text-gray-700"><Calendar className="w-4 h-4" /> Created: {new Date(selectedOrg.createdAt).toLocaleDateString()}</div>
                {/* Use getAdminUser for modal admin display too */}
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4" /> Admin: {(() => {
                    const admin = getAdminUser(selectedOrg);
                    return admin ? `${admin.firstName} ${admin.lastName} (${admin.email})` : '-';
                  })()}
                </div>
                <div className="flex items-center gap-2 text-gray-700"><Info className="w-4 h-4" /> Status: <span className={`font-semibold ${selectedOrg.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-500'}`}>{selectedOrg.status}</span></div>
                <div className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-700">
                    <CreditCard className="w-4 h-4" />
                    <span className="font-medium">Card Validation:</span>
                    <span className={`font-semibold ${selectedOrg.enableCardValidation ? 'text-green-600' : 'text-gray-500'}`}>
                      {selectedOrg.enableCardValidation ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOrg.enableCardValidation || false}
                      onChange={() => handleToggleCardValidation(selectedOrg.id, selectedOrg.enableCardValidation || false)}
                      disabled={cardValidationLoading}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                {cardValidationError && (
                  <div className="text-red-500 text-sm mt-2">{cardValidationError}</div>
                )}
                {cardValidationSuccess && (
                  <div className="text-green-600 text-sm mt-2">{cardValidationSuccess}</div>
                )}
                {/* Users List */}
                {selectedOrg.users && selectedOrg.users.length > 0 && (
                  <div className="mt-4">
                    <div className="font-semibold mb-1 flex items-center gap-1"><Users className="w-4 h-4" /> Users in Organization:</div>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2">
                      <ul className="space-y-1">
                        {selectedOrg.users.map(user => (
                          <li key={user.id} className="pl-2 text-gray-700 text-sm flex flex-col md:flex-row md:items-center md:gap-2">
                            <span>{user.firstName} {user.lastName}</span>
                            <span className="text-gray-500">({user.email})</span>
                            <span className="text-gray-400 text-xs">{user.role || user.roles?.[0]?.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <div className="flex justify-end mt-4 gap-2">
                  <button className="btn-primary" onClick={handleEditOrg}>Edit</button>
                  <button className="btn-secondary" onClick={handleEditOrgAdminPerms}>
                    <Shield className="w-4 h-4 inline-block mr-1" /> Edit Org Admin Permissions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Org Admin Permissions Modal */}
      {showOrgAdminPerms && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[1000]">
          <div className="card w-full max-w-2xl relative animate-fade-in max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
              onClick={() => setShowOrgAdminPerms(false)}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Edit Org Admin Permissions
            </h2>
            <p className="text-gray-500 mb-4">Configure what the Organization Admin can do in <span className="font-semibold">{selectedOrg?.name}</span>.</p>
            {orgAdminPermsError && <div className="text-red-500 mb-2">{orgAdminPermsError}</div>}
            {orgAdminPermsSuccess && <div className="text-green-600 mb-2">{orgAdminPermsSuccess}</div>}
            <form onSubmit={handleSaveOrgAdminPerms}>
              <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-primary-50">
                    <tr>
                      <th className="p-3 border-b text-left font-semibold text-primary-700">Resource</th>
                      {allActions.map(action => (
                        <th key={action} className="p-3 border-b text-center font-semibold text-primary-700">{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allResources.map(resource => (
                      <tr key={resource} className="hover:bg-primary-50 transition">
                        <td className="p-3 border-b font-semibold text-gray-800 whitespace-nowrap">{resource.replace(/_/g, ' ')}</td>
                        {allActions.map(action => {
                          // Only show MANAGE for LEAD_FORM_* subfields (except LEAD_FORM_CREATION)
                          if (isLeadFormSubfield(resource) && action !== 'MANAGE') {
                            return <td key={action} className="p-3 border-b text-center"></td>;
                          }
                          // Only show CHAT for chat resources
                          if (isChatResource(resource) && action !== 'CHAT') {
                            return <td key={action} className="p-3 border-b text-center"></td>;
                          }
                          // For all other resources, show all actions
                          return (
                            <td key={action} className="p-3 border-b text-center">
                              <input
                                type="checkbox"
                                className="accent-primary-600 w-4 h-4 rounded border-gray-300 focus:ring-primary-500"
                                checked={!!orgAdminPerms.find(
                                  p => String(p.action).trim() === String(action).trim() && String(p.resource).trim() === String(resource).trim()
                                )}
                                onChange={() => handlePermCheckbox(action, resource)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Chat Permissions Section in Modal */}
              <div className="mt-6">
                <div className="font-semibold mb-2">Chat Permissions</div>
                <div className="space-y-2">
                  {allPermissions.filter(p => p.resource.startsWith('CHAT_')).map(perm => {
                    const checked = orgAdminPerms.some(
                      p => String(p.action).trim() === "CHAT" && String(p.resource).trim() === String(perm.resource).trim()
                    );
                    return (
                      <label key={perm.resource} className="flex items-center gap-2 bg-white rounded px-2 py-1 shadow-sm border border-gray-200 hover:border-primary-400 transition">
                        <input
                          type="checkbox"
                          className="accent-primary-600 w-4 h-4 rounded border-gray-300 focus:ring-primary-500"
                          checked={checked}
                          onChange={() => handlePermCheckbox("CHAT", perm.resource)}
                        />
                        <span className="text-gray-800">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn-secondary" onClick={() => setShowOrgAdminPerms(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Permissions</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field w-48"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TRIAL">Trial</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="text-center">
            <div className="text-red-500 text-lg mb-2">Error Loading Organizations</div>
            <div className="text-gray-600">{error}</div>
          </div>
        </div>
      )}

      {/* Organizations Table (responsive) */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Validation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {organizations.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-4 py-12 text-center text-gray-500">
                  <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>No organizations found</p>
                </td>
              </tr>
            ) : (
              <>
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {truncateWords(org.name)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {truncateWords(org.domain)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {truncateWords(org.description)}
                    </td>
                    <td className="px-4 py-4 text-sm text-blue-700 underline max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {org.website ? <a href={org.website} target="_blank" rel="noopener noreferrer">{truncateWords(org.website)}</a> : '-'}
                    </td>
                    <td className="px-4 py-4 max-w-[90px] overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${org.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : org.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' : org.status === 'TRIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{org.status}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${org.enableCardValidation ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {org.enableCardValidation ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-[110px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]">
                      {(() => {
                        const admin = getAdminUser(org);
                        return admin ? truncateWords(`${admin.firstName} ${admin.lastName} (${admin.email})`) : '-';
                      })()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center max-w-[60px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {org.users ? org.users.length : 1}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <button
                        className="btn-secondary px-3 py-1 text-xs"
                        onClick={() => setSelectedOrg(org)}
                      >
                        View Details
                      </button>
                      <button
                        className="btn-secondary px-3 py-1 text-xs ml-2"
                        onClick={() => navigate(`/organizations/${org.id}/roles`)}
                      >
                        Manage Roles
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

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
    </div>
  );
}