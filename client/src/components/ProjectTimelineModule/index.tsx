import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Calendar,
  Expand,
  FileSpreadsheet,
  GitBranchPlus,
  Image as ImageIcon,
  Lock,
  Minimize2,
  RefreshCcw,
  Save,
  Sparkles,
  Target,
  Unlock,
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { projectsService, tasksService, timelineService } from '../../services/api';
import { emitErrorToast, emitSuccessToast } from '../../context/toastBus';
import { useAppStore } from '../../context/appStore';
import { useAuthStore } from '../../context/authStore';
import type { Project, ProjectTimeline } from '../../app/types';
import { Modal } from '../Modal';
import Sidebar from './Sidebar';
import TimelineGrid from './TimelineGrid';
import {
  SIDEBAR_WIDTH,
  addDays,
  flattenTimelineRows,
  getDayWidth,
  getVisibleRows,
  recomputeTimeline,
} from './utils';

interface ProjectTimelineModuleProps {
  projectId: string;
}

type CreateMode = 'phase' | 'task' | null;

function sameArray(a: string[] = [], b: string[] = []) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function canReachTask(startTaskId: string, targetTaskId: string, edges: Array<{ fromTaskId: string; toTaskId: string }>) {
  if (startTaskId === targetTaskId) return true;

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const items = outgoing.get(edge.fromTaskId) || [];
    items.push(edge.toTaskId);
    outgoing.set(edge.fromTaskId, items);
  }

  const queue = [startTaskId];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const nextTaskId of outgoing.get(current) || []) {
      if (nextTaskId === targetTaskId) return true;
      if (!visited.has(nextTaskId)) queue.push(nextTaskId);
    }
  }

  return false;
}

export const ProjectTimelineModule: React.FC<ProjectTimelineModuleProps> = ({ projectId }) => {
  const { users } = useAppStore();
  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [draftTimeline, setDraftTimeline] = useState<ProjectTimeline | null>(null);
  const [loadError, setLoadError] = useState<{ title: string; description: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedPhaseIds, setCollapsedPhaseIds] = useState<Set<string>>(new Set());
  const [selectedDependencyFrom, setSelectedDependencyFrom] = useState('');
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [draftName, setDraftName] = useState('');
  const [draftTaskPhaseId, setDraftTaskPhaseId] = useState('');
  const [draftTaskStartDate, setDraftTaskStartDate] = useState('');
  const [draftTaskDurationDays, setDraftTaskDurationDays] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(640);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeTimeline = draftTimeline || timeline;
  const deferredTimeline = useDeferredValue(activeTimeline);
  const canManageLockedTimeline = user?.role === 'admin' || user?.role === 'super_admin';
  const isReadOnly = activeTimeline?.status === 'Approved';
  const zoom = activeTimeline?.settings.zoom || 'week';
  const baseDayWidth = getDayWidth(zoom);
  const dayWidth = isFullscreen ? Math.max(baseDayWidth + 14, Math.round(baseDayWidth * 2.1)) : baseDayWidth;
  const selectablePhases = (activeTimeline?.phases || []).filter((phase) => phase.id !== 'ungrouped');
  const collapsiblePhases = (activeTimeline?.phases || []).map((phase) => phase.id);

  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [timelineRes, projectRes] = await Promise.all([
        timelineService.get(projectId),
        projectsService.getById(projectId),
      ]);

      setTimeline(timelineRes.data.data);
      setDraftTimeline(null);
      setSelectedDependencyFrom('');
      setProject(projectRes.data.data ?? projectRes.data);
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.response?.data?.error?.code;
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Failed to load timeline';

      if (status === 400 && code === 'TIMELINE_CYCLE') {
        setLoadError({
          title: 'Timeline has a circular dependency',
          description: 'One or more tasks depend on each other in a loop. Remove the conflicting dependency chain before reopening the timeline view.',
        });
      } else {
        setLoadError({
          title: 'Timeline could not be loaded',
          description: message,
        });
      }

      setTimeline(null);
      setDraftTimeline(null);
      emitErrorToast(message, 'Timeline');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    setCollapsedPhaseIds((current) => {
      if (!activeTimeline) return current;
      const validIds = new Set(activeTimeline.phases.map((phase) => phase.id));
      return new Set(Array.from(current).filter((phaseId) => validIds.has(phaseId)));
    });
  }, [activeTimeline]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const syncSize = () => setViewportHeight(element.clientHeight);
    syncSize();
    window.addEventListener('resize', syncSize);
    return () => window.removeEventListener('resize', syncSize);
  }, [isFullscreen]);

  const { rows, totalHeight } = useMemo(
    () => deferredTimeline ? flattenTimelineRows(deferredTimeline.phases, collapsedPhaseIds) : { rows: [], totalHeight: 0 },
    [collapsedPhaseIds, deferredTimeline]
  );
  const visibleRows = useMemo(
    () => getVisibleRows(rows, scrollTop, viewportHeight),
    [rows, scrollTop, viewportHeight]
  );
  const timelineCanvasHeight = Math.max(totalHeight + 56, 220);

  const closeCreateModal = useCallback(() => {
    setCreateMode(null);
    setDraftName('');
    setDraftTaskPhaseId('');
    setDraftTaskStartDate('');
    setDraftTaskDurationDays(1);
  }, []);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  const applyDraftMutation = useCallback((mutator: (current: ProjectTimeline) => ProjectTimeline) => {
    startTransition(() => {
      setDraftTimeline((currentDraft) => {
        const source = currentDraft || timeline;
        if (!source) return currentDraft;
        return recomputeTimeline(mutator(source));
      });
    });
  }, [timeline]);

  const persistTimelineStructure = useCallback(async (source: ProjectTimeline) => {
    const response = await timelineService.upsert(projectId, {
      status: source.status,
      settings: source.settings,
      phases: source.phases
        .filter((phase) => phase.id !== 'ungrouped')
        .map(({ id, name, order, color }) => ({
          id: id.startsWith('phase-temp-') ? undefined : id,
          name,
          order,
          color,
        })),
    });

    return response.data.data as ProjectTimeline;
  }, [projectId]);

  const persistDraftChanges = useCallback(async (sourceTimeline: ProjectTimeline, baseTimeline: ProjectTimeline) => {
    await persistTimelineStructure(sourceTimeline);

    const baseTaskMap = new Map(baseTimeline.tasks.map((task) => [task.id, task]));
    const changedTasks = sourceTimeline.tasks.filter((task) => {
      const previous = baseTaskMap.get(task.id);
      if (!previous) return true;
      return (
        task.startDate !== previous.startDate ||
        task.endDate !== previous.endDate ||
        task.phaseId !== previous.phaseId ||
        task.type !== previous.type ||
        !sameArray(task.dependencies, previous.dependencies)
      );
    });

    for (const task of changedTasks) {
      await timelineService.patchTask(task.id, {
        projectId,
        startDate: task.startDate,
        endDate: task.endDate,
        phaseId: task.phaseId || null,
        dependencies: task.dependencies,
        type: task.type,
      });
    }
  }, [persistTimelineStructure, projectId]);

  const exportTimelineExcel = useCallback(() => {
    if (!activeTimeline || !project) return;

    const rowsHtml = activeTimeline.phases
      .flatMap((phase) => phase.tasks.map((task) => `
        <tr>
          <td>${phase.name}</td>
          <td>${task.title}</td>
          <td>${task.type}</td>
          <td>${task.startDate}</td>
          <td>${task.endDate}</td>
          <td>${task.durationInDays}</td>
          <td>${task.status}</td>
          <td>${task.dependencies.join(', ')}</td>
        </tr>
      `))
      .join('');

    const workbookHtml = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Task</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration (days)</th>
                <th>Status</th>
                <th>Dependencies</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    downloadBlob(
      new Blob([workbookHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
      `${project.name.replace(/\s+/g, '-').toLowerCase()}-timeline.xls`
    );
  }, [activeTimeline, downloadBlob, project]);

  const exportTimelineDiagram = useCallback(() => {
    if (!activeTimeline || !project) return;

    const headerHeight = 56;
    const sidebarWidth = SIDEBAR_WIDTH;
    const dayCellWidth = 22;
    const rightPadding = 80;
    const width = sidebarWidth + activeTimeline.projectWindow.totalDays * dayCellWidth + rightPadding;
    const height = timelineCanvasHeight + 32;
    const dependencyRows = new Map(rows.filter((row) => row.kind === 'task').map((row) => [row.task.id, row]));

    const backgroundColumns = Array.from({ length: activeTimeline.projectWindow.totalDays }).map((_, index) => {
      const fill = Math.floor(index / 7) % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `<rect x="${sidebarWidth + index * dayCellWidth}" y="${headerHeight}" width="${dayCellWidth}" height="${timelineCanvasHeight - headerHeight}" fill="${fill}" stroke="#e2e8f0" stroke-width="0.5" />`;
    }).join('');

    const phaseBands = rows.map((row) => {
      if (row.kind === 'phase') {
        return `
          <rect x="0" y="${row.top + headerHeight}" width="${width}" height="${row.height}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
          <text x="28" y="${row.top + headerHeight + 25}" fill="#64748b" font-size="12" font-weight="700" letter-spacing="2">${row.phase.name.toUpperCase()}</text>
        `;
      }

      const barX = sidebarWidth + row.task.startOffset * dayCellWidth;
      const barWidth = Math.max(dayCellWidth, row.task.durationInDays * dayCellWidth);
      const barY = row.top + headerHeight + 10;
      return `
        <rect x="0" y="${row.top + headerHeight}" width="${width}" height="${row.height}" fill="#ffffff" stroke="#eef2f7" stroke-width="1" />
        <text x="24" y="${row.top + headerHeight + 24}" fill="#0f172a" font-size="12" font-weight="700">${row.task.title}</text>
        <text x="24" y="${row.top + headerHeight + 42}" fill="#94a3b8" font-size="10">${row.task.startDate} to ${row.task.endDate}</text>
        <rect x="${barX}" y="${barY}" width="${barWidth}" height="${row.height - 20}" rx="10" ry="10" fill="#2563eb" opacity="0.92" />
        <text x="${barX + 14}" y="${barY + 18}" fill="#ffffff" font-size="12" font-weight="700">${row.task.title}</text>
      `;
    }).join('');

    const dependencyLines = activeTimeline.dependencies.map((dependency) => {
      const fromRow = dependencyRows.get(dependency.fromTaskId);
      const toRow = dependencyRows.get(dependency.toTaskId);
      if (!fromRow || !toRow || fromRow.kind !== 'task' || toRow.kind !== 'task') return '';

      const fromX = sidebarWidth + (fromRow.task.endOffset + 1) * dayCellWidth;
      const fromY = headerHeight + fromRow.top + fromRow.height / 2;
      const toX = sidebarWidth + toRow.task.startOffset * dayCellWidth;
      const toY = headerHeight + toRow.top + toRow.height / 2;
      const destinationX = Math.max(sidebarWidth, toX - 8);
      const sameRow = Math.abs(fromY - toY) < 2;
      const routeX = Math.min(width - 20, fromX + 24);
      const d = sameRow
        ? `M ${fromX} ${fromY} L ${routeX} ${fromY} L ${routeX} ${Math.max(14, fromY - 18)} L ${destinationX} ${Math.max(14, fromY - 18)} L ${destinationX} ${toY}`
        : `M ${fromX} ${fromY} L ${routeX} ${fromY} L ${routeX} ${toY} L ${destinationX} ${toY}`;
      return `<path d="${d}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="6 4" />`;
    }).join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#f8fafc" />
        <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="#ffffff" />
        <rect x="0" y="0" width="${sidebarWidth}" height="${height}" fill="#ffffff" />
        <text x="24" y="34" fill="#94a3b8" font-size="14" font-weight="700" letter-spacing="3">TIMELINE OUTLINE</text>
        ${backgroundColumns}
        ${phaseBands}
        ${dependencyLines}
      </svg>
    `;

    downloadBlob(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
      `${project.name.replace(/\s+/g, '-').toLowerCase()}-timeline-diagram.svg`
    );
  }, [activeTimeline, downloadBlob, project, rows, timelineCanvasHeight]);

  const handleExportTimeline = useCallback(async (format: 'excel' | 'diagram') => {
    try {
      setIsExporting(true);
      if (format === 'excel') exportTimelineExcel();
      else exportTimelineDiagram();
      emitSuccessToast(`Timeline exported as ${format === 'excel' ? 'Excel' : 'diagram'}`, 'Timeline');
    } catch (error: any) {
      emitErrorToast(error?.message || 'Failed to export timeline', 'Timeline');
    } finally {
      setIsExporting(false);
    }
  }, [exportTimelineDiagram, exportTimelineExcel]);

  const handleTaskCommit = useCallback(async (taskId: string, nextStartDate: string, nextEndDate: string) => {
    if (isReadOnly) return;

    // Persist immediately to the backend
    try {
      const task = (activeTimeline?.tasks || []).find((t) => t.id === taskId);
      if (!task) return;

      await timelineService.patchTask(taskId, {
        projectId,
        startDate: nextStartDate,
        endDate: nextEndDate,
        phaseId: task.phaseId || null,
        dependencies: task.dependencies,
        type: task.type,
      });

      // Refresh to sync everything (like critical path or resource conflicts)
      await fetchTimeline();
      emitSuccessToast('Task schedule updated', 'Timeline');
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.message || 'Failed to sync task change', 'Timeline');
    }
  }, [activeTimeline?.tasks, fetchTimeline, isReadOnly, projectId]);

  const handleSelectDependency = useCallback((taskId: string) => {
    if (!activeTimeline || isReadOnly) return;

    if (selectedDependencyFrom && selectedDependencyFrom !== taskId) {
      if (activeTimeline.dependencies.some((dependency) => (
        dependency.fromTaskId === selectedDependencyFrom && dependency.toTaskId === taskId
      ))) {
        emitErrorToast('These tasks are already linked.', 'Timeline');
        setSelectedDependencyFrom('');
        return;
      }

      if (canReachTask(taskId, selectedDependencyFrom, activeTimeline.dependencies)) {
        emitErrorToast('This link would create a circular dependency. Choose a later task instead.', 'Timeline');
        setSelectedDependencyFrom('');
        return;
      }

      const createLink = async () => {
        try {
          if (draftTimeline && timeline) {
            await persistDraftChanges(draftTimeline, timeline);
          }

          await timelineService.createDependency({
            projectId,
            fromTaskId: selectedDependencyFrom,
            toTaskId: taskId,
          });

          await fetchTimeline();
          emitSuccessToast('Tasks linked', 'Timeline');
        } catch (error: any) {
          emitErrorToast(error?.response?.data?.message || 'Failed to link tasks', 'Timeline');
        } finally {
          setSelectedDependencyFrom('');
        }
      };

      void createLink();
      return;
    }

    setSelectedDependencyFrom((current) => current === taskId ? '' : taskId);
  }, [activeTimeline, draftTimeline, fetchTimeline, isReadOnly, persistDraftChanges, projectId, selectedDependencyFrom, timeline]);

  const handleZoom = (nextZoom: 'day' | 'week' | 'month') => {
    if (isReadOnly) return;
    applyDraftMutation((current) => ({
      ...current,
      settings: { ...current.settings, zoom: nextZoom },
    }));
  };

  const togglePhase = useCallback((phaseId: string) => {
    setCollapsedPhaseIds((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  const collapseAllPhases = useCallback(() => {
    setCollapsedPhaseIds(new Set(collapsiblePhases));
  }, [collapsiblePhases]);

  const expandAllPhases = useCallback(() => {
    setCollapsedPhaseIds(new Set());
  }, []);

  const openCreatePhaseModal = () => {
    if (!activeTimeline || isReadOnly) return;
    setDraftName(`New Phase ${selectablePhases.length + 1}`);
    setCreateMode('phase');
  };

  const openCreateTaskModal = () => {
    if (!project || isReadOnly) return;
    setDraftName('');
    setDraftTaskPhaseId(selectablePhases[0]?.id || '');
    setDraftTaskStartDate(project.startDate || activeTimeline?.projectWindow.startDate || new Date().toISOString().split('T')[0]);
    setDraftTaskDurationDays(1);
    setCreateMode('task');
  };

  const handleCreateSubmit = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      emitErrorToast('Please enter a name first.', 'Timeline');
      return;
    }

    if (!activeTimeline || isReadOnly) return;

    setIsCreating(true);
    try {
      if (createMode === 'phase') {
        const realPhases = activeTimeline.phases.filter((phase) => phase.id !== 'ungrouped');
        const nextTimeline = recomputeTimeline({
          ...activeTimeline,
          phases: [
            ...realPhases,
            {
              id: `phase-temp-${Date.now()}`,
              projectId: activeTimeline.projectId,
              name: trimmedName,
              order: realPhases.length,
              color: '#2563eb',
              tasks: [],
            },
          ],
        });

        await persistTimelineStructure(nextTimeline);
        await fetchTimeline();
        emitSuccessToast('Phase added', 'Timeline');
      }

      if (createMode === 'task') {
        if (!project) return;
        if (!draftTaskStartDate) {
          emitErrorToast('Please choose a start date.', 'Timeline');
          return;
        }
        const durationDays = Math.max(1, Number(draftTaskDurationDays) || 1);

        let timelineForTask = activeTimeline;
        if (draftTimeline?.phases.some((phase) => phase.id.startsWith('phase-temp-'))) {
          timelineForTask = await persistTimelineStructure(draftTimeline);
        }

        const selectedPhase = timelineForTask?.phases.find(
          (phase) => phase.id === draftTaskPhaseId && !phase.id.startsWith('phase-temp-')
        );

        await tasksService.create({
          projectId,
          title: trimmedName,
          startDate: draftTaskStartDate,
          dueDate: addDays(draftTaskStartDate, durationDays - 1),
          durationDays,
          phaseId: selectedPhase?.id,
          type: 'task',
          assigneeIds: [],
        });

        await fetchTimeline();
        emitSuccessToast('Task created', 'Timeline');
      }

      closeCreateModal();
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.message || `Failed to create ${createMode}`, 'Timeline');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddTask = async () => {
    if (!project || isReadOnly) return;
    openCreateTaskModal();
  };



  const [isLocking, setIsLocking] = useState(false);

  const handleLockToggle = async () => {
    if (!activeTimeline || !canManageLockedTimeline) return;

    try {
      setIsLocking(true);
      const isCurrentlyApproved = activeTimeline.status === 'Approved';
      if (isCurrentlyApproved) {
        await timelineService.unlock(projectId);
      } else {
        await timelineService.lock(projectId);
      }
      
      // Refresh timeline state and UI
      await fetchTimeline();
      emitSuccessToast(
        isCurrentlyApproved ? 'Timeline unlocked - edit mode enabled' : 'Timeline approved and locked', 
        'Timeline'
      );
    } catch (error: any) {
      console.error('Lock toggle failed:', error);
      emitErrorToast(
        error?.response?.data?.message || 'Failed up update timeline lock status',
        'Timeline'
      );
    } finally {
      setIsLocking(false);
    }
  };

  const handleProjectDateChange = async (field: 'startDate' | 'endDate', value: string) => {
    if (isReadOnly) return;
    try {
      await projectsService.update(projectId, { [field]: value });
      await fetchTimeline();
      emitSuccessToast(`Project ${field === 'startDate' ? 'start' : 'due'} date updated`, 'Timeline');
    } catch (error: any) {
      emitErrorToast(error?.response?.data?.message || 'Failed to update project date', 'Timeline');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-[28px] border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-950">
        <div className="text-sm text-surface-400">Loading timeline...</div>
      </div>
    );
  }

  if (loadError || !activeTimeline) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-rose-200 bg-white p-8 dark:border-rose-900/40 dark:bg-surface-950">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
            {loadError?.title || 'Timeline is unavailable'}
          </h3>
          <p className="mt-3 text-sm leading-6 text-surface-500 dark:text-surface-400">
            {loadError?.description || 'The timeline data could not be loaded for this project.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void fetchTimeline()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderTimelineBody = (fullscreen: boolean) => {
    const rowsForView = fullscreen ? rows : visibleRows;

    return (
      <>
      <div className="rounded-[28px] border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-400">Project Timeline</div>
            <h3 className="mt-1 text-lg font-semibold text-surface-900 dark:text-surface-100">{project?.name}</h3>
            <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
              Drag tasks to move dates, use the edge handles to resize them, and use Link to connect dependencies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={isReadOnly} onClick={() => handleZoom('day')} className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${zoom === 'day' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 dark:bg-surface-900 dark:text-surface-400'}`}>Day</button>
            <button type="button" disabled={isReadOnly} onClick={() => handleZoom('week')} className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${zoom === 'week' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 dark:bg-surface-900 dark:text-surface-400'}`}>Week</button>
            <button type="button" disabled={isReadOnly} onClick={() => handleZoom('month')} className={`rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${zoom === 'month' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500 dark:bg-surface-900 dark:text-surface-400'}`}>Month</button>
            <button type="button" disabled={isReadOnly} onClick={openCreatePhaseModal} className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-900 dark:text-surface-300">Add Phase</button>
            <button type="button" disabled={isReadOnly} onClick={handleAddTask} className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-900 dark:text-surface-300">Add Task</button>
            <button type="button" onClick={expandAllPhases} className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 dark:bg-surface-900 dark:text-surface-300">Open Phases</button>
            <button type="button" onClick={collapseAllPhases} className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 dark:bg-surface-900 dark:text-surface-300">Close Phases</button>
            <button type="button" disabled={isExporting} onClick={() => void handleExportTimeline('excel')} className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-900 dark:text-surface-300">
              <FileSpreadsheet size={14} className="mr-1 inline-block" />
              Excel
            </button>
            <button type="button" disabled={isExporting} onClick={() => void handleExportTimeline('diagram')} className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-900 dark:text-surface-300">
              <ImageIcon size={14} className="mr-1 inline-block" />
              Diagram
            </button>
            <button 
              type="button" 
              disabled={!canManageLockedTimeline || isLocking} 
              onClick={handleLockToggle} 
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50",
                activeTimeline.status === 'Approved' 
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300"
                  : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-900 dark:text-surface-300"
              )}
            >
              {isLocking ? (
                <div className="flex items-center gap-1.5 animation-pulse">
                   <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                   <span>Syncing...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {activeTimeline.status === 'Approved' ? <Unlock size={14} /> : <Lock size={14} />}
                  <span>{activeTimeline.status === 'Approved' ? 'Unlock Draft' : 'Approve & Lock'}</span>
                </div>
              )}
            </button>

          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1 text-[11px] font-bold text-surface-600 dark:bg-surface-900 dark:text-surface-300 border border-surface-200/50 dark:border-surface-800/50 shadow-sm">
            <Calendar size={13} className="text-brand-500" />
            <input
              type="date"
              value={project?.startDate || activeTimeline.projectWindow.startDate}
              onChange={(e) => handleProjectDateChange('startDate', e.target.value)}
              disabled={isReadOnly}
              className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title="Project Start Date"
            />
            <span className="opacity-30">to</span>
            <input
              type="date"
              value={project?.endDate || activeTimeline.projectWindow.endDate}
              onChange={(e) => handleProjectDateChange('endDate', e.target.value)}
              disabled={isReadOnly}
              className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-brand-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title="Project End Date"
            />
          </div>
          <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-medium text-surface-500 dark:bg-surface-900 dark:text-surface-300">
            <Target size={12} className="mr-1 inline-block" />
            {activeTimeline.summary.criticalTasks} critical tasks
          </span>
          <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-medium text-surface-500 dark:bg-surface-900 dark:text-surface-300">
            <AlertTriangle size={12} className="mr-1 inline-block" />
            {activeTimeline.resourceConflicts.length} resource conflicts
          </span>
          {isReadOnly ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              Locked for editing. Only admins can change this approved timeline.
            </span>
          ) : null}

          {selectedDependencyFrom ? (() => {
            const selectedTask = activeTimeline?.tasks.find((t) => t.id === selectedDependencyFrom);
            return (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                <GitBranchPlus size={12} className="mr-1 inline-block" />
                Select the task that should start after <span className="font-bold underline decoration-brand-400/40 underline-offset-2">{selectedTask?.title || selectedDependencyFrom}</span>
              </span>
            );
          })() : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-950">
        <div className="grid" style={{ gridTemplateColumns: `${SIDEBAR_WIDTH}px minmax(0, 1fr)` }}>
          <Sidebar
            rows={rowsForView}
            totalHeight={totalHeight}
            viewportHeight={viewportHeight}
            scrollTop={scrollTop}
            containerClassName={fullscreen ? 'h-[calc(100vh-280px)] min-h-[520px]' : undefined}
            users={users}
            selectedDependencyFrom={selectedDependencyFrom}
            onSelectDependencyFrom={handleSelectDependency}
            collapsedPhaseIds={collapsedPhaseIds}
            onTogglePhase={togglePhase}
          />
          <div
            ref={scrollRef}
            className={fullscreen ? 'h-[calc(100vh-280px)] min-h-[520px] overflow-auto overscroll-contain scroll-smooth' : 'h-[72vh] overflow-auto overscroll-contain scroll-smooth'}
            onWheel={(event) => {
              const element = event.currentTarget;
              if (Math.abs(event.deltaX) > 0) return;
              if (event.shiftKey) {
                event.preventDefault();
                element.scrollLeft += event.deltaY;
              }
            }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            style={{ scrollbarGutter: 'stable both-edges' }}
          >
            <TimelineGrid
              timeline={activeTimeline}
              rows={rowsForView}
              allRows={rows}
              totalHeight={totalHeight}
              dayWidth={dayWidth}
              extraRightPadding={fullscreen ? 180 : 80}
              onTaskCommit={handleTaskCommit}
              users={users}
            />
          </div>
        </div>
      </div>
    </>
  );
  };

  return (
    <div className="space-y-4">
      {!isFullscreen ? renderTimelineBody(false) : null}

      <button
        type="button"
        onClick={() => {
          setScrollTop(0);
          setIsFullscreen(true);
        }}
        className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl transition-transform hover:scale-105"
        title="Open full timeline view"
      >
        <Expand size={20} />
      </button>

      {isFullscreen ? (
        <div className="fixed inset-0 z-50 bg-surface-950/50 p-3 backdrop-blur-md">
          <div className="mx-auto flex h-full max-w-[99vw] flex-col overflow-hidden rounded-[32px] border border-surface-200 bg-surface-50 shadow-2xl dark:border-surface-700 dark:bg-surface-950">
            <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4 dark:border-surface-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-400">Full Timeline View</p>
                <h3 className="mt-1 text-2xl font-semibold text-surface-900 dark:text-surface-100">{project?.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScrollTop(0);
                  setIsFullscreen(false);
                }}
                className="rounded-xl bg-surface-100 px-3 py-2 text-xs font-semibold text-surface-600 dark:bg-surface-900 dark:text-surface-300"
              >
                <Minimize2 size={14} className="mr-1 inline-block" />
                Exit Full View
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {renderTimelineBody(true)}
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={createMode !== null}
        onClose={closeCreateModal}
        title={createMode === 'phase' ? 'Add Phase' : 'Add Task'}
        description={createMode === 'phase' ? 'Give the new phase a clear name.' : 'Name the task and choose its phase.'}
        size="sm"
      >
        <div className="space-y-4 p-6">
          <div>
            <label className="label">{createMode === 'phase' ? 'Phase name' : 'Task name'}</label>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreateSubmit();
                }
              }}
              placeholder={createMode === 'phase' ? 'e.g. Development' : 'e.g. API integration'}
              className="input"
              autoFocus
            />
          </div>

          {createMode === 'task' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Phase</label>
                <select
                  value={draftTaskPhaseId}
                  onChange={(event) => setDraftTaskPhaseId(event.target.value)}
                  className="input"
                >
                  <option value="">No phase</option>
                  {selectablePhases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Start Date</label>
                <input
                  value={draftTaskStartDate}
                  onChange={(event) => setDraftTaskStartDate(event.target.value)}
                  type="date"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Duration (days)</label>
                <input
                  value={draftTaskDurationDays}
                  onChange={(event) => setDraftTaskDurationDays(Math.max(1, Number(event.target.value) || 1))}
                  type="number"
                  min={1}
                  step={1}
                  className="input"
                />
              </div>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeCreateModal} className="btn-secondary btn-md flex-1" disabled={isCreating}>
              Cancel
            </button>
            <button type="button" onClick={() => void handleCreateSubmit()} className="btn-primary btn-md flex-1" disabled={isCreating}>
              {isCreating ? 'Creating...' : createMode === 'phase' ? 'Create Phase' : 'Create Task'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectTimelineModule;
