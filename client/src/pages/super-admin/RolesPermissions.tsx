import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Check, X } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { ROLE_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { workspacesService } from '../../services/api';
import type { Role } from '../../app/types';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

const PERMISSIONS = [
  { key: 'companies.view', label: 'View Companies', description: 'Can see all company records and health signals' },
  { key: 'companies.create', label: 'Create Companies', description: 'Can register a new company on the platform' },
  { key: 'companies.edit', label: 'Edit Companies', description: 'Can update company profile and status data' },
  { key: 'companies.suspend', label: 'Suspend Companies', description: 'Can block company access to the platform' },
  { key: 'users.view', label: 'View Users', description: 'Can inspect platform user accounts and memberships' },
  { key: 'users.create', label: 'Create Users', description: 'Can create new users inside the workspace/company' },
  { key: 'users.edit', label: 'Edit Users', description: 'Can edit user role, title, and status' },
  { key: 'users.block', label: 'Block Users', description: 'Can disable or reactivate user accounts' },
  { key: 'logs.view', label: 'View Activity Logs', description: 'Can access operational and audit trail logs' },
  { key: 'modules.manage', label: 'Manage Modules', description: 'Can control enabled feature modules' },
  { key: 'settings.manage', label: 'Manage Platform Settings', description: 'Can change global system settings' },
] as const;

const ROLES: Role[] = ['super_admin', 'admin', 'manager', 'team_leader', 'team_member'];

const DEFAULT_PERMISSIONS: Record<string, Partial<Record<Role, boolean>>> = {
  'companies.view': { super_admin: true, admin: true, manager: true, team_leader: false, team_member: false },
  'companies.create': { super_admin: true, admin: false, manager: false, team_leader: false, team_member: false },
  'companies.edit': { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
  'companies.suspend': { super_admin: true, admin: false, manager: false, team_leader: false, team_member: false },
  'users.view': { super_admin: true, admin: true, manager: true, team_leader: true, team_member: false },
  'users.create': { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
  'users.edit': { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
  'users.block': { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
  'logs.view': { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
  'modules.manage': { super_admin: true, admin: false, manager: false, team_leader: false, team_member: false },
  'settings.manage': { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
};

export const RolesPermissionsPage: React.FC = () => {
  const { workspaces, bootstrap } = useAppStore();
  const workspace = workspaces[0];
  const [permissionMap, setPermissionMap] = useState<Record<string, Partial<Record<Role, boolean>>>>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  const storedPermissions = workspace?.settings?.permissions;
  const effectivePermissions = useMemo(
    () =>
      PERMISSIONS.reduce<Record<string, Partial<Record<Role, boolean>>>>((acc, permission) => {
        acc[permission.key] = {
          ...(DEFAULT_PERMISSIONS[permission.key] || {}),
          ...(storedPermissions?.[permission.key] || {}),
        };
        return acc;
      }, {}),
    [storedPermissions]
  );

  useEffect(() => {
    setPermissionMap(effectivePermissions);
  }, [effectivePermissions]);

  const hasChanges = useMemo(
    () => JSON.stringify(permissionMap) !== JSON.stringify(effectivePermissions),
    [permissionMap, effectivePermissions]
  );

  const togglePermission = (permissionKey: string, role: Role) => {
    setPermissionMap((prev) => ({
      ...prev,
      [permissionKey]: {
        ...prev[permissionKey],
        [role]: !prev[permissionKey]?.[role],
      },
    }));
  };

  const handleResetDefaults = () => {
    setPermissionMap(
      PERMISSIONS.reduce<Record<string, Partial<Record<Role, boolean>>>>((acc, permission) => {
        acc[permission.key] = { ...(DEFAULT_PERMISSIONS[permission.key] || {}) };
        return acc;
      }, {})
    );
  };

  const handleSave = async () => {
    if (!workspace?.id) return;
    setSaving(true);
    try {
      await workspacesService.update(workspace.id, {
        settings: {
          ...(workspace.settings || {}),
          permissions: permissionMap,
        },
      });
      await bootstrap();
      emitSuccessToast('Role permissions updated successfully.', 'Permissions Saved');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Permissions could not be saved.';
      emitErrorToast(message, 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><Shield size={24} /> Roles & Permissions</h1>
          <p className="page-subtitle">Persisted permission matrix for the current workspace</p>
          {workspace && <p className="mt-1 text-xs text-surface-400">Workspace: {workspace.name}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleResetDefaults} className="btn-secondary btn-md">Reset Defaults</button>
          <button onClick={handleSave} disabled={!workspace?.id || saving || !hasChanges} className="btn-primary btn-md">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Real Persistence</p>
          <p className="mt-1 text-xs text-surface-400">
            This page now stores permissions on the active workspace instead of using placeholder role cards.
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Unsaved Changes</p>
          <p className="mt-1 text-xs text-surface-400">{hasChanges ? 'You have unsaved permission edits.' : 'All permission changes are saved.'}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
                <th className="w-80 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Permission</th>
                {ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-surface-500">
                    <span className={cn('badge text-[10px]', ROLE_CONFIG[role].bg, ROLE_CONFIG[role].color)}>
                      {ROLE_CONFIG[role].label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
              {PERMISSIONS.map((permission, index) => (
                <motion.tr
                  key={permission.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                >
                  <td className="px-5 py-3.5 align-top">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{permission.label}</p>
                    <p className="text-xs text-surface-400">{permission.description}</p>
                  </td>
                  {ROLES.map((role) => {
                    const allowed = Boolean(permissionMap[permission.key]?.[role]);
                    return (
                      <td key={role} className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(permission.key, role)}
                          className={cn(
                            'mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition-all',
                            allowed
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/30'
                              : 'border-surface-200 bg-surface-50 text-surface-400 dark:border-surface-700 dark:bg-surface-800'
                          )}
                          aria-label={`${allowed ? 'Disable' : 'Enable'} ${permission.label} for ${ROLE_CONFIG[role].label}`}
                        >
                          {allowed ? <Check size={15} /> : <X size={15} />}
                        </button>
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RolesPermissionsPage;
