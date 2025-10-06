const { prisma } = require('../config/database');

class PermissionService {
  /**
   * Filter organizations based on user permissions
   */
  static async filterOrganizations(user, organizations) {
    if (!user || !organizations) return [];

    // Super admin can see all organizations
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return organizations;
    }

    // Organization admin can only see their own organization
    if (user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      return organizations.filter(org => org.id === user.organizationId);
    }

    // Agent can only see their own organization
    if (user.roles && user.roles.some(role => role.isAgent === true)) {
      return organizations.filter(org => org.id === user.organizationId);
    }

    return [];
  }

  /**
   * Filter users based on user permissions
   */
  static async filterUsers(user, users) {
    if (!user || !users) return [];

    // Super admin can see all users
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return users;
    }

    // Organization admin can see users in their organization
    if (user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      return users.filter(u => u.organizationId === user.organizationId);
    }

    // Agent can only see themselves and other agents in their organization
    if (user.roles && user.roles.some(role => role.isAgent === true)) {
      return users.filter(u => 
        u.id === user.id || 
        (u.organizationId === user.organizationId && 
         u.roles && u.roles.some(role => role.isAgent === true))
      );
    }

    return [];
  }

  /**
   * Filter leads based on user permissions
   */
  static async filterLeads(user, leads) {
    if (!user || !leads) return [];

    // Super admin can see all leads
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return leads;
    }

    // Organization admin can see leads in their organization
    if (user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      return leads.filter(lead => lead.organizationId === user.organizationId);
    }

    // Agent can only see leads assigned to them or in their organization
    if (user.roles && user.roles.some(role => role.isAgent === true)) {
      return leads.filter(lead => 
        lead.assignedToId === user.id || 
        lead.organizationId === user.organizationId
      );
    }

    return [];
  }

  /**
   * Filter roles based on user permissions
   */
  static async filterRoles(user, roles) {
    if (!user || !roles) return [];

    // Super admin can see all roles
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return roles;
    }

    // Organization admin can see roles in their organization
    if (user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      return roles.filter(role => role.organizationId === user.organizationId);
    }

    // Agent can only see their own role
    if (user.roles && user.roles.some(role => role.isAgent === true)) {
      return roles.filter(role => 
        user.roles.some(userRole => userRole.id === role.id)
      );
    }

    return [];
  }

  /**
   * Check if user has permission to access a specific resource
   */
  static hasPermission(user, action, resource) {
    if (!user || !user.permissions) return false;

    // Super admin has all permissions
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return true;
    }

    // Check specific permission
    return user.permissions.some(perm => 
      (perm.action === 'ALL' && perm.resource === 'ALL') ||
      (perm.action === action && perm.resource === resource)
    );
  }

  /**
   * Check if user can access organization-specific data
   */
  static canAccessOrganization(user, organizationId) {
    if (!user || !organizationId) return false;

    // Super admin can access any organization
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return true;
    }

    // Check if user belongs to the organization
    return user.organizationId === Number(organizationId);
  }

  /**
   * Get user's accessible organizations
   */
  static async getUserOrganizations(user) {
    if (!user) return [];

    // Super admin can access all organizations
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return await prisma.organization.findMany({
        where: { isActive: true }
      });
    }

    // Return user's organization
    if (user.organizationId && user.organization) {
      return [user.organization];
    }

    return [];
  }

  /**
   * Apply permission-based filtering to query results
   */
  static async applyPermissionFilter(user, data, dataType) {
    switch (dataType) {
      case 'organizations':
        return await this.filterOrganizations(user, data);
      case 'users':
        return await this.filterUsers(user, data);
      case 'leads':
        return await this.filterLeads(user, data);
      case 'roles':
        return await this.filterRoles(user, data);
      default:
        return data;
    }
  }

  /**
   * Create permission-aware database queries
   */
  static createPermissionAwareQuery(user, baseQuery = {}) {
    // Super admin can see everything
    if (user.roles && user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN')) {
      return baseQuery;
    }

    // Organization admin can only see their organization's data
    if (user.roles && user.roles.some(role => role.name === 'ORGANIZATION_ADMIN')) {
      return {
        ...baseQuery,
        where: {
          ...baseQuery.where,
          organizationId: user.organizationId
        }
      };
    }

    // Agent can only see their own data or organization data
    if (user.roles && user.roles.some(role => role.isAgent === true)) {
      return {
        ...baseQuery,
        where: {
          ...baseQuery.where,
          OR: [
            { organizationId: user.organizationId },
            { assignedToId: user.id },
            { createdById: user.id }
          ]
        }
      };
    }

    // Default: no access
    return {
      ...baseQuery,
      where: {
        ...baseQuery.where,
        id: null // This will return no results
      }
    };
  }
}

module.exports = PermissionService; 