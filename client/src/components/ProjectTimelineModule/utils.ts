import type { ProjectTimeline, TimelineDependency, TimelinePhase, TimelineTask } from '../../app/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type TimelineRow =
  | { kind: 'phase'; id: string; top: number; height: number; phase: TimelinePhase }
  | { kind: 'task'; id: string; top: number; height: number; phase: TimelinePhase; task: TimelineTask };

export const SIDEBAR_WIDTH = 320;
export const PHASE_ROW_HEIGHT = 40;
export const TASK_ROW_HEIGHT = 54;

function toUtcDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateKey(value: string | Date) {
  return toUtcDate(value).toISOString().split('T')[0];
}

export function addDays(dateKey: string, days: number) {
  const base = toUtcDate(dateKey);
  return formatDateKey(new Date(base.getTime() + days * DAY_MS));
}

export function diffDays(start: string, end: string) {
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / DAY_MS);
}

function normalizeDuration(task: TimelineTask) {
  if (task.type === 'milestone') return 1;
  return Math.max(1, diffDays(task.startDate, task.endDate) + 1);
}

function buildDependencyMaps(tasks: TimelineTask[]) {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  for (const task of tasks) {
    incoming.set(task.id, [...task.dependencies]);
    for (const predecessorId of task.dependencies) {
      const items = outgoing.get(predecessorId) || [];
      items.push(task.id);
      outgoing.set(predecessorId, items);
    }
  }

  return { incoming, outgoing };
}

function topoSort(tasks: TimelineTask[]) {
  const { incoming, outgoing } = buildDependencyMaps(tasks);
  const degree = new Map<string, number>();
  for (const task of tasks) degree.set(task.id, incoming.get(task.id)?.length || 0);

  const queue = [...tasks.filter((task) => (degree.get(task.id) || 0) === 0).map((task) => task.id)];
  const ordered: string[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const nextId of outgoing.get(current) || []) {
      const nextDegree = (degree.get(nextId) || 0) - 1;
      degree.set(nextId, nextDegree);
      if (nextDegree === 0) queue.push(nextId);
    }
  }

  return ordered.length === tasks.length ? ordered : tasks.map((task) => task.id);
}

function longestPathIds(tasks: TimelineTask[]) {
  const ordered = topoSort(tasks);
  const { outgoing } = buildDependencyMaps(tasks);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const score = new Map<string, number>();
  const nextHop = new Map<string, string>();

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const id = ordered[index];
    const task = taskMap.get(id)!;
    const base = normalizeDuration(task);
    let best = base;
    let bestNext = '';

    for (const nextId of outgoing.get(id) || []) {
      const candidate = base + (score.get(nextId) || 0);
      if (candidate > best) {
        best = candidate;
        bestNext = nextId;
      }
    }

    score.set(id, best);
    if (bestNext) nextHop.set(id, bestNext);
  }

  let startId = '';
  let longest = 0;
  for (const [id, value] of score.entries()) {
    if (value > longest) {
      longest = value;
      startId = id;
    }
  }

  const result = new Set<string>();
  let cursor = startId;
  while (cursor) {
    result.add(cursor);
    cursor = nextHop.get(cursor) || '';
  }
  return result;
}

export function recomputeTimeline(base: ProjectTimeline): ProjectTimeline {
  const flatTasks = base.phases.flatMap((phase) => phase.tasks);
  const orderedPhaseMap = new Map(base.phases.map((phase) => [phase.id, phase]));

  const earliestTaskStart = flatTasks.length
    ? [...flatTasks].sort((a, b) => a.startDate.localeCompare(b.startDate))[0].startDate
    : base.projectWindow.startDate;
  const latestTaskEnd = flatTasks.length
    ? [...flatTasks].sort((a, b) => b.endDate.localeCompare(a.endDate))[0].endDate
    : base.projectWindow.endDate;
  const projectStart = earliestTaskStart < base.projectWindow.startDate ? earliestTaskStart : base.projectWindow.startDate;
  const projectEnd = latestTaskEnd > base.projectWindow.endDate ? latestTaskEnd : base.projectWindow.endDate;
  const criticalIds = longestPathIds(flatTasks);

  const tasks = flatTasks.map((task) => {
    const durationInDays = normalizeDuration(task);
    return {
      ...task,
      durationInDays,
      startOffset: diffDays(projectStart, task.startDate),
      endOffset: diffDays(projectStart, task.endDate),
      predecessorIds: [...task.dependencies],
      isCritical: criticalIds.has(task.id),
    };
  });

  const dependencies: TimelineDependency[] = [];
  for (const task of tasks) {
    for (const fromTaskId of task.dependencies) {
      dependencies.push({
        id: `${fromTaskId}:${task.id}`,
        fromTaskId,
        toTaskId: task.id,
        type: 'finish_to_start',
      });
    }
  }

  const phases = base.phases.map((phase) => ({
    ...phase,
    tasks: tasks.filter((task) => task.phaseId === phase.id),
  }));

  const ungrouped = tasks.filter((task) => !task.phaseId || !orderedPhaseMap.has(task.phaseId));
  const mergedPhases = [...phases];
  if (ungrouped.length) {
    mergedPhases.push({
      id: 'ungrouped',
      projectId: base.projectId,
      name: 'Ungrouped',
      order: Number.MAX_SAFE_INTEGER,
      color: '#64748b',
      tasks: ungrouped,
    });
  }

  const conflicts = [];
  const buckets = new Map<string, TimelineTask[]>();
  for (const task of tasks) {
    for (const assigneeId of task.assigneeIds) {
      const items = buckets.get(assigneeId) || [];
      items.push(task);
      buckets.set(assigneeId, items);
    }
  }

  for (const [assigneeId, items] of buckets.entries()) {
    const sorted = [...items].sort((a, b) => a.startOffset - b.startOffset);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.startOffset <= previous.endOffset) {
        conflicts.push({
          assigneeId,
          taskIds: [previous.id, current.id],
          startDate: current.startDate,
          endDate: previous.endDate,
        });
      }
    }
  }

  return {
    ...base,
    projectWindow: {
      startDate: projectStart,
      endDate: projectEnd,
      totalDays: Math.max(1, diffDays(projectStart, projectEnd) + 1),
      todayOffset: diffDays(projectStart, formatDateKey(new Date())),
    },
    phases: mergedPhases,
    tasks,
    dependencies,
    resourceConflicts: conflicts,
    summary: {
      totalTasks: tasks.length,
      criticalTasks: tasks.filter((task) => task.isCritical).length,
      overdueTasks: tasks.filter((task) => task.status !== 'done' && task.endDate < formatDateKey(new Date())).length,
      milestoneCount: tasks.filter((task) => task.type === 'milestone').length,
    },
  };
}

export function flattenTimelineRows(phases: TimelinePhase[], collapsedPhaseIds: Set<string> = new Set()) {
  const rows: TimelineRow[] = [];
  let top = 0;

  for (const phase of phases.sort((a, b) => a.order - b.order)) {
    rows.push({ kind: 'phase', id: `phase-${phase.id}`, top, height: PHASE_ROW_HEIGHT, phase });
    top += PHASE_ROW_HEIGHT;

    if (collapsedPhaseIds.has(phase.id)) {
      continue;
    }

    for (const task of phase.tasks) {
      rows.push({ kind: 'task', id: task.id, top, height: TASK_ROW_HEIGHT, phase, task });
      top += TASK_ROW_HEIGHT;
    }
  }

  return { rows, totalHeight: top };
}

export function getVisibleRows(rows: TimelineRow[], scrollTop: number, viewportHeight: number, overscan = 8) {
  const min = Math.max(0, scrollTop - overscan * TASK_ROW_HEIGHT);
  const max = scrollTop + viewportHeight + overscan * TASK_ROW_HEIGHT;
  return rows.filter((row) => row.top + row.height >= min && row.top <= max);
}

export function buildMonthSegments(startDate: string, totalDays: number) {
  const segments: Array<{ label: string; startOffset: number; span: number }> = [];
  let cursor = 0;

  while (cursor < totalDays) {
    const current = toUtcDate(addDays(startDate, cursor));
    const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
    const monthOffset = diffDays(startDate, formatDateKey(monthStart));
    const monthEndOffset = diffDays(startDate, formatDateKey(new Date(nextMonth.getTime() - DAY_MS)));
    const span = Math.min(totalDays - Math.max(0, monthOffset), monthEndOffset - Math.max(0, monthOffset) + 1);

    segments.push({
      label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      startOffset: Math.max(0, monthOffset),
      span,
    });
    cursor = monthEndOffset + 1;
  }

  return segments.filter((segment) => segment.span > 0);
}

export function getDayWidth(zoom: 'day' | 'week' | 'month') {
  if (zoom === 'day') return 72;
  if (zoom === 'week') return 48;
  return 24;
}
