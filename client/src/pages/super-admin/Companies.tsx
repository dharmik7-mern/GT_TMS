import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  Plus, Search, LayoutGrid, List, Filter, SortAsc,
  Building2, Users, Calendar, MoreHorizontal, Trash2, Edit3, ShieldAlert
} from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { UserAvatar } from '../../components/UserAvatar';
import { Table, EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useEffect } from 'react';
import { companiesService } from '../../services/api';
import { emitSuccessToast } from '../../context/toastBus';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'trial', label: 'Trial' },
];

const COMPANY_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'badge-green' },
  suspended: { label: 'Suspended', className: 'badge-rose' },
  trial: { label: 'Trial', className: 'badge-amber' },
};

interface Company {
  id: string;
  tenantId?: string;
  organizationId?: string;
  databaseName?: string;
  name: string;
  email: string;
  usersCount: number;
  projectsCount: number;
  status: 'active' | 'suspended' | 'trial';
  createdAt: string;
  color: string;
}

type CompanyCreateForm = {
  name: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  initialUserLimit: number;
  status: 'active' | 'suspended' | 'trial';
};

const EMPTY_COMPANY_FORM: CompanyCreateForm = {
  name: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  initialUserLimit: 50,
  status: 'active',
};

export const CompaniesPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CompanyCreateForm>({
    defaultValues: EMPTY_COMPANY_FORM,
  });

  useEffect(() => {
    companiesService.getAll().then((r) => setCompanies(r.data.data ?? r.data)).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!showModal) return;

    if (selectedCompany) {
      reset({
        name: selectedCompany.name,
        adminName: '',
        adminEmail: selectedCompany.email,
        adminPassword: '',
        initialUserLimit: selectedCompany.usersCount || 50,
        status: selectedCompany.status,
      });
      return;
    }

    reset(EMPTY_COMPANY_FORM);
  }, [showModal, selectedCompany, reset]);

  const filtered = companies.filter(c => {
    const name = c.name || '';
    const email = c.email || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const onSubmitCompany = async (data: CompanyCreateForm) => {
    setSaving(true);

    try {
      if (selectedCompany) {
        const res = await companiesService.update(selectedCompany.id, {
          name: data.name,
          adminEmail: data.adminEmail,
          status: data.status,
        });
        const updated = res.data.data ?? res.data;
        setCompanies((prev) => prev.map((company) => (company.id === updated.id ? updated : company)));
        emitSuccessToast('Company details updated successfully.', 'Company Updated');
      } else {
        const res = await companiesService.create({
          name: data.name,
          adminName: data.adminName,
          adminEmail: data.adminEmail,
          adminPassword: data.adminPassword,
          initialUserLimit: data.initialUserLimit,
          status: data.status,
        });
        const created = res.data.data ?? res.data;
        setCompanies((prev) => [created, ...prev]);
        emitSuccessToast('Company created successfully.', 'Company Added');
      }

      setShowModal(false);
      setSelectedCompany(null);
      reset(EMPTY_COMPANY_FORM);
    } catch {
      // Errors are surfaced by the shared API toast interceptor.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">{companies.length} total companies registered on the platform</p>
        </div>
        <button onClick={() => { setSelectedCompany(null); setShowModal(true); }} className="btn-primary btn-md">
          <Plus size={16} />
          Add Company
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="input pl-9"
          />
        </div>

        <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                statusFilter === f.value
                  ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <Table
          columns={[
            {
              key: 'name', header: 'Company Name',
              render: (c: Company) => (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: c.color || '#3366ff' }}>
                    {c.name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-surface-900 dark:text-white text-sm">{c.name}</p>
                    <p className="text-xs text-surface-400">{c.organizationId || 'ORG pending'} · {c.email}</p>
                  </div>
                </div>
              )
            },
            { key: 'usersCount', header: 'Users', render: (c: Company) => <span className="text-sm font-medium">{c.usersCount}</span> },
            { key: 'projectsCount', header: 'Projects', render: (c: Company) => <span className="text-sm text-surface-500">{c.projectsCount}</span> },
            {
              key: 'status', header: 'Status',
              render: (c: Company) => {
                const status = c.status || 'active';
                const badge = COMPANY_STATUS_BADGES[status] || COMPANY_STATUS_BADGES.active;
                return <span className={cn('badge text-[10px]', badge.className)}>{badge.label}</span>;
              }
            },
            { key: 'createdAt', header: 'Created At', render: (c: Company) => <span className="text-xs text-surface-400">{formatDate(c.createdAt)}</span> },
            {
              key: 'actions', header: '', align: 'right',
              render: (c: Company) => (
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => navigate(`/companies/${c.id}`)} className="p-1.5 text-surface-400 hover:text-brand-600 transition-colors" title="View Details">
                    <Search size={14} />
                  </button>
                  <button onClick={() => { setSelectedCompany(c); setShowModal(true); }} className="p-1.5 text-surface-400 hover:text-brand-600 transition-colors" title="Edit Company">
                    <Edit3 size={14} />
                  </button>
                  <button className="p-1.5 text-surface-400 hover:text-rose-500 transition-colors" title="Suspend Company">
                    <ShieldAlert size={14} />
                  </button>
                </div>
              )
            }
          ]}
          data={filtered}
          keyExtractor={c => c.id}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setSelectedCompany(null); }} title={selectedCompany ? "Edit Company" : "Add Company"} size="md">
        <form onSubmit={handleSubmit(onSubmitCompany)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company Name *</label>
              <input
                {...register('name', { required: 'Company name is required' })}
                className={cn('input', errors.name && 'border-rose-400')}
                placeholder="Gitakshmi"
              />
            </div>

            {!selectedCompany ? (
              <div className="col-span-2">
                <label className="label">Admin Full Name *</label>
                <input
                  {...register('adminName', { required: 'Admin name is required' })}
                  className={cn('input', errors.adminName && 'border-rose-400')}
                  placeholder="Enter Your Full Name"
                />
              </div>
            ) : null}

            <div className="col-span-2">
              <label className="label">Admin Email *</label>
              <input
                {...register('adminEmail', { required: 'Admin email is required' })}
                className={cn('input', errors.adminEmail && 'border-rose-400')}
                placeholder="Enter User's Company Email"
              />
            </div>

            {!selectedCompany ? (
              <div className="col-span-2">
                <label className="label">Admin Password *</label>
                <input
                  {...register('adminPassword', { required: 'Password is required', minLength: { value: 4, message: 'Min 4 characters' } })}
                  className={cn('input', errors.adminPassword && 'border-rose-400')}
                  placeholder="Create a strong password"
                  type="password"
                />
              </div>
            ) : null}

            {!selectedCompany ? (
              <div>
                <label className="label">Initial User Limit</label>
                <input
                  type="number"
                  {...register('initialUserLimit', { valueAsNumber: true, min: 1 })}
                  className="input"
                  defaultValue={50}
                />
              </div>
            ) : null}

            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input" defaultValue="active">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setSelectedCompany(null); }} className="btn-secondary btn-md flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary btn-md flex-1">
              {saving ? (selectedCompany ? 'Saving...' : 'Registering...') : (selectedCompany ? 'Save Changes' : 'Register Company')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CompaniesPage;
