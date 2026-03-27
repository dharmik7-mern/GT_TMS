import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter, History, Search, Terminal, User, Zap } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Table } from '../../components/ui';
import { useAuthStore } from '../../context/authStore';
import { activityService } from '../../services/api';
import { cn, formatDate, formatRelativeTime } from '../../utils/helpers';

type LogActor = {
  id: string;
  name: string;
  email?: string;
  role?: string;
} | null;

type ActivityLogRow = {
  id: string;
  type: string;
  description: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user: LogActor;
};

const ROLE_PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  super_admin: {
    title: 'Platform Audit Logs',
    subtitle: 'Platform-wide workspace activity visible to your current company and workspace scope.',
  },
  admin: {
    title: 'Workspace Audit Logs',
    subtitle: 'Track operational changes across your workspace, teams, projects, and tasks.',
  },
  manager: {
    title: 'Manager Activity Logs',
    subtitle: 'Review recent workspace activity relevant to project and task coordination.',
  },
  team_leader: {
    title: 'Team Leader Activity Logs',
    subtitle: 'Monitor updates made across the teams, projects, and tasks you oversee.',
  },
};

const TIME_FILTERS = [
  { label: 'Last 24 Hours', value: 1 },
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'All Time', value: 0 },
];

const LOG_TYPE_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  update: 'bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400',
  delete: 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400',
  info: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
};

const LOG_SUMMARY_CARDS: Array<{
  label: string;
  value: 'all' | 'create' | 'update' | 'delete' | 'info';
  color: string;
}> = [
  { label: 'Visible Logs', value: 'all', color: 'text-surface-700' },
  { label: 'Created', value: 'create', color: 'text-emerald-600' },
  { label: 'Updated', value: 'update', color: 'text-brand-600' },
  { label: 'Deleted', value: 'delete', color: 'text-rose-600' },
  { label: 'Info', value: 'info', color: 'text-surface-500' },
];

function normalizeType(type: string) {
  const v = String(type || '').toLowerCase();
  if (v.includes('create')) return 'create';
  if (v.includes('update')) return 'update';
  if (v.includes('delete') || v.includes('remove')) return 'delete';
  return 'info';
}

function titleize(value: string) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildCsv(rows: ActivityLogRow[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['Timestamp', 'Actor', 'Role', 'Action Type', 'Entity', 'Description'];
  const lines = rows.map((row) => [
    row.createdAt,
    row.user?.name || 'Unknown',
    row.user?.role || '',
    row.type,
    row.entityType,
    row.description,
  ]);

  return [header, ...lines].map((line) => line.map(escape).join(',')).join('\n');
}

export const LogsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(() => {
    const incoming = searchParams.get('type');
    return ['all', 'create', 'update', 'delete', 'info'].includes(incoming || '') ? (incoming || 'all') : 'all';
  });
  const [moduleFilter, setModuleFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState<number>(1);
  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    activityService.list({ limit: 250, days: daysFilter || undefined })
      .then((res) => {
        if (!active) return;
        const data = res.data?.data ?? res.data ?? [];
        const rows = Array.isArray(data) ? data : [];
        setLogs(rows);
        setSelectedLog((current) => {
          if (!current) return rows[0] || null;
          return rows.find((item) => item.id === current.id) || rows[0] || null;
        });
      })
      .catch(() => {
        if (!active) return;
        setLogs([]);
        setSelectedLog(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [daysFilter]);

  const roleCopy = ROLE_PAGE_COPY[user?.role || 'admin'] || ROLE_PAGE_COPY.admin;

  const modules = useMemo(() => {
    return [...new Set(logs.map((item) => item.entityType).filter(Boolean))];
  }, [logs]);

  const queryFilteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((item) => {
      const matchesQuery = !query || [
        item.description,
        item.type,
        item.entityType,
        item.user?.name,
        item.user?.email,
        item.user?.role,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      const matchesModule = moduleFilter === 'all' || item.entityType === moduleFilter;

      return matchesQuery && matchesModule;
    });
  }, [logs, search, moduleFilter]);

  const summary = useMemo(() => {
    return queryFilteredLogs.reduce((acc, item) => {
      acc.total += 1;
      acc[normalizeType(item.type)] += 1;
      return acc;
    }, { total: 0, create: 0, update: 0, delete: 0, info: 0 });
  }, [queryFilteredLogs]);

  const filteredLogs = useMemo(() => {
    return queryFilteredLogs.filter((item) => {
      const normalizedType = normalizeType(item.type);
      return typeFilter === 'all' || normalizedType === typeFilter;
    });
  }, [queryFilteredLogs, typeFilter]);

  useEffect(() => {
    setSelectedLog((current) => {
      if (!filteredLogs.length) return null;
      if (!current) return filteredLogs[0];
      return filteredLogs.find((item) => item.id === current.id) || filteredLogs[0];
    });
  }, [filteredLogs]);

  useEffect(() => {
    const next = typeFilter === 'all' ? null : typeFilter;
    const current = searchParams.get('type');
    if ((current || null) === next) return;
    const updatedParams = new URLSearchParams(searchParams);
    if (next) updatedParams.set('type', next);
    else updatedParams.delete('type');
    setSearchParams(updatedParams, { replace: true });
  }, [searchParams, setSearchParams, typeFilter]);

  const exportLogs = () => {
    const csv = buildCsv(filteredLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex max-w-full flex-col gap-6">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{roleCopy.title}</h1>
          <p className="page-subtitle">{roleCopy.subtitle}</p>
        </div>
        <button className="btn-secondary btn-md" onClick={exportLogs} disabled={filteredLogs.length === 0}>
          <Download size={15} /> Export Logs
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {LOG_SUMMARY_CARDS.map((item) => {
          const count =
            item.value === 'all' ? summary.total :
            item.value === 'create' ? summary.create :
            item.value === 'update' ? summary.update :
            item.value === 'delete' ? summary.delete :
            summary.info;
          const isActive = typeFilter === item.value;

          return (
          <button
            key={item.label}
            type="button"
            onClick={() => setTypeFilter(item.value)}
            className={cn(
              'card p-4 text-left transition-all border',
              isActive
                ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/40 shadow-card-hover'
                : 'border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">{item.label}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className={cn('text-2xl font-semibold', item.color)}>{count}</p>
              <span className={cn('text-xs font-medium', isActive ? 'text-brand-600 dark:text-brand-300' : 'text-surface-400')}>
                {isActive ? 'Showing' : 'View'}
              </span>
            </div>
          </button>
        )})}
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs, users, modules..."
              className="input pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-600">
              <Filter size={15} className="text-surface-400" />
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="bg-transparent outline-none">
                <option value="all">All modules</option>
                {modules.map((module) => (
                  <option key={module} value={module}>{titleize(module)}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-600">
              <History size={15} className="text-surface-400" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-transparent outline-none">
                <option value="all">All types</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="info">Info</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-surface-600">
              <Zap size={15} className="text-surface-400" />
              <select value={String(daysFilter)} onChange={(e) => setDaysFilter(Number(e.target.value))} className="bg-transparent outline-none">
                {TIME_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="card overflow-hidden">
          <Table<ActivityLogRow>
            loading={loading}
            data={filteredLogs}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => setSelectedLog(item)}
            emptyMessage="No activity logs found for the selected filters."
            columns={[
              {
                key: 'createdAt',
                header: 'Time',
                render: (item) => (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-surface-900 dark:text-white">{formatDate(item.createdAt, 'HH:mm:ss')}</span>
                    <span className="text-[10px] text-surface-400">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                ),
              },
              {
                key: 'user',
                header: 'Actor',
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-surface-400" />
                    <div className="min-w-0">
                      <div className="truncate text-sm text-surface-700 dark:text-surface-300">{item.user?.name || 'Unknown user'}</div>
                      <div className="truncate text-[10px] text-surface-400">{titleize(item.user?.role || 'unknown')}</div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                render: (item) => {
                  const normalizedType = normalizeType(item.type);
                  return (
                    <span className={cn('inline-flex rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider', LOG_TYPE_COLORS[normalizedType])}>
                      {titleize(normalizedType)}
                    </span>
                  );
                },
              },
              {
                key: 'module',
                header: 'Module',
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-brand-500" />
                    <span className="text-xs text-surface-500">{titleize(item.entityType)}</span>
                  </div>
                ),
              },
              {
                key: 'description',
                header: 'Description',
                render: (item) => <span className="line-clamp-2 text-sm text-surface-700 dark:text-surface-300">{item.description}</span>,
              },
              {
                key: 'details',
                header: '',
                align: 'right',
                render: (item) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedLog(item);
                    }}
                    className="p-1.5 text-surface-400 transition-colors hover:text-brand-600"
                  >
                    <Terminal size={14} />
                  </button>
                ),
              },
            ]}
          />
        </div>

        <div className="card p-5">
          <h3 className="font-display font-semibold text-surface-900 dark:text-white">Log Details</h3>

          {!selectedLog ? (
            <p className="mt-4 text-sm text-surface-400">Select a log row to inspect its details.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/50">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Description</p>
                <p className="mt-2 text-sm text-surface-700 dark:text-surface-300">{selectedLog.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Actor</p>
                  <p className="mt-2 text-sm font-medium text-surface-800 dark:text-surface-200">{selectedLog.user?.name || 'Unknown user'}</p>
                  <p className="mt-1 text-xs text-surface-400">{selectedLog.user?.email || titleize(selectedLog.user?.role || 'unknown')}</p>
                </div>

                <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Type</p>
                  <p className="mt-2 text-sm font-medium text-surface-800 dark:text-surface-200">{titleize(selectedLog.type)}</p>
                  <p className="mt-1 text-xs text-surface-400">{formatDate(selectedLog.createdAt, 'MMM d, yyyy HH:mm:ss')}</p>
                </div>

                <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Entity</p>
                  <p className="mt-2 text-sm font-medium text-surface-800 dark:text-surface-200">{titleize(selectedLog.entityType)}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-surface-400">{selectedLog.entityId}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Metadata</p>
                <pre className="mt-3 max-h-[280px] overflow-auto rounded-xl bg-[#0f172a] p-3 text-xs leading-6 text-slate-100">
{JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
