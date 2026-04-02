import React, { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Shield, Users } from "lucide-react";
import { organizationsAPI, storeTestUsersAPI, usersAPI } from "../services/api";

export default function StoreTestUsersPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [organizations, setOrganizations] = useState([]);
  const [storeTestUsers, setStoreTestUsers] = useState([]);

  const [form, setForm] = useState({
    organizationId: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const fetchOrganizations = async () => {
    const res = await organizationsAPI.getOrganizations({ page: 1, limit: 200, status: "ACTIVE" });
    const orgs = Array.isArray(res.data?.organizations) ? res.data.organizations : [];
    setOrganizations(orgs);
  };

  const fetchStoreTestUsers = async () => {
    const res = await usersAPI.getUsers({ page: 1, limit: 200 });
    const users = Array.isArray(res.data?.users) ? res.data.users : [];
    setStoreTestUsers(users.filter((u) => u?.isStoreTestUser === true));
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchOrganizations(), fetchStoreTestUsers()]);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load Store Test Users module");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selectedOrg = useMemo(() => {
    const id = Number(form.organizationId);
    if (!id) return null;
    return organizations.find((o) => Number(o.id) === id) || null;
  }, [form.organizationId, organizations]);

  const onCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await storeTestUsersAPI.create({
        organizationId: Number(form.organizationId),
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
      });
      setSuccess("Store test user created successfully");
      setForm((p) => ({ ...p, email: "", password: "", firstName: "", lastName: "" }));
      await fetchStoreTestUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create store test user");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary-600" />
          Store Test Users
        </h1>
        <p className="text-gray-600">
          Create a special user for App Store / Google Play review. This user bypasses device-id and IP restrictions.
        </p>
      </div>

      {error && (
        <div className="card mb-4">
          <div className="text-red-600 font-semibold">Error</div>
          <div className="text-gray-700 mt-1">{error}</div>
        </div>
      )}

      {success && (
        <div className="card mb-4">
          <div className="text-green-700 font-semibold">Success</div>
          <div className="text-gray-700 mt-1">{success}</div>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-primary-600" />
          <div className="text-lg font-semibold text-gray-900">Create Store Test User</div>
        </div>

        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization <span className="text-red-500">*</span>
            </label>
            <select
              value={form.organizationId}
              onChange={(e) => setForm((p) => ({ ...p, organizationId: e.target.value }))}
              className="input-field w-full"
              required
              disabled={submitting}
            >
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} (#{org.id})
                </option>
              ))}
            </select>
            {selectedOrg ? (
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Selected: <span className="font-semibold text-gray-700">{selectedOrg.name}</span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="input-field w-full"
                required
                disabled={submitting}
                placeholder="review.user@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="input-field w-full"
                required
                disabled={submitting}
                placeholder="Min 8 chars"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                className="input-field w-full"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                className="input-field w-full"
                disabled={submitting}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full md:w-auto" disabled={submitting}>
            {submitting ? "Creating..." : "Create Store Test User"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            <div className="text-lg font-semibold text-gray-900">Existing Store Test Users</div>
          </div>
          <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
            {storeTestUsers.length} users
          </div>
        </div>

        {storeTestUsers.length === 0 ? (
          <div className="text-gray-600">No store test users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {storeTestUsers.map((u) => {
                  const orgName =
                    u?.organization?.name ||
                    u?.organization_users?.[0]?.organizations?.name ||
                    (u?.organizationId ? `Org #${u.organizationId}` : "-");
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {(u.firstName || u.lastName) ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "-"}
                        </div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                        <div className="text-xs text-primary-700 font-semibold mt-1">Store Test User</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{orgName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            u.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

