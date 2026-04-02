import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  Plus, Search, LayoutGrid, List, SortAsc,
  FolderKanban, Calendar, MoreVertical, Trash2, Edit3, Archive, ChevronDown, Upload
} from 'lucide-react';
import { cn, formatDate, getProgressColor } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import { PROJECT_COLORS, STATUS_CONFIG } from '../../app/constants';
import { ColorPicker } from '../../components/ColorPicker';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { ProgressBar, EmptyState, Dropdown } from '../../components/ui';
import { Modal } from '../../components/Modal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type {
  Priority,
  ProjectCategory,
  Project,
  ProjectImportResult,
  ProjectImportRow,
  ProjectStatus,
  ProjectSdlcPhase,
  TaskStatus,
} from '../../app/types';
import { projectsService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';

const PROJECT_IMPORT_TEMPLATE_HEADERS = [
  'projectKey',
  'projectName',
  'projectDescription',
  'projectStatus',
  'projectDepartment',
  'projectColor',
  'memberNames',
  'memberEmails',
  'reportingPersonNames',
  'reportingPersonEmails',
  'startDate',
  'endDate',
  'budget',
  'budgetCurrency',
  'sdlcPlan',
  'taskTitle',
  'taskDescription',
  'taskStatus',
  'taskPriority',
  'taskAssigneeNames',
  'taskAssigneeEmails',
  'taskStartDate',
  'taskDurationDays',
  'taskEstimatedHours',
  'taskPhase',
  'taskSubtasks',
];

const PROJECT_IMPORT_HEADER_ALIASES: Record<string, string[]> = {
  projectKey: ['projectkey', 'projectgroup', 'groupkey', 'batchkey'],
  projectName: ['projectname', 'project', 'projecttitle', 'name'],
  projectDescription: ['projectdescription', 'description', 'projectdetails'],
  projectStatus: ['projectstatus', 'status'],
  projectDepartment: ['projectdepartment', 'department'],
  projectColor: ['projectcolor', 'color'],
  memberNames: ['membernames', 'members', 'projectmembers', 'assignedmembers'],
  memberEmails: ['memberemails', 'memberemail', 'projectmemberemails'],
  reportingPersonNames: ['reportingpersonnames', 'reportingpersons', 'reporters', 'projectreporters'],
  reportingPersonEmails: ['reportingpersonemails', 'reportingpersonemail', 'reporteremails'],
  startDate: ['startdate', 'projectstartdate'],
  endDate: ['enddate', 'duedate', 'projectenddate'],
  budget: ['budget', 'projectbudget'],
  budgetCurrency: ['budgetcurrency', 'currency'],
  sdlcPlan: ['sdlcplan', 'projectplan', 'phasesplan'],
  taskTitle: ['tasktitle', 'taskname', 'title'],
  taskDescription: ['taskdescription', 'taskdetails'],
  taskStatus: ['taskstatus'],
  taskPriority: ['taskpriority', 'priority'],
  taskAssigneeNames: ['taskassigneenames', 'assigneenames', 'taskassignees', 'assignees'],
  taskAssigneeEmails: ['taskassigneeemails', 'assigneeemails', 'taskassigneeemail'],
  taskStartDate: ['taskstartdate'],
  taskDurationDays: ['taskdurationdays', 'durationdays'],
  taskEstimatedHours: ['taskestimatedhours', 'estimatedhours'],
  taskPhase: ['taskphase', 'phase'],
  taskSubtasks: ['tasksubtasks', 'subtasks', 'checklist'],
};

const VALID_PROJECT_IMPORT_STATUSES: ProjectStatus[] = ['active', 'on_hold', 'completed', 'archived'];
const VALID_PROJECT_IMPORT_TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'scheduled', 'in_progress', 'in_review', 'done'];
const VALID_PROJECT_IMPORT_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const PROJECT_STATUS_BADGES: Record<ProjectStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'badge-green' },
  on_hold: { label: 'On Hold', className: 'badge-amber' },
  completed: { label: 'Completed', className: 'badge-blue' },
  archived: { label: 'Archived', className: 'badge-gray' },
};

interface ProjectFormData {
  name: string;
  description: string;
  color: string;
  startDate: string;
  endDate: string;
  department: string;
  budget?: number;
  budgetCurrency: string;
}

const DEFAULT_SDLC_PLAN: ProjectSdlcPhase[] = [
  { name: 'Planning', durationDays: 3, notes: '' },
  { name: 'Requirement Analysis', durationDays: 5, notes: '' },
  { name: 'Design', durationDays: 4, notes: '' },
  { name: 'Development', durationDays: 10, notes: '' },
  { name: 'Testing', durationDays: 5, notes: '' },
  { name: 'Deployment', durationDays: 2, notes: '' },
  { name: 'Maintenance', durationDays: 3, notes: '' },
];

const DEFAULT_PROJECT_CATEGORIES: ProjectCategory[] = [
  { id: 'ui-design', name: 'UI Design', color: '#2563eb', order: 0 },
  { id: 'mobile-app-design', name: 'Mobile Application Design', color: '#ec4899', order: 1 },
  { id: 'frontend-design', name: 'Frontend Design', color: '#0f766e', order: 2 },
  { id: 'backend-design', name: 'Backend Design', color: '#ea580c', order: 3 },
];

const DEFAULT_DEPARTMENTS = ['General', 'Development', 'Design', 'Marketing', 'Product'];

function slugifyCategory(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeHeader(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeProjectStatusValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || 'active';
}

function normalizeTaskStatusValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'todo';
  if (normalized === 'completed') return 'done';
  return normalized;
}

function normalizePriorityValue(value?: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized || 'medium';
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

function parseProjectsCsv(content: string) {
  const sanitized = content.replace(/^\uFEFF/, '');
  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [] as ProjectImportRow[],
      parseErrors: ['The file must contain a header row and at least one project or task row.'],
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const headerKeyMap = normalizedHeaders.reduce<Record<string, string>>((acc, normalized, index) => {
    acc[normalized] = headers[index];
    return acc;
  }, {});

  const resolveHeader = (canonicalKey: keyof typeof PROJECT_IMPORT_HEADER_ALIASES) => {
    const aliases = PROJECT_IMPORT_HEADER_ALIASES[canonicalKey];
    const match = aliases.find((alias) => headerKeyMap[alias]);
    return match ? headerKeyMap[match] : undefined;
  };

  const mappedHeaders = {
    projectKey: resolveHeader('projectKey'),
    projectName: resolveHeader('projectName'),
    projectDescription: resolveHeader('projectDescription'),
    projectStatus: resolveHeader('projectStatus'),
    projectDepartment: resolveHeader('projectDepartment'),
    projectColor: resolveHeader('projectColor'),
    memberNames: resolveHeader('memberNames'),
    memberEmails: resolveHeader('memberEmails'),
    reportingPersonNames: resolveHeader('reportingPersonNames'),
    reportingPersonEmails: resolveHeader('reportingPersonEmails'),
    startDate: resolveHeader('startDate'),
    endDate: resolveHeader('endDate'),
    budget: resolveHeader('budget'),
    budgetCurrency: resolveHeader('budgetCurrency'),
    sdlcPlan: resolveHeader('sdlcPlan'),
    taskTitle: resolveHeader('taskTitle'),
    taskDescription: resolveHeader('taskDescription'),
    taskStatus: resolveHeader('taskStatus'),
    taskPriority: resolveHeader('taskPriority'),
    taskAssigneeNames: resolveHeader('taskAssigneeNames'),
    taskAssigneeEmails: resolveHeader('taskAssigneeEmails'),
    taskStartDate: resolveHeader('taskStartDate'),
    taskDurationDays: resolveHeader('taskDurationDays'),
    taskEstimatedHours: resolveHeader('taskEstimatedHours'),
    taskPhase: resolveHeader('taskPhase'),
    taskSubtasks: resolveHeader('taskSubtasks'),
  };

  const missingHeaders = ['projectName']
    .filter((header) => !mappedHeaders[header as keyof typeof mappedHeaders]);

  if (missingHeaders.length > 0) {
    return {
      rows: [] as ProjectImportRow[],
      parseErrors: [`Missing required columns: ${missingHeaders.join(', ')}`],
    };
  }

  const rows: ProjectImportRow[] = [];
  const parseErrors: string[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const record = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});

    const projectKey = mappedHeaders.projectKey ? record[mappedHeaders.projectKey]?.trim() || '' : '';
    const projectName = mappedHeaders.projectName ? record[mappedHeaders.projectName]?.trim() || '' : '';

    if (!projectKey && !projectName) continue;

    if (!projectName) {
      parseErrors.push(`Row ${lineIndex + 1}: projectName is required.`);
      continue;
    }

    const generatedProjectKey = projectKey || `${projectName}-${lineIndex + 1}`;

    const projectStatus = normalizeProjectStatusValue(mappedHeaders.projectStatus ? record[mappedHeaders.projectStatus] : '');
    const taskStatus = normalizeTaskStatusValue(mappedHeaders.taskStatus ? record[mappedHeaders.taskStatus] : '');
    const taskPriority = normalizePriorityValue(mappedHeaders.taskPriority ? record[mappedHeaders.taskPriority] : '');
    const budgetValue = mappedHeaders.budget ? record[mappedHeaders.budget]?.trim() || '' : '';
    const durationValue = mappedHeaders.taskDurationDays ? record[mappedHeaders.taskDurationDays]?.trim() || '' : '';
    const estimatedHoursValue = mappedHeaders.taskEstimatedHours ? record[mappedHeaders.taskEstimatedHours]?.trim() || '' : '';

    if (!VALID_PROJECT_IMPORT_STATUSES.includes(projectStatus as ProjectStatus)) {
      parseErrors.push(`Row ${lineIndex + 1}: projectStatus must be one of ${VALID_PROJECT_IMPORT_STATUSES.join(', ')}.`);
      continue;
    }

    if (mappedHeaders.taskStatus && record[mappedHeaders.taskStatus]?.trim() && !VALID_PROJECT_IMPORT_TASK_STATUSES.includes(taskStatus as TaskStatus)) {
      parseErrors.push(`Row ${lineIndex + 1}: taskStatus must be one of ${VALID_PROJECT_IMPORT_TASK_STATUSES.join(', ')}.`);
      continue;
    }

    if (mappedHeaders.taskPriority && record[mappedHeaders.taskPriority]?.trim() && !VALID_PROJECT_IMPORT_PRIORITIES.includes(taskPriority as Priority)) {
      parseErrors.push(`Row ${lineIndex + 1}: taskPriority must be one of ${VALID_PROJECT_IMPORT_PRIORITIES.join(', ')}.`);
      continue;
    }

    if (budgetValue && Number.isNaN(Number(budgetValue))) {
      parseErrors.push(`Row ${lineIndex + 1}: budget must be a number.`);
      continue;
    }

    if (durationValue && Number.isNaN(Number(durationValue))) {
      parseErrors.push(`Row ${lineIndex + 1}: taskDurationDays must be a number.`);
      continue;
    }

    if (estimatedHoursValue && Number.isNaN(Number(estimatedHoursValue))) {
      parseErrors.push(`Row ${lineIndex + 1}: taskEstimatedHours must be a number.`);
      continue;
    }

    rows.push({
      rowNumber: lineIndex + 1,
      projectKey: generatedProjectKey,
      projectName,
      projectDescription: mappedHeaders.projectDescription ? record[mappedHeaders.projectDescription]?.trim() || '' : '',
      projectStatus: projectStatus as ProjectStatus,
      projectDepartment: mappedHeaders.projectDepartment ? record[mappedHeaders.projectDepartment]?.trim() || '' : '',
      projectColor: mappedHeaders.projectColor ? record[mappedHeaders.projectColor]?.trim() || '' : '',
      memberNames: mappedHeaders.memberNames ? record[mappedHeaders.memberNames]?.trim() || '' : '',
      memberEmails: mappedHeaders.memberEmails ? record[mappedHeaders.memberEmails]?.trim() || '' : '',
      reportingPersonNames: mappedHeaders.reportingPersonNames ? record[mappedHeaders.reportingPersonNames]?.trim() || '' : '',
      reportingPersonEmails: mappedHeaders.reportingPersonEmails ? record[mappedHeaders.reportingPersonEmails]?.trim() || '' : '',
      startDate: mappedHeaders.startDate ? record[mappedHeaders.startDate]?.trim() || '' : '',
      endDate: mappedHeaders.endDate ? record[mappedHeaders.endDate]?.trim() || '' : '',
      budget: budgetValue ? Number(budgetValue) : undefined,
      budgetCurrency: mappedHeaders.budgetCurrency ? record[mappedHeaders.budgetCurrency]?.trim() || '' : '',
      sdlcPlan: mappedHeaders.sdlcPlan ? record[mappedHeaders.sdlcPlan]?.trim() || '' : '',
      taskTitle: mappedHeaders.taskTitle ? record[mappedHeaders.taskTitle]?.trim() || '' : '',
      taskDescription: mappedHeaders.taskDescription ? record[mappedHeaders.taskDescription]?.trim() || '' : '',
      taskStatus: taskStatus as TaskStatus,
      taskPriority: taskPriority as Priority,
      taskAssigneeNames: mappedHeaders.taskAssigneeNames ? record[mappedHeaders.taskAssigneeNames]?.trim() || '' : '',
      taskAssigneeEmails: mappedHeaders.taskAssigneeEmails ? record[mappedHeaders.taskAssigneeEmails]?.trim() || '' : '',
      taskStartDate: mappedHeaders.taskStartDate ? record[mappedHeaders.taskStartDate]?.trim() || '' : '',
      taskDurationDays: durationValue ? Number(durationValue) : undefined,
      taskEstimatedHours: estimatedHoursValue ? Number(estimatedHoursValue) : undefined,
      taskPhase: mappedHeaders.taskPhase ? record[mappedHeaders.taskPhase]?.trim() || '' : '',
      taskSubtasks: mappedHeaders.taskSubtasks ? record[mappedHeaders.taskSubtasks]?.trim() || '' : '',
    });
  }

  return { rows, parseErrors };
}

const ProjectCard = React.forwardRef<HTMLDivElement, {
  project: Project;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (project: Project) => void;
}>(({ project, onDelete, onArchive, onEdit }, ref) => {
  const navigate = useNavigate();
  const { users, workspaces } = useAppStore();
  const members = users.filter(u => project.members.includes(u.id));
  const { user } = useAuthStore();
  const workspacePermissions = workspaces[0]?.settings?.permissions || {};
  const canEditOtherProjects = Boolean(workspacePermissions?.editOtherProjects?.[user?.role || 'team_member']);
  const canManageProjects = user?.role !== 'team_member' || canEditOtherProjects;
  const badge = PROJECT_STATUS_BADGES[project.status];
  const isArchived = project.status === 'archived';

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -2 }}
      className={cn(
        "card p-5 cursor-pointer hover:shadow-card-hover transition-all relative overflow-hidden",
        isArchived && "opacity-75 grayscale-[0.3]"
      )}
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {isArchived && (
        <div className="absolute top-0 right-0">
          <div className="bg-surface-800 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm border-l border-b border-surface-700/50">
            Archived
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0"
            style={{ backgroundColor: project.color }}
          >
            {project.name[0]}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white truncate">{project.name}</h3>
            <span className={cn('badge text-[10px] mt-0.5', badge.className)}>{badge.label}</span>
          </div>
        </div>

        {canManageProjects && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                onClick={e => e.stopPropagation()}
                className="btn w-7 h-7 rounded-lg opacity group-hover:opacity-100"
              >
                <MoreVertical size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                onClick={e => e.stopPropagation()}
                className="z-50 min-w-[160px] bg-white dark:bg-surface-900 rounded-xl shadow-modal border border-surface-100 dark:border-surface-800 p-1"
                sideOffset={4} align="end"
              >
                <DropdownMenu.Item
                  onClick={() => onEdit(project)}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-surface-700 dark:text-surface-300 outline-none"
                >
                  <Edit3 size={14} /> Edit
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onClick={() => onArchive(project.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer text-surface-700 dark:text-surface-300 outline-none"
                >
                  <Archive size={14} /> Archive
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-surface-100 dark:bg-surface-800 my-1" />
                <DropdownMenu.Item
                  onClick={() => onDelete(project.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer text-rose-600 outline-none"
                >
                  <Trash2 size={14} /> Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {project.description && (
        <p className="text-xs text-surface-400 mb-3 line-clamp-2 leading-relaxed">{project.description}</p>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-surface-500 mb-2">
          <span className="font-semibold uppercase tracking-wider opacity-60">Progress</span>
          <span className="font-bold text-surface-700 dark:text-surface-300">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="md" />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-50 dark:border-surface-800/50 mt-1">
        <AvatarGroup users={members} max={3} size="xs" />
        <div className="flex flex-col items-end">
          {project.endDate && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-surface-400 uppercase tracking-tight">
              <Calendar size={10} />
              {formatDate(project.endDate, 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});

const ProjectRow: React.FC<{ project: Project; onDelete: (id: string) => void; onArchive: (id: string) => void; onEdit: (project: Project) => void }> = ({ project, onDelete, onArchive, onEdit }) => {
  const navigate = useNavigate();
  const { users, workspaces } = useAppStore();
  const members = users.filter(u => project.members.includes(u.id));
  const badge = PROJECT_STATUS_BADGES[project.status];

  const { user } = useAuthStore();
  const workspacePermissions = workspaces[0]?.settings?.permissions || {};
  const canEditOtherProjects = Boolean(workspacePermissions?.editOtherProjects?.[user?.role || 'team_member']);
  const canManageProjects = user?.role !== 'team_member' || canEditOtherProjects;

    const isArchived = project.status === 'archived';
  
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-4 px-5 py-3.5 border-b border-surface-50 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors group",
          isArchived && "opacity-60 grayscale-[0.2]"
        )}
        onClick={() => navigate(`/projects/${project.id}`)}
      >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: project.color }}>
        {project.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{project.name}</p>
      </div>
      <div className="hidden sm:flex items-center w-24">
        <span className={cn('badge text-[10px] font-bold uppercase tracking-wider', badge.className)}>{badge.label}</span>
      </div>
      <div className="hidden md:flex items-center gap-3 w-40">
        <ProgressBar value={project.progress} color={getProgressColor(project.progress)} size="sm" className="flex-1" />
        <span className="text-[10px] font-bold text-surface-500 w-8 text-right">{project.progress}%</span>
      </div>
      <div className="hidden sm:flex items-center justify-center w-24">
        <AvatarGroup users={members} max={3} size="xs" />
      </div>
      <div className="hidden lg:flex items-center w-28">
        {project.endDate && (
          <span className="text-[11px] font-medium text-surface-400 whitespace-nowrap">{formatDate(project.endDate)}</span>
        )}
      </div>
      {canManageProjects && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            title="Archive"
            onClick={e => { e.stopPropagation(); onArchive(project.id); }}
            className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-amber-500 flex items-center justify-center"
          >
            <Archive size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(project); }}
            className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-brand-600 flex items-center justify-center"
          >
            <Edit3 size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(project.id); }}
            className="btn-ghost w-8 h-8 rounded-lg text-surface-300 hover:text-rose-500 dark:hover:bg-rose-950/30 flex items-center justify-center transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, users, addProject, updateProject, deleteProject, bootstrap } = useAppStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(() => {
    const incoming = searchParams.get('status');
    return incoming === 'active' || incoming === 'on_hold' || incoming === 'completed' || incoming === 'archived'
      ? incoming
      : 'all';
  });
  const canCreateProjects = user?.role !== 'team_member';
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedReportingPersons, setSelectedReportingPersons] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [reportingSearch, setReportingSearch] = useState('');
  const [sdlcPlan, setSdlcPlan] = useState<ProjectSdlcPhase[]>(DEFAULT_SDLC_PLAN);
  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>(DEFAULT_PROJECT_CATEGORIES);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState<ProjectImportRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ProjectImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importServerError, setImportServerError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid'); // Added view state
  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<ProjectFormData>({
    defaultValues: { budgetCurrency: 'INR' }
  });
  const canImportProjects = ['super_admin', 'admin', 'manager', 'team_leader'].includes(user?.role || '');

  const todayDate = new Date().toISOString().split('T')[0];
  const budgetCurrency = watch('budgetCurrency');
  const selectedDepartment = watch('department') || 'General';
  const selectedStartDate = watch('startDate') || todayDate;
  const departmentOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_DEPARTMENTS, ...projects.map((project) => project.department || 'General').filter(Boolean)])),
    [projects]
  );
  const departmentDropdownValue = departmentOptions.includes(selectedDepartment) ? selectedDepartment : '__custom__';

  const filteredAssignableUsers = users.filter((candidate) => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return true;
    return [candidate.name, candidate.email, candidate.jobTitle, candidate.department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const filteredReportingUsers = users.filter((candidate) => {
    const query = reportingSearch.trim().toLowerCase();
    if (!query) return true;
    return [candidate.name, candidate.email, candidate.jobTitle, candidate.department]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const availableAssignableUsers = filteredAssignableUsers.filter(
    (candidate) => !selectedReportingPersons.includes(candidate.id)
  );
  const availableReportingUsers = filteredReportingUsers.filter(
    (candidate) => !selectedMembers.includes(candidate.id)
  );

  const totalPlannedDurationDays = sdlcPlan.reduce((sum, phase) => sum + (Number(phase.durationDays) || 0), 0);

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const closeCreateModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setSelectedColor(PROJECT_COLORS[0]);
    setSelectedMembers([]);
    setSelectedReportingPersons([]);
    setMemberSearch('');
    setReportingSearch('');
    setSdlcPlan(DEFAULT_SDLC_PLAN);
    setProjectCategories(DEFAULT_PROJECT_CATEGORIES);
    reset();
  };

  const openCreateModal = () => {
    closeCreateModal();
    reset({
      name: '',
      description: '',
      department: 'General',
      startDate: todayDate,
      endDate: '',
      budget: undefined,
      budgetCurrency: 'INR',
    });
    setProjectCategories(DEFAULT_PROJECT_CATEGORIES);
    setShowModal(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setShowModal(true);
    setValue('name', project.name);
    setValue('description', project.description || '');
    setValue('department', project.department || 'General');
    setValue('startDate', project.startDate || '');
    setValue('endDate', project.endDate || '');
    setValue('budget', project.budget);
    setValue('budgetCurrency', project.budgetCurrency || 'INR');
    setSelectedColor(project.color);
    setSelectedMembers(project.members || []);
    setSelectedReportingPersons(project.reportingPersonIds || []);
    setMemberSearch('');
    setReportingSearch('');
    setSdlcPlan(project.sdlcPlan?.length ? project.sdlcPlan : DEFAULT_SDLC_PLAN);
    setProjectCategories(project.subcategories?.length ? project.subcategories : DEFAULT_PROJECT_CATEGORIES);
  };

  React.useEffect(() => {
    const next = statusFilter === 'all' ? null : statusFilter;
    const current = searchParams.get('status');
    if ((current || null) === next) return;
    const updatedParams = new URLSearchParams(searchParams);
    if (next) updatedParams.set('status', next);
    else updatedParams.delete('status');
    setSearchParams(updatedParams, { replace: true });
  }, [searchParams, setSearchParams, statusFilter]);

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
      PROJECT_IMPORT_TEMPLATE_HEADERS.join(','),
      'website-redesign-1,Website Redesign,Company site refresh,active,Design,#3366FF,"Aarav Shah;Maya Roy",,"Priya Singh",,2026-04-01,2026-06-30,250000,INR,"Planning:3;Design:5;Development:12;Testing:4",Homepage Wireframes,Create homepage UI draft,todo,high,Maya Roy,,2026-04-01,3,16,Design,"Create layout;Review copy;Approve visuals"',
      'website-redesign-1,Website Redesign,Company site refresh,active,Design,#3366FF,,,,,2026-04-01,2026-06-30,250000,INR,"Planning:3;Design:5;Development:12;Testing:4",Landing Page Build,Implement final landing page,in_progress,medium,"Aarav Shah;Dev Team Lead",,2026-04-05,6,32,Development,"Set up sections;Connect forms;QA check"',
      'mobile-app-rollout,Mobile App Rollout,Launch v2 mobile app,on_hold,Product,#0F766E,,"owner@company.com","Product Head","head@company.com",2026-05-10,2026-08-20,500000,USD,"Planning:4;Development:20;Testing:8",Sprint Planning,Prepare sprint board,todo,medium,,"scrum@company.com",2026-05-10,2,8,Planning,"Backlog review;Capacity plan"',
    ].join('\n');
    const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project-import-template.csv';
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
    const parsed = parseProjectsCsv(text);
    setImportRows(parsed.rows);
    setImportParseErrors(parsed.parseErrors);
  };

  const handleBulkImport = async () => {
    if (!importRows.length) return;
    setIsImporting(true);
    setImportResult(null);
    setImportServerError('');
    try {
      const res = await projectsService.importBulk(importRows);
      const result = (res.data?.data ?? res.data) as ProjectImportResult;
      setImportResult(result);
      await bootstrap();
      emitSuccessToast(
        `${result.createdCount} project${result.createdCount === 1 ? '' : 's'} and ${result.createdTaskCount} task${result.createdTaskCount === 1 ? '' : 's'} imported successfully.`,
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

  const toggleMemberSelection = (memberId: string, checked: boolean) => {
    setSelectedMembers((prev) =>
      checked ? Array.from(new Set([...prev, memberId])) : prev.filter((id) => id !== memberId)
    );
    if (checked) {
      setSelectedReportingPersons((prev) => prev.filter((id) => id !== memberId));
    }
  };

  const toggleReportingSelection = (memberId: string, checked: boolean) => {
    setSelectedReportingPersons((prev) =>
      checked ? Array.from(new Set([...prev, memberId])) : prev.filter((id) => id !== memberId)
    );
    if (checked) {
      setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
    }
  };

  const onSaveProject = async (data: ProjectFormData) => {
    try {
      const fallbackMembers = user?.id ? [user.id] : [];
      const payload = {
        name: data.name,
        description: data.description,
        color: selectedColor,
        status: editingProject?.status || 'active' as const,
        department: data.department || 'General',
        members: selectedMembers.length > 0 ? selectedMembers : fallbackMembers,
        reportingPersonIds: selectedReportingPersons,
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        endDate: data.endDate || undefined,
        budget: typeof data.budget === 'number' && !Number.isNaN(data.budget) ? data.budget : undefined,
        budgetCurrency: data.budgetCurrency || 'INR',
        sdlcPlan: sdlcPlan.filter((phase) => phase.name.trim()),
        subcategories: projectCategories
          .map((category, index) => ({
            id: category.id || slugifyCategory(category.name) || `category-${index + 1}`,
            name: category.name.trim(),
            description: category.description || '',
            color: category.color || PROJECT_COLORS[index % PROJECT_COLORS.length],
            order: index,
          }))
          .filter((category) => category.name),
      };

      if (editingProject) {
        const res = await projectsService.update(editingProject.id, payload);
        const updated = res.data.data ?? res.data;
        updateProject(editingProject.id, updated);
        closeCreateModal();
        await bootstrap();
        emitSuccessToast('Project updated successfully.', 'Project Updated');
      } else {
        const res = await projectsService.create(payload);
        const created = res.data.data ?? res.data;
        addProject(created);
        closeCreateModal();
        emitSuccessToast('Project created successfully.');
        navigate(`/projects/${created.id}`);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Project could not be saved to the database.';
      emitErrorToast(message, editingProject ? 'Project update failed' : 'Project creation failed');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      const res = await projectsService.update(projectId, { status: 'archived' });
      const updated = res.data.data ?? res.data;
      updateProject(projectId, updated);
      await bootstrap();
      emitSuccessToast('Project archived successfully.', 'Project Archived');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Project could not be archived.';
      emitErrorToast(message, 'Project archive failed');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await projectsService.delete(projectId);
      deleteProject(projectId);
      await bootstrap();
      emitSuccessToast('Project deleted successfully.', 'Project Deleted');
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Project could not be deleted.';
      emitErrorToast(message, 'Project delete failed');
    }
  };

  return (
    <div className="max-w-full mx-auto">
      {/* Header Actions */}
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
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

        <div className="ml-auto flex items-center gap-2">
          {canImportProjects && (
            <button
              onClick={() => {
                resetImportState();
                setImportOpen(true);
              }}
              className="btn-secondary btn-sm px-4"
            >
              <Upload size={14} /> Import
            </button>
          )}
          {canCreateProjects && <button onClick={openCreateModal} className="btn-primary btn-sm px-4">
            <Plus size={14} /> New Project
          </button>}
          <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
            <button
              onClick={() => setView('grid')}
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', view === 'grid' ? 'bg-white dark:bg-surface-900 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-all', view === 'list' ? 'bg-white dark:bg-surface-900 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid/List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={28} />}
          title="No projects found"
          description={search ? `No projects matching "${search}"` : 'Create your first project to get started'}
        />
      ) : (
        <div className="space-y-8 pb-10">
          {Object.entries(
            filtered.reduce((acc, p) => {
              const dept = p.department || 'General';
              if (!acc[dept]) acc[dept] = [];
              acc[dept].push(p);
              return acc;
            }, {} as Record<string, Project[]>)
          ).map(([dept, deptProjects]) => (
            <div key={dept} className="space-y-4">
              <div
                onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <div className="h-px flex-1 bg-surface-100 dark:bg-surface-800" />
                <div className="flex items-center gap-2 px-3 py-1 bg-surface-50 dark:bg-surface-800 rounded-lg group-hover:bg-surface-100 dark:group-hover:bg-surface-700 transition-colors">
                  <span className="text-xs font-bold text-surface-400 uppercase tracking-widest">{dept} ({deptProjects.length})</span>
                  <ChevronDown size={12} className={cn('text-surface-400 transition-transform', collapsedDepts[dept] ? 'rotate-270' : 'rotate-180')} />
                </div>
                <div className="h-px flex-1 bg-surface-100 dark:bg-surface-800" />
              </div>

              <AnimatePresence>
                {!collapsedDepts[dept] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {view === 'grid' ? (
                      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                          {deptProjects.map(project => (
                            <ProjectCard key={project.id} project={project} onDelete={handleDeleteProject} onArchive={handleArchiveProject} onEdit={openEditModal} />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    ) : (
                      <div className="card overflow-hidden group">
                        <div className="flex items-center gap-4 px-5 py-2.5 bg-surface-50 dark:bg-surface-900 border-b border-surface-100 dark:border-surface-800">
                          <div className="w-8 flex-shrink-0" />
                          <p className="flex-1 text-[10px] font-bold text-surface-400 uppercase tracking-widest">Project</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden sm:block w-24">Status</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden md:block w-40">Progress</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden sm:block w-24 text-center">Team</p>
                          <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest hidden lg:block w-28">Due Date</p>
                          <div className="w-8 flex-shrink-0" />
                        </div>
                        <AnimatePresence mode="popLayout">
                          {deptProjects.map(project => (
                            <ProjectRow key={project.id} project={project} onDelete={handleDeleteProject} onArchive={handleArchiveProject} onEdit={openEditModal} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        open={canCreateProjects && showModal}
        onClose={closeCreateModal}
        title={editingProject ? 'Edit Project' : 'New Project'}
        description={editingProject ? 'Update the selected project for your team.' : 'Create a new project for your team'}
      >
        <form onSubmit={handleSubmit(onSaveProject)} className="p-6 space-y-5">
          <div>
            <label className="label">Project name *</label>
            <input {...register('name', { required: 'Name is required' })} placeholder="e.g. Website Redesign" className={cn('input', errors.name && 'border-rose-400')} />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} placeholder="What is this project about?" className="input h-auto py-2 resize-none" rows={3} />
          </div>

          <div>
            <label className="label">Department</label>
            <input type="hidden" {...register('department')} />
            <Dropdown
              value={departmentDropdownValue}
              onChange={(value) => {
                if (value === '__custom__') {
                  if (departmentOptions.includes(selectedDepartment)) {
                    setValue('department', '');
                  }
                  return;
                }
                setValue('department', value, { shouldDirty: true, shouldValidate: true });
              }}
              items={[
                ...departmentOptions.map((department) => ({ id: department, label: department })),
                { id: '__custom__', label: 'Custom Department' },
              ]}
            />
            {departmentDropdownValue === '__custom__' && (
              <input
                value={selectedDepartment}
                onChange={(event) => setValue('department', event.target.value, { shouldDirty: true, shouldValidate: true })}
                className="input mt-3 bg-white dark:bg-surface-900"
                placeholder="Enter custom department"
              />
            )}
          </div>

          <div>
            <label className="label">Color</label>
            <ColorPicker
              value={selectedColor}
              onChange={setSelectedColor}
              palette={PROJECT_COLORS}
              helperText="Pick a color accent for project cards and progress."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Start date</label>
              <input {...register('startDate')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Due date</label>
              <input
                {...register('endDate', {
                  validate: (value) => !value || value >= selectedStartDate || 'Due date must be on or after the start date',
                })}
                type="date"
                className={cn('input', errors.endDate && 'border-rose-400')}
                min={selectedStartDate}
              />
              {errors.endDate && <p className="mt-1 text-xs text-rose-500">{errors.endDate.message}</p>}
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Project budget</label>
              <input
                {...register('budget', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 250000"
                className="input"
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <Dropdown
                value={budgetCurrency}
                onChange={(val) => setValue('budgetCurrency', val)}
                items={[
                  { id: 'INR', label: 'INR (₹)' },
                  { id: 'USD', label: 'USD ($)' },
                  { id: 'EUR', label: 'EUR (€)' },
                  { id: 'GBP', label: 'GBP (£)' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="label">Assign Employees</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search employees..."
                className="input pl-9 h-9"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-surface-100 dark:border-surface-800 rounded-xl p-2 space-y-1">
              {availableAssignableUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedMembers.includes(u.id)}
                    onChange={(e) => toggleMemberSelection(u.id, e.target.checked)}
                  />
                  <UserAvatar name={u.name} color={u.color} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{u.name}</p>
                    <p className="text-[10px] text-surface-400 truncate">{u.jobTitle}</p>
                  </div>
                </label>
              ))}
              {availableAssignableUsers.length === 0 && <p className="p-2 text-xs text-surface-400">No employees match this search.</p>}
            </div>
          </div>

          <div>
            <label className="label">Reporting Persons</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                value={reportingSearch}
                onChange={(e) => setReportingSearch(e.target.value)}
                placeholder="Search reporting persons..."
                className="input pl-9 h-9"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-surface-100 dark:border-surface-800 rounded-xl p-2 space-y-1">
              {availableReportingUsers.map(u => (
                <label key={`reporting-${u.id}`} className="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    checked={selectedReportingPersons.includes(u.id)}
                    onChange={(e) => toggleReportingSelection(u.id, e.target.checked)}
                  />
                  <UserAvatar name={u.name} color={u.color} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{u.name}</p>
                    <p className="text-[10px] text-surface-400 truncate">{u.jobTitle}</p>
                  </div>
                </label>
              ))}
              {availableReportingUsers.length === 0 && <p className="p-2 text-xs text-surface-400">No reporting persons match this search.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="label mb-0">Project Categories</p>
                <p className="text-xs text-surface-400">Create work buckets like UI Design, Mobile App Design, Frontend, and Backend.</p>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setProjectCategories((prev) => [
                  ...prev,
                  {
                    id: `category-${Date.now()}`,
                    name: '',
                    color: PROJECT_COLORS[prev.length % PROJECT_COLORS.length],
                    order: prev.length,
                  },
                ])}
              >
                <Plus size={12} /> Add Category
              </button>
            </div>
            <div className="space-y-3">
              {projectCategories.map((category, index) => (
                <div key={category.id || `${category.name}-${index}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_180px_auto] gap-3 items-center">
                  <input
                    value={category.name}
                    onChange={(e) => {
                      const next = [...projectCategories];
                      next[index] = {
                        ...next[index],
                        name: e.target.value,
                        id: next[index].id || slugifyCategory(e.target.value) || `category-${index + 1}`,
                        order: index,
                      };
                      setProjectCategories(next);
                    }}
                    className="input"
                    placeholder="Category name"
                  />
                  <div className="flex items-center gap-3 rounded-xl border border-surface-100 bg-surface-50/70 px-3 py-2 dark:border-surface-800 dark:bg-surface-800/40">
                    <input
                      type="color"
                      value={category.color || PROJECT_COLORS[index % PROJECT_COLORS.length]}
                      onChange={(e) => {
                        const next = [...projectCategories];
                        next[index] = { ...next[index], color: e.target.value, order: index };
                        setProjectCategories(next);
                      }}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-surface-200 bg-transparent p-1 dark:border-surface-700"
                      aria-label={`Pick color for ${category.name || `category ${index + 1}`}`}
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-400">Category Color</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-surface-200 dark:border-surface-700"
                          style={{ backgroundColor: category.color || PROJECT_COLORS[index % PROJECT_COLORS.length] }}
                        />
                        <span className="text-sm text-surface-600 dark:text-surface-300">Pick color</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-rose-500"
                    onClick={() => setProjectCategories((prev) => prev.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex })))}
                    disabled={projectCategories.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="label mb-0">SDLC Planning</p>
                <p className="text-xs text-surface-400">Define each delivery phase and its planned duration in days.</p>
              </div>
              <span className="badge-gray text-xs">{totalPlannedDurationDays} days planned</span>
            </div>
            <div className="space-y-3">
              {sdlcPlan.map((phase, index) => (
                <div key={`${phase.name}-${index}`} className="grid grid-cols-[minmax(0,1.5fr)_120px] gap-3">
                  <div>
                    <input
                      value={phase.name}
                      onChange={(e) => {
                        const next = [...sdlcPlan];
                        next[index] = { ...next[index], name: e.target.value };
                        setSdlcPlan(next);
                      }}
                      className="input"
                      placeholder="SDLC step name"
                    />
                  </div>
                  <div>
                    <input
                      value={phase.durationDays}
                      onChange={(e) => {
                        const next = [...sdlcPlan];
                        next[index] = { ...next[index], durationDays: Math.max(0, Number(e.target.value) || 0) };
                        setSdlcPlan(next);
                      }}
                      type="number"
                      min="0"
                      className="input"
                      placeholder="Days"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeCreateModal} className="btn-secondary btn-md flex-1">Cancel</button>
            <button type="submit" className="btn-primary btn-md flex-1">{editingProject ? 'Save Changes' : 'Create Project'}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={canCreateProjects && importOpen}
        onClose={() => {
          setImportOpen(false);
          resetImportState();
        }}
        title="Import Projects"
        description="Upload an Excel-friendly CSV file to create projects with tasks, subtasks, assignees, and reporting persons."
        size="lg"
      >
        <div className="p-4 sm:p-6 space-y-5">
          <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50/70 p-5 dark:border-surface-700 dark:bg-surface-800/40">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">Step 1: Prepare your file</p>
            <p className="mt-1 text-xs text-surface-500">
              `projectName` is required. `projectKey` is optional and will be auto-generated if it is missing.
              All rows with the same `projectKey` create one project and attach their tasks into it. Duplicate `projectName` values are allowed.
              Users can be matched by full name, email, or employee ID. Use `taskSubtasks` like `Draft copy;Review QA;Publish`.
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-surface-400">Rows Ready</p>
              <p className="mt-1 text-2xl font-display font-bold text-surface-900 dark:text-surface-100">{importRows.length}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wider text-surface-400">Project Groups</p>
              <p className="mt-1 text-2xl font-display font-bold text-surface-900 dark:text-surface-100">
                {new Set(importRows.map((row) => row.projectKey)).size}
              </p>
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
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="text-surface-400">
                      <th className="pb-2 pr-4 font-semibold">Project Key</th>
                      <th className="pb-2 pr-4 font-semibold">Project Name</th>
                      <th className="pb-2 pr-4 font-semibold">Task</th>
                      <th className="pb-2 pr-4 font-semibold">Assignees</th>
                      <th className="pb-2 font-semibold">Reporting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 5).map((row) => (
                      <tr key={`${row.projectKey}-${row.rowNumber}`} className="border-t border-surface-100 dark:border-surface-800">
                        <td className="py-2 pr-4 text-surface-600 dark:text-surface-300">{row.projectKey}</td>
                        <td className="py-2 pr-4 text-surface-800 dark:text-surface-100">{row.projectName}</td>
                        <td className="py-2 pr-4 text-surface-600 dark:text-surface-300">{row.taskTitle || 'Project only row'}</td>
                        <td className="py-2 pr-4 text-surface-500">{row.taskAssigneeNames || row.taskAssigneeEmails || row.memberNames || row.memberEmails || '-'}</td>
                        <td className="py-2 text-surface-500">{row.reportingPersonNames || row.reportingPersonEmails || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-sm font-semibold text-emerald-700">Import finished</p>
              <p className="mt-1 text-xs text-emerald-700">
                Created {importResult.createdCount} project{importResult.createdCount === 1 ? '' : 's'}, {importResult.createdTaskCount} task{importResult.createdTaskCount === 1 ? '' : 's'}, and recorded {importResult.failedCount} failure{importResult.failedCount === 1 ? '' : 's'}.
              </p>
              {importResult.failures.length > 0 && (
                <div className="mt-3 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {importResult.failures.slice(0, 12).map((failure, index) => (
                    <p key={`${failure.rowNumber}-${index}`} className="text-xs text-rose-600">
                      Row {failure.rowNumber}: {failure.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                resetImportState();
              }}
              className="btn-secondary btn-md flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!importRows.length || importParseErrors.length > 0 || isImporting}
              onClick={() => { void handleBulkImport(); }}
              className="btn-primary btn-md flex-1 disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : 'Import Projects'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
