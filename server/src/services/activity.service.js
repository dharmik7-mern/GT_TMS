import mongoose from 'mongoose';
import { getTenantModels } from '../config/tenantDb.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PROJECT_ENTITY_TYPES = ['PROJECT', 'project'];
const TASK_ENTITY_TYPES = ['TASK', 'task'];
const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'Last Week', 'Older'];

function strId(value) {
  return value ? String(value) : '';
}

function toObjectIdIfValid(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function normalizeTimelineStatus(activity) {
  const type = String(activity?.type || '').toLowerCase();
  const description = String(activity?.description || '').toLowerCase();
  const metadata = activity?.metadata || {};
  const nextStatus = String(metadata.to || metadata.status || '').toLowerCase();

  if (
    type.includes('created') ||
    type.includes('added') ||
    description.includes('created')
  ) {
    return 'created';
  }

  if (
    type.includes('assigned') ||
    type.includes('assignee') ||
    description.includes('assigned')
  ) {
    return 'assigned';
  }

  if (
    type.includes('completed') ||
    type.includes('approved') ||
    nextStatus === 'done' ||
    nextStatus === 'completed' ||
    description.includes('completed')
  ) {
    return 'completed';
  }

  return 'updated';
}

function getTimelineDateGroup(dateValue) {
  const date = new Date(dateValue);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  if (date >= todayStart) return 'Today';
  if (date >= yesterdayStart) return 'Yesterday';
  if (date >= lastWeekStart) return 'Last Week';
  return 'Older';
}

function encodeCursor(activity) {
  if (!activity?._id || !activity?.createdAt) return null;
  return Buffer.from(JSON.stringify({
    createdAt: new Date(activity.createdAt).toISOString(),
    id: String(activity._id),
  })).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!parsed?.createdAt || !parsed?.id) return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !mongoose.Types.ObjectId.isValid(parsed.id)) return null;
    return {
      createdAt,
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    return null;
  }
}

function buildCursorFilter(cursor) {
  if (!cursor) return null;
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}

function buildStageSummary(task) {
  const nowMs = Date.now();
  const durations = {};
  let totalTime = 0;
  let inProgressTime = 0;
  let liveSessionStartedAt = null;
  let liveStatus = null;

  const logs = Array.isArray(task?.timeLogs) ? task.timeLogs : [];
  for (const log of logs) {
    if (!log?.startTime) continue;
    const status = String(log.status || 'unknown');
    const startMs = new Date(log.startTime).getTime();
    const endMs = log.endTime ? new Date(log.endTime).getTime() : nowMs;
    const duration = Math.max(
      0,
      typeof log.duration === 'number' && log.endTime ? log.duration : Math.floor((endMs - startMs) / 1000)
    );

    durations[status] = (durations[status] || 0) + duration;
    totalTime += duration;
    if (status === 'in_progress') {
      inProgressTime += duration;
    }

    if (!log.endTime && !liveSessionStartedAt) {
      liveSessionStartedAt = new Date(log.startTime).toISOString();
      liveStatus = status;
    }
  }

  if (!totalTime && task?.timeAnalytics?.totalTimeSpent) {
    totalTime = task.timeAnalytics.totalTimeSpent;
  }

  if (!inProgressTime && task?.timeAnalytics?.inProgressTime) {
    inProgressTime = task.timeAnalytics.inProgressTime;
  }

  const stages = Object.entries(durations)
    .sort((left, right) => right[1] - left[1])
    .map(([status, duration]) => ({ status, duration }));

  return {
    totalTime,
    inProgressTime,
    liveSessionStartedAt,
    liveStatus,
    stages,
  };
}

function matchesTimelineSearch({ query, activity, task, user }) {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    activity.description,
    activity.type,
    task?.title,
    user?.name,
    user?.email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

function mergeTaskActivities(existingActivities, nextActivities) {
  const seen = new Set(existingActivities.map((activity) => activity.id));
  const merged = [...existingActivities];

  for (const activity of nextActivities) {
    if (seen.has(activity.id)) continue;
    seen.add(activity.id);
    merged.push(activity);
  }

  merged.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return merged;
}

export async function listActivity({ companyId, workspaceId, limit = 50, q, type, entityType, days }) {
  const tenantId = companyId;
  const { ActivityLog, User } = await getTenantModels(companyId);

  const filter = { tenantId, workspaceId };

  if (type) filter.type = type;
  if (entityType) filter.entityType = entityType;

  if (days && Number(days) > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));
    filter.createdAt = { $gte: cutoff };
  }

  if (q?.trim()) {
    const regex = new RegExp(escapeRegExp(q.trim()), 'i');
    filter.$or = [
      { description: regex },
      { type: regex },
      { entityType: regex },
    ];
  }

  const items = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const userIds = [...new Set(items.map((item) => String(item.userId)).filter(Boolean))];
  const users = userIds.length > 0
    ? await User.find({ _id: { $in: userIds } }).select('name email role').lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return items.map((item) => {
    const user = userMap.get(String(item.userId));
    return {
      id: String(item._id),
      type: item.type,
      description: item.description,
      entityType: item.entityType,
      entityId: String(item.entityId),
      metadata: item.metadata || {},
      createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      user: user
        ? {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
          }
        : null,
    };
  });
}


export async function listProjectActivity({ companyId, workspaceId, projectId, limit = 200 }) {
  const { ActivityLog, User, Task } = await getTenantModels(companyId);

  // Get all task IDs for this project to fetch their activities
  const projectTasks = await Task.find({ projectId }).select('_id title').lean();
  const taskIds = projectTasks.map((t) => t._id);
  const taskNames = new Map(projectTasks.map((t) => [String(t._id), t.title]));

  const filter = {
    tenantId: companyId,
    workspaceId,
    $or: [
      { entityType: { $in: ['TASK', 'task'] }, entityId: { $in: taskIds } },
      { entityType: { $in: ['PROJECT', 'project'] }, entityId: projectId },
    ],
  };

  const items = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const userIds = [...new Set(items.map((item) => String(item.userId)).filter(Boolean))];
  const users = userIds.length > 0
    ? await User.find({ _id: { $in: userIds } }).select('name email role color').lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return items.map((item) => {
    const user = userMap.get(String(item.userId));
    const isTask = ['TASK', 'task'].includes(item.entityType);
    const entityName = isTask ? taskNames.get(String(item.entityId)) : undefined;

    return {
      id: String(item._id),
      type: item.type,
      description: item.description,
      entityType: item.entityType,
      entityId: String(item.entityId),
      entityName, // Include task name for grouping
      metadata: item.metadata || {},
      createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      user: user
        ? {
            id: String(user._id),
            name: user.name,
            email: user.email,
            role: user.role,
            color: user.color,
          }
        : null,
    };
  });
}

export async function getProjectTimeline({
  companyId,
  workspaceId,
  projectId,
  limit = 20,
  cursor,
  userId,
  status,
  q,
  startDate,
  endDate,
}) {
  const { ActivityLog, User, Task } = await getTenantModels(companyId);
  const tenantId = companyId;
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const batchSize = Math.min(Math.max(safeLimit * 4, 40), 200);
  const projectObjectId = toObjectIdIfValid(projectId) || projectId;

  const projectTaskIds = (await Task.find({ tenantId, workspaceId, projectId })
    .select('_id')
    .lean())
    .map((task) => task._id);

  const baseFilter = {
    tenantId,
    workspaceId,
    $or: [
      { entityType: { $in: PROJECT_ENTITY_TYPES }, entityId: projectObjectId },
      { entityType: { $in: TASK_ENTITY_TYPES }, entityId: { $in: projectTaskIds } },
      { entityType: { $in: TASK_ENTITY_TYPES }, 'metadata.projectId': projectId },
      { entityType: { $in: TASK_ENTITY_TYPES }, 'metadata.projectId': projectObjectId },
    ],
  };

  if (userId) {
    baseFilter.userId = userId;
  }

  const createdAtFilter = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      createdAtFilter.$gte = start;
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      createdAtFilter.$lte = end;
    }
  }
  if (Object.keys(createdAtFilter).length) {
    baseFilter.createdAt = createdAtFilter;
  }

  const normalizedCursor = decodeCursor(cursor);
  let pageCursor = normalizedCursor;
  let exhausted = false;
  let iterations = 0;
  const selected = [];
  let trailingDoc = null;

  while (!exhausted && selected.length < safeLimit + 1 && iterations < 20) {
    iterations += 1;
    const query = { ...baseFilter };
    const cursorFilter = buildCursorFilter(pageCursor);
    if (cursorFilter) {
      query.$and = query.$and ? [...query.$and, cursorFilter] : [cursorFilter];
    }

    const docs = await ActivityLog.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(batchSize)
      .lean();

    if (!docs.length) {
      exhausted = true;
      break;
    }

    trailingDoc = docs[docs.length - 1];
    pageCursor = trailingDoc ? { createdAt: trailingDoc.createdAt, id: trailingDoc._id } : pageCursor;

    const taskIds = [...new Set(
      docs
        .filter((item) => TASK_ENTITY_TYPES.includes(item.entityType))
        .map((item) => strId(item.entityId))
        .filter(Boolean)
    )];

    const taskDocs = taskIds.length
      ? await Task.find({ tenantId, workspaceId, projectId, _id: { $in: taskIds } })
        .select('title status assigneeIds timeLogs timeAnalytics updatedAt')
        .lean()
      : [];

    const taskMap = new Map(taskDocs.map((task) => [strId(task._id), task]));

    const userIds = [...new Set(
      docs
        .map((item) => strId(item.userId))
        .concat(taskDocs.flatMap((task) => (Array.isArray(task.assigneeIds) ? task.assigneeIds.map((assigneeId) => strId(assigneeId)) : [])))
        .filter(Boolean)
    )];

    const userDocs = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('name email role color').lean()
      : [];
    const userMap = new Map(userDocs.map((user) => [strId(user._id), user]));

    for (const doc of docs) {
      const task = TASK_ENTITY_TYPES.includes(doc.entityType) ? taskMap.get(strId(doc.entityId)) : null;
      const activityUser = userMap.get(strId(doc.userId)) || null;
      const normalizedStatus = normalizeTimelineStatus(doc);

      if (status && status !== 'all' && normalizedStatus !== status) {
        continue;
      }

      if (!matchesTimelineSearch({ query: q, activity: doc, task, user: activityUser })) {
        continue;
      }

      selected.push({
        raw: doc,
        task,
        user: activityUser,
        normalizedStatus,
        assignees: task
          ? (task.assigneeIds || [])
              .map((assigneeId) => userMap.get(strId(assigneeId)))
              .filter(Boolean)
          : [],
      });

      if (selected.length >= safeLimit + 1) {
        break;
      }
    }

    if (docs.length < batchSize) {
      exhausted = true;
    }
  }

  const visible = selected.slice(0, safeLimit);
  const nextCursor = visible.length && (selected.length > safeLimit || !exhausted)
    ? encodeCursor(visible[visible.length - 1].raw)
    : null;

  const dateGroups = new Map();
  const summary = {
    activities: visible.length,
    tasks: 0,
    totalTracked: 0,
    totalInProgress: 0,
  };
  const countedTaskIds = new Set();

  for (const entry of visible) {
    const dateGroup = getTimelineDateGroup(entry.raw.createdAt);
    const taskId = entry.task ? strId(entry.task._id) : `project:${projectId}`;
    const taskName = entry.task?.title || 'Project updates';
    const taskSummary = entry.task ? buildStageSummary(entry.task) : {
      totalTime: 0,
      inProgressTime: 0,
      liveSessionStartedAt: null,
      liveStatus: null,
      stages: [],
    };

    if (!dateGroups.has(dateGroup)) {
      dateGroups.set(dateGroup, {
        dateGroup,
        tasksMap: new Map(),
      });
    }

    const group = dateGroups.get(dateGroup);
    const existingTask = group.tasksMap.get(taskId);
    const activityPayload = {
      id: strId(entry.raw._id),
      type: entry.raw.type,
      status: entry.normalizedStatus,
      description: entry.raw.description,
      entityType: entry.raw.entityType,
      entityId: strId(entry.raw.entityId),
      createdAt: entry.raw.createdAt?.toISOString?.() || entry.raw.createdAt,
      metadata: entry.raw.metadata || {},
      user: entry.user
        ? {
            id: strId(entry.user._id),
            name: entry.user.name,
            email: entry.user.email,
            role: entry.user.role,
            color: entry.user.color,
          }
        : null,
    };

    if (!existingTask) {
      group.tasksMap.set(taskId, {
        taskId,
        taskName,
        taskStatus: entry.task?.status || 'project',
        totalTime: taskSummary.totalTime,
        inProgressTime: taskSummary.inProgressTime,
        liveSessionStartedAt: taskSummary.liveSessionStartedAt,
        liveStatus: taskSummary.liveStatus,
        activitiesCount: 1,
        latestActivityAt: activityPayload.createdAt,
        assignees: entry.assignees.map((user) => ({
          id: strId(user._id),
          name: user.name,
          email: user.email,
          color: user.color,
          role: user.role,
        })),
        stages: taskSummary.stages,
        activities: [activityPayload],
      });
    } else {
      existingTask.activitiesCount += 1;
      existingTask.latestActivityAt = new Date(existingTask.latestActivityAt) > new Date(activityPayload.createdAt)
        ? existingTask.latestActivityAt
        : activityPayload.createdAt;
      existingTask.activities = mergeTaskActivities(existingTask.activities, [activityPayload]);
    }

    if (!countedTaskIds.has(taskId)) {
      countedTaskIds.add(taskId);
      summary.tasks += 1;
      summary.totalTracked += taskSummary.totalTime || 0;
      summary.totalInProgress += taskSummary.inProgressTime || 0;
    }
  }

  const groups = DATE_GROUP_ORDER
    .filter((label) => dateGroups.has(label))
    .map((label) => {
      const value = dateGroups.get(label);
      return {
        dateGroup: label,
        tasks: [...value.tasksMap.values()].sort(
          (left, right) => new Date(right.latestActivityAt).getTime() - new Date(left.latestActivityAt).getTime()
        ),
      };
    });

  return {
    groups,
    pagination: {
      limit: safeLimit,
      nextCursor,
      hasMore: Boolean(nextCursor),
      scannedCursor: trailingDoc ? encodeCursor(trailingDoc) : null,
    },
    summary,
    filters: {
      appliedUserId: userId || null,
      appliedStatus: status || 'all',
      appliedQuery: q || '',
      appliedStartDate: startDate || null,
      appliedEndDate: endDate || null,
    },
  };
}
