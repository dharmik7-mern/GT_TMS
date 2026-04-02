import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Zap, User, Calendar, CheckCircle2, Upload, Lock, ChevronLeft, ChevronRight, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { cn, formatDate, isDueDateOverdue } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { EmptyState } from '../../components/ui';
import { QuickTaskModal } from '../../components/QuickTaskModal';
import { Modal } from '../../components/Modal';
import { emitSuccessToast } from '../../context/toastBus';
import { quickTasksService } from '../../services/api';
import type { QuickTask, QuickTaskImportResult, QuickTaskImportRow, QuickTaskStatus } from '../../app/types';
import { useNavigate, useSearchParams } from 'react-router-dom';

const QUICK_TASK_IMPORT_TEMPLATE_HEADERS = ['title', 'description', 'priority', 'status', 'assigneeNames', 'reporterName', 'dueDate', 'createdAt', 'updatedAt'];
const QUICK_TASK_IMPORT_HEADER_ALIASES: Record<string, string[]> = {
  title: ['title', 'tasktitle', 'taskname', 'task', 'subject', 'quicktask', 'quicktasktitle'],
  description: ['description', 'details', 'taskdescription', 'remarks', 'comment', 'notes'],
  priority: ['priority', 'severity', 'importance'],
  status: ['status', 'state', 'taskstatus'],
  assigneeEmails: ['assigneeemails', 'assigneeemail', 'assignedtoemail', 'owneremail', 'assigneduseremail'],
  assigneeNames: ['assigneenames', 'assigneename', 'assignedto', 'assignee', 'owner', 'assigneduser', 'assignedusername'],
  reporterEmail: ['reporteremail', 'createdbyemail', 'creatoremail', 'reportedbyemail', 'requestedbyemail', 'taskowneremail'],
  reporterName: ['reportername', 'createdby', 'creator', 'reportedby', 'requestedby', 'reportingperson', 'reportingpersonname'],
  dueDate: ['duedate', 'due', 'deadline', 'targetdate', 'enddate'],
  createdAt: ['createdat', 'createdon', 'createddate', 'taskcreatedat'],
  updatedAt: ['updatedat', 'updatedon', 'lastupdated', 'modifiedat', 'modifiedon'],
};

function normalizeHeader(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePriorityValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'medium';
  if (['low', 'medium', 'high', 'urgent'].includes(normalized)) return normalized;
  return normalized;
}

function normalizeStatusValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'todo';
  if (normalized === 'completed') return 'done';
  if (normalized === 'inprogress') return 'in_progress';
  if (['todo', 'in_progress', 'done'].includes(normalized)) return normalized;
  return normalized;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
}

function parseQuickTasksCsv(content: string) {
  const sanitized = content.replace(/^\uFEFF/, '');
  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [] as QuickTaskImportRow[], parseErrors: ['The file must contain a header row and at least one quick task row.'] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const headerKeyMap = normalizedHeaders.reduce<Record<string, string>>((acc, normalized, index) => {
    acc[normalized] = headers[index];
    return acc;
  }, {});

  const resolveHeader = (canonicalKey: keyof typeof QUICK_TASK_IMPORT_HEADER_ALIASES | 'title') => {
    const aliases = canonicalKey === 'title'
      ? QUICK_TASK_IMPORT_HEADER_ALIASES.title
      : QUICK_TASK_IMPORT_HEADER_ALIASES[canonicalKey];
    return aliases.find((alias) => headerKeyMap[alias]) ? headerKeyMap[aliases.find((alias) => headerKeyMap[alias]) as string] : undefined;
  };

  const mappedHeaders = {
    title: resolveHeader('title'),
    description: resolveHeader('description'),
    priority: resolveHeader('priority'),
    status: resolveHeader('status'),
    assigneeEmails: resolveHeader('assigneeEmails'),
    assigneeNames: resolveHeader('assigneeNames'),
    reporterEmail: resolveHeader('reporterEmail'),
    reporterName: resolveHeader('reporterName'),
    dueDate: resolveHeader('dueDate'),
    createdAt: resolveHeader('createdAt'),
    updatedAt: resolveHeader('updatedAt'),
  };

  const requiredHeaders = ['title'];
  const missingHeaders = requiredHeaders.filter((header) => !mappedHeaders[header as keyof typeof mappedHeaders]);

  if (missingHeaders.length > 0) {
    return { rows: [] as QuickTaskImportRow[], parseErrors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  }

  const rows: QuickTaskImportRow[] = [];
  const parseErrors: string[] = [];
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const validStatuses = ['todo', 'in_progress', 'done'];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});

    const title = mappedHeaders.title ? record[mappedHeaders.title] : '';
    if (!title?.trim()) continue;

    const priority = normalizePriorityValue(mappedHeaders.priority ? record[mappedHeaders.priority] : '');
    const status = normalizeStatusValue(mappedHeaders.status ? record[mappedHeaders.status] : '');

    if (!validPriorities.includes(priority)) {
      parseErrors.push(`Row ${lineIndex + 1}: priority must be one of ${validPriorities.join(', ')}.`);
      continue;
    }

    if (!validStatuses.includes(status)) {
      parseErrors.push(`Row ${lineIndex + 1}: status must be one of ${validStatuses.join(', ')}.`);
      continue;
    }

    rows.push({
      rowNumber: lineIndex + 1,
      title: title.trim(),
      description: mappedHeaders.description ? record[mappedHeaders.description]?.trim() || '' : '',
      priority: priority as QuickTaskImportRow['priority'],
      status: status as QuickTaskStatus,
      assigneeEmails: mappedHeaders.assigneeEmails ? record[mappedHeaders.assigneeEmails]?.trim() || '' : '',
      assigneeNames: mappedHeaders.assigneeNames ? record[mappedHeaders.assigneeNames]?.trim() || '' : '',
      reporterEmail: mappedHeaders.reporterEmail ? record[mappedHeaders.reporterEmail]?.trim().toLowerCase() || '' : '',
      reporterName: mappedHeaders.reporterName ? record[mappedHeaders.reporterName]?.trim() || '' : '',
      dueDate: mappedHeaders.dueDate ? record[mappedHeaders.dueDate]?.trim() || '' : '',
      createdAt: mappedHeaders.createdAt ? record[mappedHeaders.createdAt]?.trim() || '' : '',
      updatedAt: mappedHeaders.updatedAt ? record[mappedHeaders.updatedAt]?.trim() || '' : '',
    });
  }

  return { rows, parseErrors };
}

type ScopeFilter = 'assigned_to_me' | 'created_by_me' | 'all';
type StatusFilter = QuickTaskStatus | 'all' | 'overdue';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: STATUS_CONFIG.todo.label },
  { value: 'in_progress', label: STATUS_CONFIG.in_progress.label },
  { value: 'done', label: STATUS_CONFIG.done.label },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_CARDS: Array<{
  value: StatusFilter;
  label: string;
  tone: string;
}> = [
    { value: 'all', label: 'All Tasks', tone: 'text-surface-900 dark:text-surface-100' },
    { value: 'todo', label: 'To Do', tone: 'text-amber-600 dark:text-amber-300' },
    { value: 'in_progress', label: 'In Progress', tone: 'text-blue-600 dark:text-blue-300' },
    { value: 'done', label: 'Done', tone: 'text-emerald-600 dark:text-emerald-300' },
    { value: 'overdue', label: 'Overdue', tone: 'text-rose-600 dark:text-rose-300' },
  ];

function isOverdue(task: QuickTask) {
  return isDueDateOverdue(task.dueDate, task.status);
}

interface SearchableSelectOption {
  id: string;
  label: string;
  meta?: string;
}

const SearchableSelect: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
}> = ({ label, value, onChange, options, placeholder, searchPlaceholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((option) => option.id === value);
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.meta || ''}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div ref={rootRef} className="relative">
      <label className="label">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'input flex w-full items-center justify-between gap-3 text-left transition-all',
          open && 'border-brand-400 ring-2 ring-brand-500/10'
        )}
      >
        <span className={cn('truncate', !selected && 'text-surface-400')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={16} className={cn('flex-shrink-0 text-surface-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-full rounded-2xl border border-surface-200 bg-white p-2 shadow-modal dark:border-surface-700 dark:bg-surface-900">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="input h-10 pl-9 text-sm"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-surface-100 bg-surface-50/70 p-1 dark:border-surface-800 dark:bg-surface-950/30">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-surface-400">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    value === option.id
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                      : 'text-surface-700 hover:bg-white dark:text-surface-200 dark:hover:bg-surface-800'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{option.label}</span>
                    {option.meta ? <span className="block truncate text-xs text-surface-400">{option.meta}</span> : null}
                  </span>
                  {value === option.id ? <span className="mt-0.5 text-xs font-bold text-brand-500">Selected</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const QuickTasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuthStore();
  const { quickTasks, users, bootstrap } = useAppStore();

  const [scope, setScope] = useState<ScopeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 10;
  const [selected, setSelected] = useState<QuickTask | null>(null);
  const [modalOpen, setModalOpen] = useState(params.get('new') === '1');
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<QuickTaskImportRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<QuickTaskImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importServerError, setImportServerError] = useState('');
  const isCreatedByMeActive = scope === 'created_by_me';
  const isAssignedToMeActive = scope === 'assigned_to_me';

  const canImportQuickTasks = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');
  const userMap = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const departmentOptions = useMemo(
    () => Array.from(new Set(users.map((item) => item.department?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [users]
  );
  const personOptions = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const baseFiltered = useMemo(() => {
    const uid = user?.id ?? '';
    return quickTasks
      .filter(t => {
        if (scope === 'assigned_to_me') return (t.assigneeIds || []).includes(uid);
        if (scope === 'created_by_me') return t.reporterId === uid;
        return true;
      })
      .filter(t => {
        const reporter = userMap.get(t.reporterId);
        const assignees = (t.assigneeIds || [])
          .map((assigneeId) => userMap.get(assigneeId))
          .filter(Boolean);
        const departments = Array.from(new Set([
          reporter?.department?.trim() || '',
          ...assignees.map((assignee) => assignee?.department?.trim() || ''),
        ].filter(Boolean)));

        if (departmentFilter !== 'all' && !departments.includes(departmentFilter)) return false;
        if (personFilter !== 'all' && t.reporterId !== personFilter && !(t.assigneeIds || []).includes(personFilter)) return false;

        const q = query.trim().toLowerCase();
        if (!q) return true;

        const searchableParts = [
          t.title,
          t.description || '',
          t.status,
          STATUS_CONFIG[t.status]?.label || '',
          t.priority,
          PRIORITY_CONFIG[t.priority]?.label || '',
          t.dueDate || '',
          t.dueDate ? formatDate(t.dueDate, 'MMM d, yyyy') : '',
          t.createdAt || '',
          t.createdAt ? formatDate(t.createdAt, 'MMM d, yyyy') : '',
          t.updatedAt || '',
          t.updatedAt ? formatDate(t.updatedAt, 'MMM d, yyyy') : '',
          reporter?.name || '',
          reporter?.email || '',
          reporter?.employeeId || '',
          ...assignees.flatMap((assignee) => [
            assignee?.name || '',
            assignee?.email || '',
            assignee?.employeeId || '',
          ]),
        ];

        return searchableParts
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const createdAtDiff =
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();

        if (createdAtDiff !== 0) return createdAtDiff;

        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      });
  }, [quickTasks, scope, query, departmentFilter, personFilter, user?.id, userMap]);

  const filtered = useMemo(() => {
    return baseFiltered.filter(t => {
      if (status === 'all') return true;
      if (status === 'overdue') return isOverdue(t);
      return t.status === status;
    });
  }, [baseFiltered, status]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [query, scope, status, departmentFilter, personFilter]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * tasksPerPage;
    return filtered.slice(start, start + tasksPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / tasksPerPage);

  const counts = useMemo(() => {
    return {
      total: baseFiltered.length,
      todo: baseFiltered.filter(t => t.status === 'todo').length,
      in_progress: baseFiltered.filter(t => t.status === 'in_progress').length,
      done: baseFiltered.filter(t => t.status === 'done').length,
      overdue: baseFiltered.filter(isOverdue).length,
    };
  }, [baseFiltered]);

  const openNew = () => {
    setSelected(null);
    setModalOpen(true);
    params.set('new', '1');
    setParams(params, { replace: true });
  };

  const closeModal = () => {
    setModalOpen(false);
    params.delete('new');
    setParams(params, { replace: true });
  };

  const toggleCreatedByMe = () => {
    setScope((current) => (current === 'created_by_me' ? 'all' : 'created_by_me'));
  };

  const toggleAssignedToMe = () => {
    setScope((current) => (current === 'assigned_to_me' ? 'all' : 'assigned_to_me'));
  };

  const resetImportState = () => {
    setImportFileName('');
    setImportRows([]);
    setImportParseErrors([]);
    setImportResult(null);
    setIsImporting(false);
    setImportServerError('');
  };

  const downloadImportTemplate = () => {
    const sampleRows = [
      QUICK_TASK_IMPORT_TEMPLATE_HEADERS.join(','),
      'Follow up with vendor,Confirm proposal and timeline,high,todo,"Vendor Owner",Admin User,2026-03-31,2026-03-01,2026-03-10',
      '"Prepare onboarding kit","Create docs and checklist",medium,in_progress,"HR Executive;Team Lead",Operations Manager,2026-04-02,2026-03-05,2026-03-12',
    ].join('\n');
    const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'quick-task-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportResult(null);
    setImportServerError('');
    setImportFileName(file.name);

    const text = await file.text();
    const parsed = parseQuickTasksCsv(text);
    setImportRows(parsed.rows);
    setImportParseErrors(parsed.parseErrors);
  };

  const handleBulkImport = async () => {
    if (!importRows.length) return;
    setIsImporting(true);
    setImportResult(null);
    setImportServerError('');
    try {
      const res = await quickTasksService.importBulk(importRows);
      const result = (res.data?.data ?? res.data) as QuickTaskImportResult;
      setImportResult(result);
      await bootstrap();
      emitSuccessToast(
        `${result.createdCount} quick task${result.createdCount === 1 ? '' : 's'} imported successfully.`,
        'Import Completed'
      );
    } catch (error: any) {
      const details = error?.response?.data?.error?.details;
      const fieldErrors = details?.fieldErrors
        ? Object.entries(details.fieldErrors).flatMap(([field, messages]) =>
          Array.isArray(messages) ? messages.map((message) => `${field}: ${message}`) : []
        )
        : [];
      const formErrors = Array.isArray(details?.formErrors) ? details.formErrors : [];
      const message =
        [...fieldErrors, ...formErrors].filter(Boolean).join(' | ') ||
        error?.response?.data?.error?.message ||
        error?.message ||
        'Import failed.';
      setImportServerError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const activeFilterCount = [
    scope !== 'all',
    status !== 'all',
    departmentFilter !== 'all',
    personFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="max-w-full mx-auto">
      <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {STATUS_CARDS.map((card) => {
          const count =
            card.value === 'all' ? counts.total :
              card.value === 'todo' ? counts.todo :
                card.value === 'in_progress' ? counts.in_progress :
                  card.value === 'done' ? counts.done :
                    counts.overdue;

          const isActive = status === card.value;

          return (
            <button
              key={card.value}
              type="button"
              onClick={() => setStatus(card.value)}
              className={cn(
                'card p-4 text-left transition-all border',
                isActive
                  ? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900/40 shadow-card-hover'
                  : 'border-surface-200 dark:border-surface-800 hover:border-surface-300 dark:hover:border-surface-700'
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">{card.label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className={cn('text-3xl font-display font-bold', card.tone)}>{count}</p>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isActive ? 'text-brand-600 dark:text-brand-300' : 'text-surface-400'
                  )}
                >
                  {isActive ? 'Showing' : 'View'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] w-full sm:w-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-10"
            placeholder="Search quick tasks..."
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
        </div>

        <div className="relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className={cn('btn-secondary btn-sm', showFilters && 'border-brand-500 text-brand-600')}
          >
            <SlidersHorizontal size={16} />
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{activeFilterCount}</span>
            ) : null}
          </button>

          {showFilters ? (
            <div className="absolute right-0 top-full z-30 mt-2 w-[320px] rounded-2xl border border-surface-200 bg-white p-4 shadow-modal dark:border-surface-700 dark:bg-surface-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-surface-900 dark:text-surface-100">Quick Task Filters</p>
                  <p className="text-xs text-surface-400">Keep all filtering in one compact panel.</p>
                </div>
                <button type="button" onClick={() => setShowFilters(false)} className="text-surface-400 hover:text-surface-600">
                  <X size={16} />
                </button>
              </div>
              <div>
                <SearchableSelect
                  label="Person"
                  value={personFilter}
                  onChange={setPersonFilter}
                  placeholder="All people"
                  searchPlaceholder="Search people..."
                  options={[
                    { id: 'all', label: 'All people' },
                    ...personOptions.map((person) => ({
                      id: person.id,
                      label: person.name,
                      meta: [person.employeeId, person.department].filter(Boolean).join(' • '),
                    })),
                  ]}
                />
              </div>
              <div>
                <SearchableSelect
                  label="Department"
                  value={departmentFilter}
                  onChange={setDepartmentFilter}
                  placeholder="All departments"
                  searchPlaceholder="Search departments..."
                  options={[
                    { id: 'all', label: 'All departments' },
                    ...departmentOptions.map((department) => ({
                      id: department,
                      label: department,
                    })),
                  ]}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Scope</label>
                  <select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} className="input">
                    <option value="all">All</option>
                    <option value="created_by_me">Created by me</option>
                    <option value="assigned_to_me">Assigned to me</option>
                  </select>
                </div>

                <div>
                  <label className="label">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="input">
                    {STATUS_FILTERS.map((filterOption) => (
                      <option key={filterOption.value} value={filterOption.value}>{filterOption.label}</option>
                    ))}
                  </select>
                </div>





                <button
                  type="button"
                  onClick={() => {
                    setScope('all');
                    setStatus('all');
                    setDepartmentFilter('all');
                    setPersonFilter('all');
                  }}
                  className="btn-secondary btn-sm w-full"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto w-full sm:w-auto justify-end">
          {['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '') && (
            <button
              type="button"
              onClick={toggleCreatedByMe}
              className={cn(
                'btn-secondary btn-sm w-full sm:w-auto',
                isCreatedByMeActive && 'border-brand-500 text-brand-600'
              )}
            >
              Created By Me
            </button>
          )}
          {['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '') && (
            <button
              type="button"
              onClick={toggleAssignedToMe}
              className={cn(
                'btn-secondary btn-sm w-full sm:w-auto',
                isAssignedToMeActive && 'border-brand-500 text-brand-600'
              )}
            >
              Assigned to Me
            </button>
          )}
          {canImportQuickTasks && (
            <button
              className="btn-secondary btn-sm w-full sm:w-auto"
              onClick={() => {
                resetImportState();
                setImportOpen(true);
              }}
            >
              <Upload size={16} />
              <span>Import</span>
            </button>
          )}
          <button className="btn-primary btn-sm w-full sm:w-auto" onClick={openNew}>
            <Plus size={16} />
            <span>New Quick Task</span>
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {scope !== 'all' ? (
          <span className="badge text-[10px] bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            {scope === 'created_by_me' ? 'Created by me' : 'Assigned to me'}
          </span>
        ) : null}
        {status !== 'all' ? (
          <span className="badge text-[10px] bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            Status: {STATUS_FILTERS.find((item) => item.value === status)?.label || status}
          </span>
        ) : null}
        {departmentFilter !== 'all' ? (
          <span className="badge text-[10px] bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            Department: {departmentFilter}
          </span>
        ) : null}
        {personFilter !== 'all' ? (
          <span className="badge text-[10px] bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            Person: {userMap.get(personFilter)?.name || 'Selected'}
          </span>
        ) : null}
      </div>

      {paginatedTasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="No quick tasks found"
          description="Try changing filters or create a new quick task"
        // action={<button className="btn-primary btn-sm hidden md:flex" onClick={openNew}><Plus size={16} /> New Quick Task</button>}
        />
      ) : (
        <>
          <div className="space-y-2">
            {paginatedTasks.map((t: QuickTask, i) => {
              const assigneeIds = t.assigneeIds || [];
              const assignees = assigneeIds
                .map((id) => users.find((u) => u.id === id))
                .filter((u): u is (typeof users)[number] => Boolean(u));
              const reporter = users.find(u => u.id === t.reporterId);
              const priority = PRIORITY_CONFIG[t.priority];
              const statusCfg =
                t.status === 'todo' ? STATUS_CONFIG.todo :
                  t.status === 'in_progress' ? STATUS_CONFIG.in_progress :
                    STATUS_CONFIG.done;

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => navigate(`/quick-tasks/${t.id}`)}
                  className={cn(
                    'card p-4 cursor-pointer hover:shadow-card-hover transition-shadow',
                    isOverdue(t) && 'border-rose-200 dark:border-rose-900/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={cn('badge text-[10px]', priority.bg, priority.text)}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priority.color }} />
                          {priority.label}
                        </span>
                        <span className={cn('badge text-[10px]', statusCfg.bg, statusCfg.text)}>
                          {statusCfg.label}
                        </span>
                        {isOverdue(t) && (
                          <span className="badge text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300">
                            Overdue
                          </span>
                        )}
                        {(t as any).isPrivate && (
                          <span className="badge text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-300 flex items-center gap-1">
                            <Lock size={10} />
                            Private
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                        {t.title}
                      </p>
                      {t.description && (
                        <p className="text-xs text-surface-400 mt-1 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-surface-400 flex-shrink-0">
                      <div className="hidden sm:flex items-center gap-1.5">
                        <User size={12} />
                        <span className="max-w-[140px] truncate">
                          {assignees.length ? assignees.map((a) => a.name).slice(0, 2).join(', ') + (assignees.length > 2 ? ` +${assignees.length - 2}` : '') : 'Unassigned'}
                        </span>
                      </div>
                      <div className="hidden md:flex items-center gap-1.5">
                        <Calendar size={12} />
                        <span>{t.dueDate ? formatDate(t.dueDate, 'MMM d') : 'No due date'}</span>
                      </div>
                      <div className="hidden lg:block">
                        <span className="text-[11px] text-surface-400">
                          Created by {reporter?.name ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-surface-100 dark:border-surface-800 pt-4 px-1">
              <p className="text-xs font-medium text-surface-500">
                Showing <span className="text-surface-900 dark:text-white">{(currentPage - 1) * tasksPerPage + 1}</span> to <span className="text-surface-900 dark:text-white">{Math.min(currentPage * tasksPerPage, filtered.length)}</span> of <span className="text-surface-900 dark:text-white">{filtered.length}</span> results
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all",
                      currentPage === page
                        ? "bg-brand-600 text-white shadow-sm"
                        : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
                    )}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <QuickTaskModal
        open={modalOpen}
        onClose={closeModal}
        task={selected}
      />

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          resetImportState();
        }}
        title="Import Quick Tasks"
        description="Upload an Excel-friendly CSV file to create multiple quick tasks at once."
        size="lg"
      >
        <div className="p-4 sm:p-6 space-y-5">
          <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50/70 p-5 dark:border-surface-700 dark:bg-surface-800/40">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">Step 1: Prepare your file</p>
            <p className="mt-1 text-xs text-surface-500">
              Use the template. Assignees and reporter can be matched by full name, email, or employee ID from the current user table.
              Multiple assignees can be separated by `;` or `,`. Missing optional fields are imported with system defaults.
              `dueDate` should be in `YYYY-MM-DD` format.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={downloadImportTemplate} className="btn-secondary btn-md">
                Download Template
              </button>
              <label className="btn-primary btn-md cursor-pointer">
                Select CSV File
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void handleImportFile(e); }} />
              </label>
            </div>
            {importFileName && (
              <p className="mt-3 text-xs text-surface-400">Selected file: {importFileName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-surface-400">Rows Ready</p>
              <p className="mt-1 text-2xl font-display font-bold text-surface-900 dark:text-surface-100">{importRows.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-surface-400">Parse Errors</p>
              <p className="mt-1 text-2xl font-display font-bold text-rose-500">{importParseErrors.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-surface-400">Template</p>
              <p className="mt-1 text-sm font-medium text-surface-700 dark:text-surface-200">Excel-compatible CSV</p>
            </div>
          </div>

          {importParseErrors.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-sm font-semibold text-rose-700 mb-2">Fix these rows before import</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {importParseErrors.map((error, index) => (
                  <p key={`${error}-${index}`} className="text-xs text-rose-600">{error}</p>
                ))}
              </div>
            </div>
          )}

          {importServerError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-sm font-semibold text-rose-700 mb-2">Import request failed</p>
              <p className="text-xs text-rose-600 whitespace-pre-wrap">{importServerError}</p>
            </div>
          )}

          {importRows.length > 0 && (
            <div className="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">Preview</p>
                <p className="text-xs text-surface-400">Showing first {Math.min(importRows.length, 5)} rows</p>
              </div>
              <div className="mt-3 space-y-2">
                {importRows.slice(0, 5).map((row) => (
                  <div key={`${row.rowNumber}-${row.title}`} className="rounded-xl bg-surface-50 px-3 py-2 text-xs dark:bg-surface-800/50">
                    <p className="font-medium text-surface-800 dark:text-surface-100">{row.title}</p>
                    <p className="mt-1 text-surface-500">
                      Priority: {row.priority || 'medium'} | Status: {row.status || 'todo'} | Assignees: {row.assigneeNames || row.assigneeEmails || 'none'} | Reporter: {row.reporterName || row.reporterEmail || 'current user'} | Due: {row.dueDate || 'none'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult && (
            <div className="rounded-2xl border border-surface-200 p-4 dark:border-surface-700">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-surface-400">Created</p>
                  <p className="mt-1 text-2xl font-display font-bold text-emerald-700">{importResult.createdCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-surface-400">Failed</p>
                  <p className="mt-1 text-2xl font-display font-bold text-rose-700">{importResult.failedCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-surface-400">Total</p>
                  <p className="mt-1 text-2xl font-display font-bold text-surface-900 dark:text-surface-100">{importResult.totalRows}</p>
                </div>
              </div>
              {importResult.failures.length > 0 && (
                <div className="mt-4 space-y-1 max-h-40 overflow-y-auto pr-1">
                  {importResult.failures.map((failure) => (
                    <p key={`${failure.rowNumber}-${failure.title || failure.message}`} className="text-xs text-rose-600">
                      Row {failure.rowNumber} ({failure.title || 'Untitled'}): {failure.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                resetImportState();
              }}
              className="btn-secondary btn-md flex-1"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => { void handleBulkImport(); }}
              disabled={isImporting || importRows.length === 0 || importParseErrors.length > 0}
              className="btn-primary btn-md flex-1"
            >
              {isImporting ? 'Importing...' : `Import ${importRows.length || ''} Quick Tasks`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuickTasksPage;
