import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { UserPlus, Search, Edit3, ShieldAlert, Trash2 } from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { ROLE_CONFIG } from '../../app/constants';
import { UserAvatar } from '../../components/UserAvatar';
import { Table } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { useAppStore } from '../../context/appStore';
import { companiesService, usersService } from '../../services/api';
import { emitSuccessToast } from '../../context/toastBus';

const ROLES = [
  { value: 'all', label: 'All Roles' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'team_leader', label: 'Lead' },
  { value: 'team_member', label: 'Member' },
];

export const UsersPage: React.FC = () => {
  const { users, addUser, bootstrap } = useAppStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    name: string;
    email: string;
    password: string;
    companyId: string;
    role: 'super_admin' | 'admin' | 'manager' | 'team_leader' | 'team_member';
    sendCredentialsEmail: boolean;
  }>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      companyId: '',
      role: 'team_member',
      sendCredentialsEmail: true,
    },
  });

  useEffect(() => {
    companiesService
      .getAll()
      .then((response) => {
        const items = response.data.data ?? response.data ?? [];
        setCompanies(items.map((company: any) => ({ id: company.id, name: company.name })));
      })
      .catch(() => {
        setCompanies([]);
      });
  }, []);

  useEffect(() => {
    if (!showModal) return;

    if (selectedUser) {
      reset({
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        password: '',
        companyId: selectedUser.tenantId || selectedUser.companyId || companies[0]?.id || '',
        role: selectedUser.role || 'team_member',
        sendCredentialsEmail: true,
      });
      return;
    }

    reset({
      name: '',
      email: '',
      password: '',
      companyId: companies[0]?.id || '',
      role: 'team_member',
      sendCredentialsEmail: true,
    });
  }, [companies, reset, selectedUser, showModal]);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const onSubmitUser = async (data: { name: string; email: string; password: string; companyId: string; role: 'super_admin' | 'admin' | 'manager' | 'team_leader' | 'team_member'; sendCredentialsEmail: boolean }) => {
    setSaving(true);
    try {
      if (selectedUser) {
        await usersService.update(selectedUser.id, {
          name: data.name,
          email: data.email,
          role: data.role,
          isActive: selectedUser.isActive !== false,
        });
        emitSuccessToast('User updated successfully.', 'User Updated');
      } else {
        const response = await usersService.create({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          companyId: data.companyId || undefined,
          sendCredentialsEmail: data.sendCredentialsEmail,
        });
        const createdUser = response.data.data ?? response.data;
        addUser(createdUser);
        emitSuccessToast('User created successfully.', 'User Added');
      }

      await bootstrap();
      setShowModal(false);
      setSelectedUser(null);
      reset({
        name: '',
        email: '',
        password: '',
        companyId: companies[0]?.id || '',
        role: 'team_member',
        sendCredentialsEmail: true,
      });
    } catch {
      // Shared API interceptor handles error toasts.
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      await usersService.update(user.id, { isActive: !user.isActive });
      await bootstrap();
      emitSuccessToast(user.isActive ? 'User blocked successfully.' : 'User reactivated successfully.', user.isActive ? 'User Blocked' : 'User Activated');
    } catch {
      // Shared API interceptor handles error toasts.
    }
  };

  const handleDeleteUser = async (user: any) => {
    const confirmed = window.confirm(`Delete user "${user.name}" permanently?`);
    if (!confirmed) return;

    try {
      await usersService.delete(user.id);
      await bootstrap();
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
        setShowModal(false);
      }
      emitSuccessToast('User deleted successfully.', 'User Deleted');
    } catch {
      // Shared API interceptor handles error toasts.
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{users.length} total users across the platform</p>
        </div>
        <button className="btn-primary btn-md" onClick={() => { setSelectedUser(null); setShowModal(true); }}>
          <UserPlus size={16} />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="input pl-9"
          />
        </div>

        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1 flex-wrap">
          {ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setRoleFilter(r.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                roleFilter === r.value
                  ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              )}
            >
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
              render: (u: any) => (
                <div className="flex items-center gap-3">
                  <UserAvatar name={u.name} color={u.color} size="sm" isOnline={u.isActive} />
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white text-sm">{u.name}</p>
                    <p className="text-xs text-surface-400">{u.email}</p>
                  </div>
                </div>
              )
            },
            {
              key: 'company', header: 'Company',
              render: (u: any) => {
                const companyName = companies.find((company) => company.id === (u.tenantId || u.companyId))?.name || 'Unknown company';
                return <span className="text-sm font-medium">{companyName}</span>;
              }
            },
            {
              key: 'role', header: 'Role',
              render: (u: any) => {
                const cfg = (ROLE_CONFIG as any)[u.role];
                return <span className={cn('badge text-[10px]', cfg.bg, cfg.color)}>{cfg.label}</span>;
              }
            },
            {
              key: 'status', header: 'Status',
              render: (u: any) => (
                <span className={cn('badge text-[10px]', u.isActive ? 'badge-green' : 'badge-rose')}>
                  {u.isActive ? 'Active' : 'Blocked'}
                </span>
              )
            },
            { key: 'createdAt', header: 'Created', render: (u: any) => <span className="text-xs text-surface-400">{formatDate(u.createdAt)}</span> },
            {
              key: 'actions', header: 'Actions', align: 'right', width: '148px',
              render: (u: any) => (
                <div className="flex items-center justify-end gap-3 whitespace-nowrap pr-1">
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(u); setShowModal(true); }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-sm hover:bg-brand-100 transition-colors"
                    title="Edit User"
                    aria-label={`Edit ${u.name}`}
                  >
                    <Edit3 size={18} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleToggleActive(u); }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-sm hover:bg-amber-100 transition-colors"
                    title={u.isActive ? 'Block User' : 'Activate User'}
                    aria-label={`${u.isActive ? 'Block' : 'Activate'} ${u.name}`}
                  >
                    <ShieldAlert size={18} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleDeleteUser(u); }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-sm hover:bg-rose-100 transition-colors"
                    title="Delete User"
                    aria-label={`Delete ${u.name}`}
                  >
                    <Trash2 size={18} strokeWidth={2.25} />
                  </button>
                </div>
              )
            }
          ]}
          data={filtered}
          keyExtractor={u => u.id}
        />
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setSelectedUser(null); }} title={selectedUser ? "Edit User" : "Add User"} size="md">
        <form onSubmit={handleSubmit(onSubmitUser)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input
                {...register('name', { required: 'Full name is required' })}
                className={cn('input', errors.name && 'border-rose-400')}
                placeholder="e.g. Dhiren Makwana"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Email Address</label>
              <input
                {...register('email', { required: 'Email is required' })}
                className={cn('input', errors.email && 'border-rose-400')}
                placeholder="e.g. yourname@example.com"
              />
            </div>
            {!selectedUser ? (
              <div className="col-span-2">
                <label className="label">Password</label>
                <input
                  type="password"
                  {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
                  className={cn('input', errors.password && 'border-rose-400')}
                  placeholder="Create a strong password"
                />
              </div>
            ) : null}
            {!selectedUser ? (
              <label className="col-span-2 flex items-start gap-3 rounded-2xl border border-surface-100 px-4 py-3 text-sm text-surface-600 dark:border-surface-800 dark:text-surface-300">
                <input
                  type="checkbox"
                  {...register('sendCredentialsEmail')}
                  className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                />
                <span>Send username and password to this user by email after creation.</span>
              </label>
            ) : null}
            <div className="col-span-2">
              <label className="label">Company</label>
              <select
                {...register('companyId', { required: 'Company is required' })}
                defaultValue={selectedUser?.tenantId || selectedUser?.companyId || ''}
                className={cn('input', errors.companyId && 'border-rose-400')}
                disabled={!!selectedUser}
              >
                <option value="" disabled>{companies.length ? 'Select a company' : 'No companies available'}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Role</label>
              <select {...register('role')} defaultValue={selectedUser?.role || 'team_member'} className="input">
                {ROLES.filter(r => r.value !== 'all').map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                value={selectedUser?.isActive !== false ? 'active' : 'blocked'}
                onChange={(e) => setSelectedUser((prev: any) => prev ? { ...prev, isActive: e.target.value === 'active' } : prev)}
                className="input"
                disabled={!selectedUser}
              >
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            {selectedUser ? (
              <button
                type="button"
                onClick={() => { void handleDeleteUser(selectedUser); }}
                className="btn-danger btn-md"
              >
                Delete User
              </button>
            ) : null}
            <button type="button" onClick={() => { setShowModal(false); setSelectedUser(null); }} className="btn-secondary btn-md flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary btn-md flex-1">
              {selectedUser ? (saving ? 'Saving...' : 'Update User') : saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
