import { getTenantModels } from '../config/tenantDb.js';

export const DEFAULT_WORKSPACE_PERMISSIONS = {
  seeOtherProjects: {
    super_admin: true,
    admin: true,
    manager: true,
    team_leader: true,
    team_member: true,
  },
  editOtherProjects: {
    super_admin: true,
    admin: true,
    manager: true,
    team_leader: false,
    team_member: false,
  },
};

export async function getWorkspacePermissionMap({ companyId, workspaceId }) {
  if (!companyId || !workspaceId) return {};
  const { Workspace } = await getTenantModels(companyId);
  const workspace = await Workspace.findOne({ _id: workspaceId, tenantId: companyId }).select('settings.permissions').lean();
  return workspace?.settings?.permissions || {};
}

export async function hasWorkspacePermission({ companyId, workspaceId, role, permissionKey }) {
  if (role === 'super_admin' || role === 'admin') return true;

  const storedPermissions = await getWorkspacePermissionMap({ companyId, workspaceId });
  const defaults = DEFAULT_WORKSPACE_PERMISSIONS[permissionKey] || {};
  const resolved = {
    ...defaults,
    ...(storedPermissions?.[permissionKey] || {}),
  };

  return Boolean(resolved?.[role]);
}
