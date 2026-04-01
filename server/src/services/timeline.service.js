import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PHASE_COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#dc2626', '#0891b2'];

function strId(value) {
  return value ? String(value) : '';
}

function toUtcMidnight(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateKey(value) {
  const date = toUtcMidnight(value);
  return date ? date.toISOString().split('T')[0] : null;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function diffInDays(start, end) {
  return Math.round((toUtcMidnight(end).getTime() - toUtcMidnight(start).getTime()) / DAY_MS);
}

function clampDuration(startDate, endDate, type) {
  if (!startDate || !endDate) return type === 'milestone' ? 1 : 1;
  if (type === 'milestone') return 1;
  return Math.max(1, diffInDays(startDate, endDate) + 1);
}

function buildDependencyMaps(tasks) {
  const incoming = new Map();
  const outgoing = new Map();

  for (const task of tasks) {
    const id = strId(task._id || task.id);
    const deps = Array.isArray(task.dependencies) ? task.dependencies.map(strId).filter(Boolean) : [];
    incoming.set(id, deps);

    for (const depId of deps) {
      const items = outgoing.get(depId) || [];
      items.push(id);
      outgoing.set(depId, items);
    }
  }

  return { incoming, outgoing };
}

function validateDependencyDag(tasks) {
  const ids = new Set(tasks.map((task) => strId(task._id || task.id)));
  const { incoming, outgoing } = buildDependencyMaps(tasks);
  const inDegree = new Map();

  for (const task of tasks) {
    const id = strId(task._id || task.id);
    const deps = (incoming.get(id) || []).filter((depId) => ids.has(depId));
    inDegree.set(id, deps.length);
  }

  const queue = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id);
  }

  const ordered = [];
  while (queue.length) {
    const current = queue.shift();
    ordered.push(current);
    for (const nextId of outgoing.get(current) || []) {
      if (!inDegree.has(nextId)) continue;
      const nextDegree = (inDegree.get(nextId) || 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree === 0) queue.push(nextId);
    }
  }

  if (ordered.length !== tasks.length) {
    const err = new Error('Task dependencies must form a DAG. Circular dependency detected.');
    err.statusCode = 400;
    err.code = 'TIMELINE_CYCLE';
    throw err;
  }

  return ordered;
}

function longestPathByDuration(orderedIds, taskMap, outgoingMap) {
  const score = new Map();
  const nextHop = new Map();

  for (let index = orderedIds.length - 1; index >= 0; index -= 1) {
    const id = orderedIds[index];
    const task = taskMap.get(id);
    const base = task.durationInDays || 1;
    let bestScore = base;
    let bestNext = null;

    for (const nextId of outgoingMap.get(id) || []) {
      const candidate = base + (score.get(nextId) || 0);
      if (candidate > bestScore) {
        bestScore = candidate;
        bestNext = nextId;
      }
    }

    score.set(id, bestScore);
    if (bestNext) nextHop.set(id, bestNext);
  }

  let startId = null;
  let longest = 0;
  for (const [id, value] of score.entries()) {
    if (value > longest) {
      longest = value;
      startId = id;
    }
  }

  const critical = new Set();
  let cursor = startId;
  while (cursor) {
    critical.add(cursor);
    cursor = nextHop.get(cursor) || null;
  }

  return critical;
}

function computeTimelineView({ project, timelineDoc, phases, tasks }) {
  const normalizedTasks = tasks.map((task) => {
    const startDate = toUtcMidnight(task.startDate || project.startDate || new Date());
    const endDate = toUtcMidnight(task.dueDate || task.startDate || project.endDate || project.startDate || new Date());
    const durationInDays = clampDuration(startDate, endDate, task.timelineType);

    return {
      id: strId(task._id),
      title: task.title,
      projectId: strId(task.projectId),
      phaseId: task.phaseId ? strId(task.phaseId) : null,
      dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(strId).filter(Boolean) : [],
      type: task.timelineType || 'task',
      assigneeIds: Array.isArray(task.assigneeIds) ? task.assigneeIds.map(strId) : [],
      assignee: Array.isArray(task.assigneeIds) && task.assigneeIds.length ? strId(task.assigneeIds[0]) : null,
      status: task.status,
      priority: task.priority,
      progress: typeof task.progress === 'number' ? task.progress : task.status === 'done' ? 100 : 0,
      startDate: toDateKey(startDate),
      endDate: toDateKey(endDate),
      durationInDays,
      rawDuration: task.duration ?? null,
      updatedAt: task.updatedAt?.toISOString?.() || task.updatedAt,
      createdAt: task.createdAt?.toISOString?.() || task.createdAt,
    };
  });

  const allStartDates = normalizedTasks.map((task) => toUtcMidnight(task.startDate)).filter(Boolean);
  const allEndDates = normalizedTasks.map((task) => toUtcMidnight(task.endDate)).filter(Boolean);
  const earliestTaskStart = allStartDates.length ? [...allStartDates].sort((a, b) => a - b)[0] : null;
  const latestTaskEnd = allEndDates.length ? [...allEndDates].sort((a, b) => b - a)[0] : null;
  const configuredProjectStart = toUtcMidnight(project?.startDate);
  const configuredProjectEnd = toUtcMidnight(project?.endDate);
  const projectStart = configuredProjectStart && earliestTaskStart
    ? (configuredProjectStart < earliestTaskStart ? configuredProjectStart : earliestTaskStart)
    : configuredProjectStart || earliestTaskStart || toUtcMidnight(new Date());
  const projectEnd = configuredProjectEnd && latestTaskEnd
    ? (configuredProjectEnd > latestTaskEnd ? configuredProjectEnd : latestTaskEnd)
    : configuredProjectEnd || latestTaskEnd || addDays(projectStart, 30);

  const tasksWithOffsets = normalizedTasks.map((task) => ({
    ...task,
    startOffset: diffInDays(projectStart, task.startDate),
    endOffset: diffInDays(projectStart, task.endDate),
  }));

  const phaseMap = new Map(phases.map((phase) => [phase.id, phase]));
  const groupedPhases = phases.map((phase) => ({
    ...phase,
    tasks: tasksWithOffsets.filter((task) => task.phaseId === phase.id),
  }));

  const ungrouped = tasksWithOffsets.filter((task) => !task.phaseId || !phaseMap.has(task.phaseId));
  groupedPhases.push({
    id: 'ungrouped',
    projectId: strId(project?._id || project?.id),
    name: 'Unassigned Tasks',
    order: Number.MAX_SAFE_INTEGER,
    color: '#64748b',
    tasks: ungrouped,
  });

  const taskMap = new Map(tasksWithOffsets.map((task) => [task.id, task]));
  const orderedIds = validateDependencyDag(tasksWithOffsets);
  const { incoming, outgoing } = buildDependencyMaps(tasksWithOffsets);
  const critical = longestPathByDuration(orderedIds, taskMap, outgoing);

  const dependencies = [];
  for (const task of tasksWithOffsets) {
    for (const predecessorId of task.dependencies) {
      if (!taskMap.has(predecessorId)) continue;
      dependencies.push({
        id: `${predecessorId}:${task.id}`,
        fromTaskId: predecessorId,
        toTaskId: task.id,
        type: 'finish_to_start',
      });
    }
  }

  const resourceConflicts = [];
  const assigneeBuckets = new Map();
  for (const task of tasksWithOffsets) {
    for (const assigneeId of task.assigneeIds) {
      const items = assigneeBuckets.get(assigneeId) || [];
      items.push(task);
      assigneeBuckets.set(assigneeId, items);
    }
  }

  for (const [assigneeId, items] of assigneeBuckets.entries()) {
    const sorted = [...items].sort((a, b) => a.startOffset - b.startOffset);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (current.startOffset <= previous.endOffset) {
        resourceConflicts.push({
          assigneeId,
          taskIds: [previous.id, current.id],
          startDate: current.startDate,
          endDate: previous.endDate,
        });
      }
    }
  }

  return {
    projectId: strId(project?._id || project?.id),
    status: timelineDoc?.status || 'Draft',
    settings: timelineDoc?.settings || { zoom: 'week' },
    projectWindow: {
      startDate: toDateKey(projectStart),
      endDate: toDateKey(projectEnd),
      totalDays: Math.max(1, diffInDays(projectStart, projectEnd) + 1),
      todayOffset: diffInDays(projectStart, new Date()),
    },
    phases: groupedPhases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) => ({
        ...task,
        isCritical: critical.has(task.id),
        predecessorIds: incoming.get(task.id) || [],
      })),
    })),
    tasks: tasksWithOffsets.map((task) => ({
      ...task,
      isCritical: critical.has(task.id),
      predecessorIds: incoming.get(task.id) || [],
    })),
    dependencies,
    resourceConflicts,
    summary: {
      totalTasks: tasksWithOffsets.length,
      criticalTasks: critical.size,
      overdueTasks: tasksWithOffsets.filter((task) => task.status !== 'done' && toUtcMidnight(task.endDate) <= toUtcMidnight(new Date())).length,
      milestoneCount: tasksWithOffsets.filter((task) => task.type === 'milestone').length,
    },
  };
}

async function bootstrapPhases({ companyId, workspaceId, project, Phase }) {
  const existing = await Phase.find({ tenantId: companyId, workspaceId, projectId: project._id }).sort({ order: 1 });
  if (existing.length || !Array.isArray(project.sdlcPlan) || !project.sdlcPlan.length) {
    return existing;
  }

  const created = await Phase.insertMany(
    project.sdlcPlan.map((phase, index) => ({
      tenantId: companyId,
      workspaceId,
      projectId: project._id,
      name: phase.name,
      order: index,
      color: DEFAULT_PHASE_COLORS[index % DEFAULT_PHASE_COLORS.length],
    }))
  );

  return created;
}

function shiftDependents(taskMap, outgoing, anchorTaskId, visited = new Set()) {
  if (visited.has(anchorTaskId)) return;
  visited.add(anchorTaskId);

  const source = taskMap.get(anchorTaskId);
  if (!source) return;

  for (const dependentId of outgoing.get(anchorTaskId) || []) {
    const dependent = taskMap.get(dependentId);
    if (!dependent) continue;

    const predecessors = dependent.dependencies
      .map((dependencyId) => taskMap.get(dependencyId))
      .filter(Boolean);

    const latestEnd = predecessors.reduce((maxDate, task) => {
      const end = toUtcMidnight(task.dueDate || task.startDate);
      return !maxDate || end > maxDate ? end : maxDate;
    }, null);

    if (!latestEnd) continue;

    const expectedStart = addDays(latestEnd, 1);
    const currentStart = toUtcMidnight(dependent.startDate || expectedStart);
    const currentEnd = toUtcMidnight(dependent.dueDate || dependent.startDate || expectedStart);
    const duration = clampDuration(currentStart, currentEnd, dependent.timelineType);

    if (currentStart < expectedStart) {
      dependent.startDate = expectedStart;
      dependent.dueDate = dependent.timelineType === 'milestone'
        ? expectedStart
        : addDays(expectedStart, duration - 1);
    }

    shiftDependents(taskMap, outgoing, dependentId, visited);
  }
}

function cloneTaskForPlanning(task) {
  return {
    ...task,
    _id: task._id,
    startDate: task.startDate ? new Date(task.startDate) : null,
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(strId).filter(Boolean) : [],
    assigneeIds: Array.isArray(task.assigneeIds) ? [...task.assigneeIds] : [],
  };
}

async function ensureTimelineDoc({ ProjectTimeline, projectId, userId }) {
  let timeline = await ProjectTimeline.findOne({ projectId });
  if (!timeline) {
    timeline = await ProjectTimeline.create({
      projectId,
      status: 'Draft',
      createdBy: userId,
      settings: { zoom: 'week' },
    });
  }
  return timeline;
}

export async function initializeProjectPlanning({ companyId, workspaceId, project, userId }) {
  const { Phase, ProjectTimeline } = await getTenantModels(companyId);
  await Promise.all([
    ensureTimelineDoc({ ProjectTimeline, projectId: project._id, userId }),
    bootstrapPhases({ companyId, workspaceId, project, Phase }),
  ]);
}

export async function getProjectTimeline({ companyId, workspaceId, projectId, userId }) {
  const { Project, Task, Phase, ProjectTimeline } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: projectId, tenantId: companyId, workspaceId });
  if (!project) return null;

  const [timelineDoc, phases] = await Promise.all([
    ensureTimelineDoc({ ProjectTimeline, projectId: project._id, userId }),
    bootstrapPhases({ companyId, workspaceId, project, Phase }),
  ]);
  const tasks = await Task.find({ tenantId: companyId, workspaceId, projectId: project._id }).sort({ order: 1, createdAt: 1 });

  return computeTimelineView({
    project,
    timelineDoc,
    phases: phases.map((phase) => phase.toJSON()),
    tasks,
  });
}

export async function upsertProjectTimeline({ companyId, workspaceId, projectId, userId, role, data }) {
  const { Project, Phase, ProjectTimeline } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: projectId, tenantId: companyId, workspaceId });
  if (!project) return null;

  const existing = await ensureTimelineDoc({ ProjectTimeline, projectId: project._id, userId });
  if (existing.status === 'Approved' && !['admin', 'super_admin'].includes(role)) {
    const err = new Error('Timeline is approved and locked. Only admins can edit.');
    err.statusCode = 403;
    err.code = 'TIMELINE_LOCKED';
    throw err;
  }

  if (Array.isArray(data.phases)) {
    const existingPhases = await Phase.find({ tenantId: companyId, workspaceId, projectId: project._id });
    const existingMap = new Map(existingPhases.map((phase) => [strId(phase._id), phase]));
    const incomingIds = new Set();

    for (let index = 0; index < data.phases.length; index += 1) {
      const phase = data.phases[index];
      if (phase.id && existingMap.has(phase.id)) {
        incomingIds.add(phase.id);
        await Phase.updateOne(
          { _id: phase.id, tenantId: companyId, workspaceId, projectId: project._id },
          {
            $set: {
              name: phase.name,
              order: phase.order ?? index,
              color: phase.color || DEFAULT_PHASE_COLORS[index % DEFAULT_PHASE_COLORS.length],
            },
          }
        );
      } else {
        const created = await Phase.create({
          tenantId: companyId,
          workspaceId,
          projectId: project._id,
          name: phase.name,
          order: phase.order ?? index,
          color: phase.color || DEFAULT_PHASE_COLORS[index % DEFAULT_PHASE_COLORS.length],
        });
        incomingIds.add(strId(created._id));
      }
    }

    const toDelete = existingPhases.filter((phase) => !incomingIds.has(strId(phase._id))).map((phase) => phase._id);
    if (toDelete.length) {
      await Phase.deleteMany({ _id: { $in: toDelete }, tenantId: companyId, workspaceId, projectId: project._id });
    }
  }

  await ProjectTimeline.findOneAndUpdate(
    { projectId: project._id },
    {
      $set: {
        status: data.status || existing.status || 'Draft',
        createdBy: userId,
        settings: data.settings || existing.settings || { zoom: 'week' },
      },
    },
    { upsert: true, new: true }
  );

  return getProjectTimeline({ companyId, workspaceId, projectId: project._id, userId });
}

export async function updateTaskTimeline({ companyId, workspaceId, projectId, taskId, updates, userId, role }) {
  const { Task, ProjectTimeline } = await getTenantModels(companyId);
  const timeline = await ProjectTimeline.findOne({ projectId });
  if (timeline?.status === 'Approved' && !['admin', 'super_admin'].includes(role)) {
    const err = new Error('Timeline is approved and locked. Only admins can edit.');
    err.statusCode = 403;
    err.code = 'TIMELINE_LOCKED';
    throw err;
  }

  const tasks = await Task.find({ tenantId: companyId, workspaceId, projectId });
  const taskMap = new Map(tasks.map((item) => [strId(item._id), cloneTaskForPlanning(item.toObject ? item.toObject() : item)]));
  const task = taskMap.get(strId(taskId));
  if (!task) return null;

  if (updates.title !== undefined) task.title = updates.title;
  if (updates.phaseId !== undefined) task.phaseId = updates.phaseId || null;
  if (updates.dependencies !== undefined) task.dependencies = Array.isArray(updates.dependencies)
    ? updates.dependencies.map(strId).filter(Boolean)
    : [];
  if (updates.type !== undefined) task.timelineType = updates.type;
  if (updates.status !== undefined) task.status = updates.status;
  if (updates.assigneeIds !== undefined) task.assigneeIds = Array.isArray(updates.assigneeIds) ? updates.assigneeIds : [];
  if (updates.startDate !== undefined) task.startDate = updates.startDate ? new Date(updates.startDate) : null;
  if (updates.endDate !== undefined) task.dueDate = updates.endDate ? new Date(updates.endDate) : null;

  validateDependencyDag(Array.from(taskMap.values()).map((item) => ({
    _id: item._id,
    dependencies: item.dependencies || [],
  })));

  const { outgoing } = buildDependencyMaps(Array.from(taskMap.values()));
  shiftDependents(taskMap, outgoing, strId(taskId));

  await Promise.all(
    Array.from(taskMap.values()).map((item) =>
      Task.updateOne(
        { _id: item._id },
        {
          $set: {
            title: item.title,
            phaseId: item.phaseId || null,
            dependencies: Array.isArray(item.dependencies)
              ? item.dependencies.map((value) => new mongoose.Types.ObjectId(value))
              : [],
            timelineType: item.timelineType,
            status: item.status,
            assigneeIds: item.assigneeIds,
            startDate: item.startDate ? new Date(item.startDate) : null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
          },
        }
      )
    )
  );

  return getProjectTimeline({ companyId, workspaceId, projectId, userId });
}

export async function createTaskDependency({ companyId, workspaceId, projectId, fromTaskId, toTaskId, userId, role }) {
  if (strId(fromTaskId) === strId(toTaskId)) {
    const err = new Error('A task cannot depend on itself.');
    err.statusCode = 400;
    err.code = 'TIMELINE_INVALID_DEPENDENCY';
    throw err;
  }

  const { Task, ProjectTimeline } = await getTenantModels(companyId);
  const timeline = await ProjectTimeline.findOne({ projectId });
  if (timeline?.status === 'Approved' && !['admin', 'super_admin'].includes(role)) {
    const err = new Error('Timeline is approved and locked. Only admins can edit.');
    err.statusCode = 403;
    err.code = 'TIMELINE_LOCKED';
    throw err;
  }

  const [fromTask, toTask] = await Promise.all([
    Task.findOne({ _id: fromTaskId, tenantId: companyId, workspaceId, projectId }),
    Task.findOne({ _id: toTaskId, tenantId: companyId, workspaceId, projectId }),
  ]);

  if (!fromTask || !toTask) {
    const err = new Error('Both tasks must exist before creating a dependency.');
    err.statusCode = 404;
    err.code = 'TIMELINE_TASK_NOT_FOUND';
    throw err;
  }

  const nextDependencies = Array.from(new Set([...(toTask.dependencies || []).map(strId), strId(fromTaskId)]))
    .filter(Boolean);

  const tasks = await Task.find({ tenantId: companyId, workspaceId, projectId });
  const taskMap = new Map(tasks.map((item) => [strId(item._id), cloneTaskForPlanning(item.toObject ? item.toObject() : item)]));
  const targetTask = taskMap.get(strId(toTaskId));
  if (!targetTask) {
    const err = new Error('Both tasks must exist before creating a dependency.');
    err.statusCode = 404;
    err.code = 'TIMELINE_TASK_NOT_FOUND';
    throw err;
  }
  targetTask.dependencies = nextDependencies;

  validateDependencyDag(Array.from(taskMap.values()).map((item) => ({
    _id: item._id,
    dependencies: item.dependencies || [],
  })));

  const { outgoing } = buildDependencyMaps(Array.from(taskMap.values()));
  shiftDependents(taskMap, outgoing, strId(fromTaskId));

  await Promise.all(
    Array.from(taskMap.values()).map((item) =>
      Task.updateOne(
        { _id: item._id },
        {
          $set: {
            dependencies: Array.isArray(item.dependencies)
              ? item.dependencies.map((value) => new mongoose.Types.ObjectId(value))
              : [],
            startDate: item.startDate ? new Date(item.startDate) : null,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
          },
        }
      )
    )
  );

  return getProjectTimeline({ companyId, workspaceId, projectId, userId });
}

export async function setTimelineLock({ companyId, workspaceId, projectId, userId, locked }) {
  const { ProjectTimeline, Project } = await getTenantModels(companyId);
  const project = await Project.findOne({ _id: projectId, tenantId: companyId, workspaceId });
  if (!project) return null;

  await ensureTimelineDoc({ ProjectTimeline, projectId: project._id, userId });
  await ProjectTimeline.updateOne(
    { projectId: project._id },
    { $set: { status: locked ? 'Approved' : 'Draft' } }
  );

  return getProjectTimeline({ companyId, workspaceId, projectId: project._id, userId });
}
