import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, Crown, BarChart3, Plus, Search,
  MoreHorizontal, Check, X, Trash2, Edit3, Globe, Shield,
  CreditCard, TrendingUp, Zap, Star, CheckCircle
} from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { ROLE_CONFIG } from '../../app/constants';
import { useAppStore } from '../../context/appStore';
import { usersService, workspacesService } from '../../services/api';
import { UserAvatar } from '../../components/UserAvatar';
import { Modal } from '../../components/Modal';
import { Table, ProgressBar, EmptyState } from '../../components/ui';
import type { User, Role } from '../../app/types';

// ─── Workspaces Admin ─────────────────────────────────────────────────────────
export const AdminWorkspacesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { workspaces, users } = useAppStore();
  const filtered = workspaces.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));

  const PLAN_BADGE: Record<string, string> = {
    free: 'badge-gray',
    pro: 'badge-blue',
    enterprise: 'badge-purple',
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-2xl sm:text-3xl">Workspaces</h1>
          <p className="page-subtitle text-xs sm:text-sm">Manage all workspaces across the platform</p>
        </div>
        <button className="btn-primary btn-md w-full sm:w-auto"><Plus size={16} /> New Workspace</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Workspaces', value: workspaces.length, color: '#3366ff', icon: <Building2 size={18} /> },
          { label: 'Active Users', value: users.filter(u => u.isActive).length, color: '#10b981', icon: <Users size={18} /> },
          { label: 'Pro/Enterprise', value: workspaces.filter(w => w.plan !== 'free').length, color: '#7c3aed', icon: <Crown size={18} /> },
          { label: 'MRR', value: '—', color: '#f59e0b', icon: <TrendingUp size={18} /> },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${stat.color}15` }}>
              <div style={{ color: stat.color }}>{stat.icon}</div>
            </div>
            <p className="font-display font-bold text-2xl text-surface-900 dark:text-white">{stat.value}</p>
            <p className="text-xs text-surface-400">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-full sm:max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workspaces..." className="input pl-9 w-full" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <Table
          columns={[
            {
              key: 'name', header: 'Workspace',
              render: (w) => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{w.name[0]}</div>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200 text-sm">{w.name}</p>
                    <p className="text-xs text-surface-400">{w.slug}.flowboard.io</p>
                  </div>
                </div>
              )
            },
            {
              key: 'plan', header: 'Plan',
              render: (w) => <span className={cn('badge capitalize', PLAN_BADGE[w.plan])}>{w.plan}</span>
            },
            { key: 'membersCount', header: 'Members', render: (w) => <span className="text-sm">{w.membersCount}</span> },
            { key: 'createdAt', header: 'Created', render: (w) => <span className="text-sm text-surface-500">{formatDate(w.createdAt)}</span> },
            {
              key: 'actions', header: '', align: 'right',
              render: () => (
                <div className="flex items-center gap-1 justify-end">
                  <button className="btn-ghost btn-sm w-7 h-7"><Edit3 size={13} /></button>
                  <button className="btn-ghost btn-sm w-7 h-7 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={13} /></button>
                </div>
              )
            },
          ]}
          data={filtered}
          keyExtractor={w => w.id}
        />
      </div>
    </div>
  );
};

// ─── Users Admin ──────────────────────────────────────────────────────────────
export const AdminUsersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [editForm, setEditForm] = useState({
    role: 'team_member' as Role,
    jobTitle: '',
    department: '',
    isActive: true,
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'team_member' as Role,
    jobTitle: '',
    department: '',
  });
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const { users, addUser, bootstrap } = useAppStore();

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const ROLES: { value: Role | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    // { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'team_leader', label: 'Team Leader' },
    { value: 'team_member', label: 'Member' },
  ];

  const CREATE_ROLE_OPTIONS: Role[] = ['admin', 'manager', 'team_leader', 'team_member'];

  const handleCreateChange = (field: keyof typeof createForm, value: string) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      role: 'team_member',
      jobTitle: '',
      department: '',
    });
    setCreateError('');
    setIsCreating(false);
  };

  useEffect(() => {
    if (!selectedUser) return;
    setEditForm({
      role: selectedUser.role,
      jobTitle: selectedUser.jobTitle || '',
      department: selectedUser.department || '',
      isActive: selectedUser.isActive,
    });
  }, [selectedUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreating(true);
    try {
      const res = await usersService.create(createForm);
      addUser(res.data.data ?? res.data);
      setCreateOpen(false);
      resetCreateForm();
    } catch (error: any) {
      setCreateError(error?.response?.data?.error?.message || error?.response?.data?.message || 'Failed to create user');
      setIsCreating(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setIsSavingUser(true);
    try {
      await usersService.update(selectedUser.id, editForm);
      await bootstrap();
      setSelectedUser(null);
    } catch {
      // shared interceptor shows the error
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await usersService.delete(userId);
      await bootstrap();
      if (selectedUser?.id === userId) setSelectedUser(null);
    } catch {
      // shared interceptor shows the error
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title text-2xl sm:text-3xl">Users</h1>
          <p className="page-subtitle text-xs sm:text-sm">{users.length} users across all workspaces</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary btn-md w-full sm:w-auto"><Plus size={16} /> Create New User</button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="input pl-9 w-full" />
        </div>
        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1 flex-wrap">
          {ROLES.map(r => (
            <button key={r.value} onClick={() => setRoleFilter(r.value)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                roleFilter === r.value ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm' : 'text-surface-500')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table
          columns={[
            {
              key: 'name', header: 'User',
              render: (u) => (
                <div className="flex items-center gap-3">
                  <UserAvatar name={u.name} color={u.color} size="sm" isOnline={u.isActive} />
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200 text-sm">{u.name}</p>
                    <p className="text-xs text-surface-400">{u.email}</p>
                  </div>
                </div>
              )
            },
            {
              key: 'role', header: 'Role',
              render: (u) => {
                const cfg = ROLE_CONFIG[u.role];
                return <span className={cn('badge text-xs', cfg.bg, cfg.color)}>{cfg.label}</span>;
              }
            },
            { key: 'jobTitle', header: 'Title', render: (u) => <span className="text-sm text-surface-500">{u.jobTitle || '—'}</span> },
            {
              key: 'isActive', header: 'Status',
              render: (u) => (
                <span className={cn('badge text-xs', u.isActive ? 'badge-green' : 'badge-gray')}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
              )
            },
            { key: 'createdAt', header: 'Joined', render: (u) => <span className="text-xs text-surface-400">{formatDate(u.createdAt)}</span> },
            {
              key: 'actions', header: '', align: 'right',
              render: (u) => (
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => setSelectedUser(u)} className="btn-ghost btn-sm w-7 h-7"><Edit3 size={13} /></button>
                  <button onClick={() => { void handleDeleteUser(u.id); }} className="btn-ghost btn-sm w-7 h-7 text-rose-400 hover:bg-rose-50"><Trash2 size={13} /></button>
                </div>
              )
            },
          ]}
          data={filtered}
          keyExtractor={u => u.id}
          onRowClick={setSelectedUser}
        />
      </div>

      {/* User Edit Modal */}
      <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title="Edit User" size="md">
        {selectedUser && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-xl">
              <UserAvatar name={selectedUser.name} color={selectedUser.color} size="md" />
              <div>
                <p className="font-medium text-surface-800 dark:text-surface-200">{selectedUser.name}</p>
                <p className="text-xs text-surface-400">{selectedUser.email}</p>
              </div>
            </div>
            <div>
              <label className="label">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value as Role }))} className="input">
                {Object.entries(ROLE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Job Title</label>
              <input value={editForm.jobTitle} onChange={e => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Department</label>
              <input value={editForm.department} onChange={e => setEditForm(prev => ({ ...prev, department: e.target.value }))} className="input" />
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-xl">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Account Status</p>
                <p className="text-xs text-surface-400">{editForm.isActive ? 'Currently active' : 'Account disabled'}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={cn('relative w-10 h-6 rounded-full transition-colors', editForm.isActive ? 'bg-brand-600' : 'bg-surface-200')}
              >
                <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform', editForm.isActive ? 'left-5' : 'left-1')} />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelectedUser(null)} className="btn-secondary btn-md flex-1">Cancel</button>
              <button onClick={() => { void handleSaveUser(); }} disabled={isSavingUser} className="btn-primary btn-md flex-1">{isSavingUser ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetCreateForm();
        }}
        title="Create User"
        description="Add a new user to the current company workspace."
        size="md"
      >
        <form onSubmit={handleCreateUser} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Full Name</label>
              <input value={createForm.name} onChange={e => handleCreateChange('name', e.target.value)} className="input" placeholder="Enter full name" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Email</label>
              <input type="email" value={createForm.email} onChange={e => handleCreateChange('email', e.target.value)} className="input" placeholder="name@company.com" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Temporary Password</label>
              <input type="password" minLength={8} value={createForm.password} onChange={e => handleCreateChange('password', e.target.value)} className="input" placeholder="Minimum 8 characters" required />
            </div>
            <div>
              <label className="label">Role</label>
              <select value={createForm.role} onChange={e => handleCreateChange('role', e.target.value)} className="input">
                {CREATE_ROLE_OPTIONS.map(role => (
                  <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Job Title</label>
              <input value={createForm.jobTitle} onChange={e => handleCreateChange('jobTitle', e.target.value)} className="input" placeholder="e.g. Product Manager" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Department</label>
              <input value={createForm.department} onChange={e => handleCreateChange('department', e.target.value)} className="input" placeholder="e.g. Operations" />
            </div>
          </div>

          {createError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {createError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
              className="btn-secondary btn-md flex-1"
            >
              Cancel
            </button>
            <button type="submit" disabled={isCreating} className="btn-primary btn-md flex-1">
              {isCreating ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ─── Permissions Admin ────────────────────────────────────────────────────────
export const AdminPermissionsPage: React.FC = () => {
  const PERMISSIONS = [
    { key: 'createProjects', label: 'Create Projects', description: 'Can create new projects in the workspace' },
    { key: 'deleteProjects', label: 'Delete Projects', description: 'Can permanently delete projects' },
    { key: 'manageUsers', label: 'Manage Users', description: 'Can invite, edit, and remove users' },
    { key: 'viewReports', label: 'View Reports', description: 'Access to analytics and reports' },
    { key: 'manageBilling', label: 'Manage Billing', description: 'Can view and update billing info' },
    { key: 'exportData', label: 'Export Data', description: 'Can export workspace data' },
    { key: 'manageSettings', label: 'Manage Settings', description: 'Can edit workspace-level settings' },
    { key: 'createTeams', label: 'Create Teams', description: 'Can create and manage teams' },
  ] as const;

  const ROLES: Role[] = ['super_admin', 'admin', 'manager', 'team_leader', 'team_member'];
  const DEFAULT_PERMISSIONS: Record<string, Partial<Record<Role, boolean>>> = {
    createProjects: { super_admin: true, admin: true, manager: true, team_leader: false, team_member: false },
    deleteProjects: { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
    manageUsers: { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
    viewReports: { super_admin: true, admin: true, manager: true, team_leader: true, team_member: false },
    manageBilling: { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
    exportData: { super_admin: true, admin: true, manager: true, team_leader: false, team_member: false },
    manageSettings: { super_admin: true, admin: true, manager: false, team_leader: false, team_member: false },
    createTeams: { super_admin: true, admin: true, manager: true, team_leader: false, team_member: false },
  };

  const { workspaces, bootstrap } = useAppStore();
  const workspace = workspaces[0];
  const [permissionMap, setPermissionMap] = useState<Record<string, Partial<Record<Role, boolean>>>>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const storedPermissions = workspace?.settings?.permissions;
  const effectivePermissions = useMemo(
    () => PERMISSIONS.reduce<Record<string, Partial<Record<Role, boolean>>>>((acc, permission) => {
      acc[permission.key] = {
        ...DEFAULT_PERMISSIONS[permission.key],
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

  const resetDefaults = () => {
    setPermissionMap(PERMISSIONS.reduce<Record<string, Partial<Record<Role, boolean>>>>((acc, permission) => {
      acc[permission.key] = { ...DEFAULT_PERMISSIONS[permission.key] };
      return acc;
    }, {}));
    setMessage('Permission matrix reset to default values. Save to apply.');
  };

  const savePermissions = async () => {
    if (!workspace?.id) return;
    setSaving(true);
    setMessage('');
    try {
      await workspacesService.update(workspace.id, {
        settings: {
          ...(workspace.settings || {}),
          permissions: permissionMap,
        },
      });
      await bootstrap();
      setMessage('Permissions updated successfully.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message || 'Failed to update permissions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><Shield size={24} /> Permissions</h1>
          <p className="page-subtitle">Configure role-based access control for your workspace</p>
          {workspace && <p className="mt-1 text-xs text-surface-400">Workspace: {workspace.name}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={resetDefaults} className="btn-secondary btn-md">Reset Defaults</button>
          <button onClick={savePermissions} disabled={!workspace?.id || saving || !hasChanges} className="btn-primary btn-md">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:bg-surface-800/60">
          {message}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Editing Mode</p>
          <p className="mt-1 text-xs text-surface-400">
            Click any role cell to allow or deny that permission. Changes are stored on the current workspace.
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Unsaved Changes</p>
          <p className="mt-1 text-xs text-surface-400">{hasChanges ? 'You have unsaved permission edits.' : 'All permission changes are saved.'}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider w-72">Permission</th>
                {ROLES.map(role => (
                  <th key={role} className="px-4 py-3 text-center text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    <span className={cn('badge text-[10px]', ROLE_CONFIG[role].bg, ROLE_CONFIG[role].color)}>
                      {ROLE_CONFIG[role].label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50 dark:divide-surface-800/50">
              {PERMISSIONS.map((perm, pi) => (
                <motion.tr
                  key={perm.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: pi * 0.03 }}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                >
                  <td className="px-5 py-3.5 align-top">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{perm.label}</p>
                    <p className="text-xs text-surface-400">{perm.description}</p>
                  </td>
                  {ROLES.map((role) => {
                    const allowed = Boolean(permissionMap[perm.key]?.[role]);
                    return (
                      <td key={role} className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(perm.key, role)}
                          className={cn(
                            'mx-auto flex h-9 w-9 items-center justify-center rounded-full border transition-all',
                            allowed
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/30'
                              : 'border-surface-200 bg-surface-50 text-surface-400 dark:border-surface-700 dark:bg-surface-800'
                          )}
                          aria-label={`${allowed ? 'Disable' : 'Enable'} ${perm.label} for ${ROLE_CONFIG[role].label}`}
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

// ─── Billing Admin ────────────────────────────────────────────────────────────
export const AdminBillingPage: React.FC = () => {
  const PLANS = [
    {
      name: 'Free', price: '$0', period: 'forever', color: '#8896b8',
      features: ['Up to 3 projects', '5 members', '1GB storage', 'Basic analytics'],
      current: false,
    },
    {
      name: 'Pro', price: '$12', period: 'per seat/month', color: '#3366ff',
      features: ['Unlimited projects', '50 members', '50GB storage', 'Advanced analytics', 'Priority support'],
      current: true,
    },
    {
      name: 'Enterprise', price: 'Custom', period: 'contact sales', color: '#7c3aed',
      features: ['Unlimited everything', 'SSO/SAML', 'Custom roles', 'SLA guarantee', 'Dedicated support'],
      current: false,
    },
  ];

  const INVOICES = [
    { id: 'INV-001', date: '2025-01-01', amount: '$288.00', status: 'paid' },
    { id: 'INV-002', date: '2024-12-01', amount: '$288.00', status: 'paid' },
    { id: 'INV-003', date: '2024-11-01', amount: '$264.00', status: 'paid' },
    { id: 'INV-004', date: '2024-10-01', amount: '$264.00', status: 'paid' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><CreditCard size={24} /> Billing</h1>
        <p className="page-subtitle">Manage your subscription and payment methods</p>
      </div>

      {/* Current plan banner */}
      <div className="card p-5 mb-6 bg-gradient-to-r from-brand-600 to-brand-800 border-0 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* <div>
            <p className="text-brand-200 text-sm mb-1">Current plan</p>
            <h2 className="font-display font-bold text-2xl">Pro Plan</h2>
            <p className="text-brand-200 text-sm mt-1">24 seats · Renews Feb 1, 2025</p>
          </div> */}
          <div className="text-right">
            <p className="font-display font-bold text-3xl">$288</p>
            <p className="text-brand-200 text-sm">/month</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button className="bg-white text-brand-700 btn btn-sm px-4 font-semibold rounded-xl hover:bg-brand-50">Upgrade to Enterprise</button>
          <button className="btn-ghost text-white hover:bg-white/10 btn-sm">Manage seats</button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map(plan => (
          <motion.div key={plan.name} whileHover={{ y: -2 }} className={cn('card p-5 relative', plan.current && 'ring-2 ring-brand-500')}>
            {plan.current && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 badge-blue text-[10px] font-bold uppercase tracking-wider">
                Current Plan
              </span>
            )}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: `${plan.color}18` }}>
              <Zap size={18} style={{ color: plan.color }} />
            </div>
            <h3 className="font-display font-bold text-surface-900 dark:text-white">{plan.name}</h3>
            <div className="my-2">
              <span className="font-display font-bold text-2xl text-surface-900 dark:text-white">{plan.price}</span>
              <span className="text-xs text-surface-400 ml-1">{plan.period}</span>
            </div>
            <div className="space-y-2 mb-4">
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <CheckCircle size={13} style={{ color: plan.color }} className="flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <button
              className={cn('w-full btn btn-sm rounded-xl', plan.current ? 'btn-secondary opacity-60 cursor-default' : 'btn-primary')}
              style={!plan.current ? { backgroundColor: plan.color } : {}}
              disabled={plan.current}
            >
              {plan.current ? 'Current' : 'Switch'}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Invoices */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-4">
          <h3 className="font-display font-semibold text-surface-900 dark:text-white">Invoice History</h3>
          <button className="btn-secondary btn-sm text-xs">Download all</button>
        </div>
        <Table
          columns={[
            { key: 'id', header: 'Invoice #', render: inv => <span className="font-mono text-xs text-surface-600 dark:text-surface-400">{inv.id}</span> },
            { key: 'date', header: 'Date', render: inv => <span className="text-sm text-surface-600 dark:text-surface-400">{formatDate(inv.date)}</span> },
            { key: 'amount', header: 'Amount', render: inv => <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{inv.amount}</span> },
            {
              key: 'status', header: 'Status',
              render: inv => <span className={cn('badge text-xs', inv.status === 'paid' ? 'badge-green' : 'badge-amber')}>{inv.status}</span>
            },
            {
              key: 'download', header: '', align: 'right',
              render: () => <button className="btn-ghost btn-sm text-xs text-brand-600">Download PDF</button>
            },
          ]}
          data={INVOICES}
          keyExtractor={inv => inv.id}
        />
      </div>
    </div>
  );
};
