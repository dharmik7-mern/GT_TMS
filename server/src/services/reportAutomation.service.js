import mongoose from 'mongoose';
import Company from '../models/Company.js';
import { getTenantModels } from '../config/tenantDb.js';
import { isTestEmailRecipient, sendTemplatedEmailSafe } from './mail.service.js';
import { runOverdueTaskSweep } from './overdue.service.js';

const AUTOMATION_INTERVAL_MS = Math.max(60_000, Number(process.env.REPORT_AUTOMATION_INTERVAL_MS || 15 * 60 * 1000));
const REPORT_RECIPIENT_ROLES = new Set(['admin', 'manager', 'team_leader']);
const DAILY_REPORT_EMAILS_ENABLED = String(process.env.DAILY_REPORT_EMAILS_ENABLED || 'false').trim().toLowerCase() === 'true';
const DAILY_REPORT_NOTIFICATIONS_ENABLED = String(process.env.DAILY_REPORT_NOTIFICATIONS_ENABLED || 'false').trim().toLowerCase() === 'true';
const AUTOMATION_STATE = {
  timer: null,
  isRunning: false,
};

function safeConsoleLog(...args) {
  try {
    console.log(...args);
  } catch {
    // Ignore detached stdout pipe failures.
  }
}

function safeConsoleError(...args) {
  try {
    console.error(...args);
  } catch {
    // Ignore detached stderr pipe failures.
  }
}

function asObjectId(value) {
  if (!value) return null;
  try {
    return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
  } catch {
    return null;
  }
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(input = new Date()) {
  const date = asDate(input) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(input = new Date()) {
  const date = startOfDay(input);
  date.setDate(date.getDate() + 1);
  date.setMilliseconds(-1);
  return date;
}

function isSameDay(left, right) {
  const a = asDate(left);
  const b = asDate(right);
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isBeforeDay(left, right) {
  const a = asDate(left);
  const b = startOfDay(right);
  if (!a || !b) return false;
  return a.getTime() < b.getTime();
}

function formatDateLabel(value) {
  const date = asDate(value);
  if (!date) return 'Not set';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatReportDateKey(value) {
  const date = startOfDay(value);
  return date.toISOString().split('T')[0];
}

function normalizeName(value, fallback) {
  return String(value || '').trim() || fallback;
}

function buildPerformanceScore({ assignedTasks, completedTasks, approvedTasks, overdueOpen, averageRating, onTimeCompleted }) {
  const completionRate = assignedTasks ? Math.round((completedTasks / assignedTasks) * 100) : 0;
  const approvalRate = completedTasks ? Math.round((approvedTasks / completedTasks) * 100) : 0;
  const onTimeRate = completedTasks ? Math.round((onTimeCompleted / completedTasks) * 100) : 0;
  const ratingScore = averageRating ? (averageRating / 5) * 100 : 0;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((completionRate * 0.35) + (approvalRate * 0.25) + (onTimeRate * 0.2) + (ratingScore * 0.2) - (overdueOpen * 4))
    )
  );
}

function summarizeEmployeeAnalysis({ completedToday, dueToday, overdueOpen, performanceScore, openTasks }) {
  if (overdueOpen > 0) {
    return `${overdueOpen} overdue item${overdueOpen === 1 ? '' : 's'} need attention.`;
  }
  if (dueToday > 0) {
    return `${dueToday} item${dueToday === 1 ? '' : 's'} due today with ${openTasks} open overall.`;
  }
  if (completedToday > 0) {
    return `Delivered ${completedToday} item${completedToday === 1 ? '' : 's'} today with a ${performanceScore}% score.`;
  }
  if (openTasks === 0) {
    return 'No open assigned items right now.';
  }
  return `Steady workload in progress with a ${performanceScore}% performance score.`;
}

function buildOverallAnalysis(employeeSummaries, summary) {
  const strengths = [];
  const risks = [];
  const recommendations = [];

  const strongContributors = employeeSummaries.filter((item) => item.performanceScore >= 75);
  const atRiskContributors = employeeSummaries.filter((item) => item.overdueOpen > 0);
  const busyToday = employeeSummaries.filter((item) => item.dueToday > 0);

  if (summary.totalCompletedToday > 0) {
    strengths.push(`${summary.totalCompletedToday} total item${summary.totalCompletedToday === 1 ? '' : 's'} were completed today.`);
  }
  if (strongContributors.length > 0) {
    strengths.push(`${strongContributors.length} employee${strongContributors.length === 1 ? '' : 's'} are tracking above the target performance band.`);
  }
  if (atRiskContributors.length > 0) {
    risks.push(`${atRiskContributors.length} employee${atRiskContributors.length === 1 ? '' : 's'} have overdue open work.`);
  }
  if (summary.totalDueToday > 0) {
    risks.push(`${summary.totalDueToday} item${summary.totalDueToday === 1 ? '' : 's'} are due today across the workspace.`);
  }
  if (busyToday.length > 0) {
    recommendations.push('Review due-today workloads and rebalance tasks for team members with multiple deadlines.');
  }
  if (atRiskContributors.length > 0) {
    recommendations.push('Follow up on overdue work and unblock the employees showing delivery risk.');
  }
  if (!recommendations.length) {
    recommendations.push('Keep the current execution pace and continue reviewing completion quality daily.');
  }

  const headline = summary.totalOverdueOpen > 0
    ? `Workspace has ${summary.totalOverdueOpen} overdue open item${summary.totalOverdueOpen === 1 ? '' : 's'} that need attention.`
    : `Workspace is stable with ${summary.totalCompletedToday} item${summary.totalCompletedToday === 1 ? '' : 's'} completed today.`;

  return {
    headline,
    strengths,
    risks,
    recommendations,
  };
}

function extractCompletionDate(task) {
  return asDate(task?.completionReview?.completedAt) || asDate(task?.updatedAt);
}

function isOnTimeCompletion(task) {
  const completedAt = extractCompletionDate(task);
  const dueDate = asDate(task?.dueDate);
  if (!completedAt || !dueDate) return false;
  return completedAt.getTime() <= dueDate.getTime();
}

function createWorkItem(task, projectMap, kind) {
  return {
    id: String(task._id),
    kind,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: asDate(task.dueDate)?.toISOString()?.split('T')?.[0] || '',
    projectId: task.projectId ? String(task.projectId) : '',
    projectName: task.projectId ? (projectMap.get(String(task.projectId)) || 'Project') : '',
  };
}

async function createReminderNotification({
  Notification,
  tenantId,
  workspaceId,
  userId,
  type,
  title,
  message,
  relatedId,
  rangeStart,
  rangeEnd,
}) {
  const existing = await Notification.findOne({
    tenantId,
    workspaceId,
    userId,
    type,
    relatedId,
    createdAt: { $gte: rangeStart, $lte: rangeEnd },
  }).lean();

  if (existing) {
    return { created: false, notification: existing };
  }

  const notification = await Notification.create({
    tenantId,
    workspaceId,
    userId,
    type,
    title,
    message,
    relatedId,
    isRead: false,
  });
  return { created: true, notification };
}

export async function buildDailyWorkspaceReport({
  companyId,
  workspaceId,
  reportDate = new Date(),
  persist = true,
}) {
  const tenantId = companyId;
  const workspaceObjectId = asObjectId(workspaceId) || workspaceId;
  const reportDay = startOfDay(reportDate);
  const reportDayEnd = endOfDay(reportDate);
  const reportDateKey = formatReportDateKey(reportDate);
  const {
    User,
    Membership,
    Task,
    QuickTask,
    Project,
    DailyWorkReport,
  } = await getTenantModels(companyId);

  const [memberships, users, projects, tasks, quickTasks] = await Promise.all([
    Membership.find({ tenantId, workspaceId: workspaceObjectId, status: 'active' }).lean(),
    User.find({ tenantId, isActive: true }).lean(),
    Project.find({ tenantId, workspaceId: workspaceObjectId }).select('_id name').lean(),
    Task.find({
      tenantId,
      workspaceId: workspaceObjectId,
      $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
    }).lean(),
    QuickTask.find({ tenantId, workspaceId: workspaceObjectId }).lean(),
  ]);

  const membershipMap = new Map(memberships.map((membership) => [String(membership.userId), membership]));
  const activeUsers = users.filter((user) => membershipMap.has(String(user._id)));
  const projectMap = new Map(projects.map((project) => [String(project._id), project.name]));
  const allAssigned = [
    ...tasks.map((task) => ({ ...task, kind: 'project_task' })),
    ...quickTasks.map((task) => ({ ...task, kind: 'quick_task' })),
  ];

  const employeeSummaries = activeUsers.map((user) => {
    const userId = String(user._id);
    const assignedItems = allAssigned.filter((task) => Array.isArray(task.assigneeIds) && task.assigneeIds.some((assigneeId) => String(assigneeId) === userId));
    const openItems = assignedItems.filter((task) => task.status !== 'done');
    const completedItems = assignedItems.filter((task) => task.status === 'done');
    const completedToday = completedItems.filter((task) => isSameDay(extractCompletionDate(task), reportDay)).length;
    const dueTodayItems = openItems.filter((task) => isSameDay(task.dueDate, reportDay));
    const overdueItems = openItems.filter((task) => isBeforeDay(task.dueDate, reportDay));
    const approvedItems = completedItems.filter((task) => task.completionReview?.reviewStatus === 'approved');
    const onTimeCompletedItems = completedItems.filter((task) => isOnTimeCompletion(task));
    const ratedItems = approvedItems.filter((task) => typeof task.completionReview?.rating === 'number');
    const averageRating = ratedItems.length
      ? Number((ratedItems.reduce((sum, task) => sum + Number(task.completionReview.rating || 0), 0) / ratedItems.length).toFixed(1))
      : 0;
    const performanceScore = buildPerformanceScore({
      assignedTasks: assignedItems.length,
      completedTasks: completedItems.length,
      approvedTasks: approvedItems.length,
      overdueOpen: overdueItems.length,
      averageRating,
      onTimeCompleted: onTimeCompletedItems.length,
    });
    const workItems = [...openItems, ...completedItems]
      .sort((left, right) => {
        const leftDue = asDate(left.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const rightDue = asDate(right.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) return leftDue - rightDue;
        return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
      })
      .slice(0, 8)
      .map((task) => createWorkItem(task, projectMap, task.kind));

    return {
      userId,
      name: user.name,
      email: user.email,
      role: membershipMap.get(userId)?.role || user.role,
      assignedOpenTasks: openItems.length,
      completedToday,
      dueToday: dueTodayItems.length,
      overdueOpen: overdueItems.length,
      approvedTasks: approvedItems.length,
      averageRating,
      performanceScore,
      workItems,
      analysis: summarizeEmployeeAnalysis({
        completedToday,
        dueToday: dueTodayItems.length,
        overdueOpen: overdueItems.length,
        performanceScore,
        openTasks: openItems.length,
      }),
    };
  });

  employeeSummaries.sort((left, right) => {
    if (right.performanceScore !== left.performanceScore) return right.performanceScore - left.performanceScore;
    if (right.completedToday !== left.completedToday) return right.completedToday - left.completedToday;
    return left.overdueOpen - right.overdueOpen;
  });

  const uniqueAssignedItems = allAssigned.filter((task) => {
    const assigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds.map((id) => String(id)) : [];
    return assigneeIds.some((assigneeId) => membershipMap.has(assigneeId));
  });
  const uniqueOpenItems = uniqueAssignedItems.filter((task) => task.status !== 'done');
  const uniqueCompletedToday = uniqueAssignedItems.filter((task) => task.status === 'done' && isSameDay(extractCompletionDate(task), reportDay));
  const uniqueDueToday = uniqueOpenItems.filter((task) => isSameDay(task.dueDate, reportDay));
  const uniqueOverdueItems = uniqueOpenItems.filter((task) => isBeforeDay(task.dueDate, reportDay));

  const totalOpenTasks = uniqueOpenItems.length;
  const totalCompletedToday = uniqueCompletedToday.length;
  const totalDueToday = uniqueDueToday.length;
  const totalOverdueOpen = uniqueOverdueItems.length;
  const activeEmployees = employeeSummaries.filter((employee) => employee.assignedOpenTasks > 0 || employee.completedToday > 0).length;
  const averagePerformanceScore = employeeSummaries.length
    ? Number((employeeSummaries.reduce((sum, employee) => sum + employee.performanceScore, 0) / employeeSummaries.length).toFixed(1))
    : 0;
  const topPerformer = employeeSummaries[0] || null;

  const summary = {
    employeesCount: employeeSummaries.length,
    activeEmployees,
    totalOpenTasks,
    totalCompletedToday,
    totalDueToday,
    totalOverdueOpen,
    averagePerformanceScore,
    topPerformerName: topPerformer?.name || '',
    topPerformerScore: topPerformer?.performanceScore || 0,
  };

  const analysis = buildOverallAnalysis(employeeSummaries, summary);
  const payload = {
    tenantId,
    workspaceId: workspaceObjectId,
    reportDate: reportDateKey,
    summary,
    employeeSummaries,
    analysis,
    generatedAt: new Date(),
  };

  if (!persist) {
    return {
      id: null,
      ...payload,
      reportDate: reportDateKey,
      generatedAt: payload.generatedAt.toISOString(),
    };
  }

  const report = await DailyWorkReport.findOneAndUpdate(
    { tenantId, workspaceId: workspaceObjectId, reportDate: reportDateKey },
    { $set: payload },
    { returnDocument: 'after', upsert: true }
  );
  return report.toJSON();
}

export async function listDailyWorkspaceReports({ companyId, workspaceId, limit = 14 }) {
  const { DailyWorkReport } = await getTenantModels(companyId);
  const reports = await DailyWorkReport.find({
    tenantId: companyId,
    workspaceId: asObjectId(workspaceId) || workspaceId,
  })
    .sort({ reportDate: -1 })
    .limit(Math.max(1, Math.min(60, Number(limit) || 14)));
  return reports.map((report) => report.toJSON());
}

export async function sendDueDateReminderSweep({ companyId, workspaceId, date = new Date() }) {
  const tenantId = companyId;
  const reminderDay = startOfDay(date);
  const reminderDayEnd = endOfDay(date);
  const workspaceObjectId = asObjectId(workspaceId) || workspaceId;
  const {
    User,
    Task,
    QuickTask,
    Project,
    Notification,
  } = await getTenantModels(companyId);

  const [users, projects, dueTasks, dueQuickTasks] = await Promise.all([
    User.find({ tenantId, isActive: true }).lean(),
    Project.find({ tenantId, workspaceId: workspaceObjectId }).select('_id name').lean(),
    Task.find({
      tenantId,
      workspaceId: workspaceObjectId,
      dueDate: { $gte: reminderDay, $lte: reminderDayEnd },
      status: { $ne: 'done' },
      $or: [{ parentTaskId: null }, { parentTaskId: { $exists: false } }],
    }).lean(),
    QuickTask.find({
      tenantId,
      workspaceId: workspaceObjectId,
      dueDate: { $gte: reminderDay, $lte: reminderDayEnd },
      status: { $ne: 'done' },
    }).lean(),
  ]);

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const projectMap = new Map(projects.map((project) => [String(project._id), project.name]));
  let remindersSent = 0;

  for (const task of dueTasks) {
    for (const assigneeId of task.assigneeIds || []) {
      const user = userMap.get(String(assigneeId));
      if (!user) continue;
      if (user.preferences?.notifications?.deadlines === false || user.preferences?.notifications?.emailNotifs === false) continue;

      const reminder = await createReminderNotification({
        Notification,
        tenantId,
        workspaceId: workspaceObjectId,
        userId: user._id,
        type: 'deadline_approaching',
        title: 'Task due today',
        message: `${task.title} is due today.`,
        relatedId: String(task._id),
        rangeStart: reminderDay,
        rangeEnd: reminderDayEnd,
      });

      if (!reminder.created) continue;

      await sendTemplatedEmailSafe({
        to: user.email,
        templateKey: 'taskDueToday',
        variables: {
          userName: user.name,
          taskTitle: task.title,
          projectName: projectMap.get(String(task.projectId)) || 'Project',
          priority: task.priority,
          dueDate: formatDateLabel(task.dueDate),
          taskUrl: `${String(process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}/tasks/${String(task._id)}`,
        },
      });
      remindersSent += 1;
    }
  }

  for (const task of dueQuickTasks) {
    for (const assigneeId of task.assigneeIds || []) {
      const user = userMap.get(String(assigneeId));
      if (!user) continue;
      if (user.preferences?.notifications?.deadlines === false || user.preferences?.notifications?.emailNotifs === false) continue;

      const reminder = await createReminderNotification({
        Notification,
        tenantId,
        workspaceId: workspaceObjectId,
        userId: user._id,
        type: 'quick_task_deadline_approaching',
        title: 'Quick task due today',
        message: `${task.title} is due today.`,
        relatedId: String(task._id),
        rangeStart: reminderDay,
        rangeEnd: reminderDayEnd,
      });

      if (!reminder.created) continue;

      await sendTemplatedEmailSafe({
        to: user.email,
        templateKey: 'quickTaskDueToday',
        variables: {
          userName: user.name,
          taskTitle: task.title,
          priority: task.priority,
          dueDate: formatDateLabel(task.dueDate),
          taskUrl: `${String(process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}/quick-tasks/${String(task._id)}`,
        },
      });
      remindersSent += 1;
    }
  }

  return { remindersSent };
}

export async function sendDailyReportSummary({ companyId, workspaceId, report }) {
  if (!DAILY_REPORT_EMAILS_ENABLED && !DAILY_REPORT_NOTIFICATIONS_ENABLED) {
    return { emailsSent: 0, skipped: true, reason: 'daily_report_delivery_disabled' };
  }

  const tenantId = companyId;
  const workspaceObjectId = asObjectId(workspaceId) || workspaceId;
  const { User, Membership, Notification, Workspace } = await getTenantModels(companyId);
  const workspace = await Workspace.findOne({ _id: workspaceObjectId, tenantId }).lean();
  const memberships = await Membership.find({
    tenantId,
    workspaceId: workspaceObjectId,
    status: 'active',
    role: { $in: Array.from(REPORT_RECIPIENT_ROLES) },
  }).lean();

  const seenUsers = new Set();
  const recipients = [];
  for (const membership of memberships) {
    const key = String(membership.userId);
    if (seenUsers.has(key)) continue;
    seenUsers.add(key);
    recipients.push(key);
  }

  const users = await User.find({ _id: { $in: recipients }, tenantId, isActive: true }).lean();
  const reportDate = asDate(report?.reportDate) || new Date();
  const rangeStart = startOfDay(reportDate);
  const rangeEnd = endOfDay(reportDate);
  let emailsSent = 0;

  for (const user of users) {
    if (isTestEmailRecipient(user.email)) continue;
    if (user.preferences?.notifications?.emailNotifs === false) continue;
    if (user.preferences?.notifications?.weeklyDigest === false) continue;

    const existing = await Notification.findOne({
      tenantId,
      workspaceId: workspaceObjectId,
      userId: user._id,
      type: 'daily_work_report_generated',
      relatedId: String(report.id || report._id || ''),
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
    }).lean();

    if (existing) continue;

    if (DAILY_REPORT_NOTIFICATIONS_ENABLED) {
      await Notification.create({
        tenantId,
        workspaceId: workspaceObjectId,
        userId: user._id,
        type: 'daily_work_report_generated',
        title: 'Daily work report generated',
        message: `Daily work report for ${formatDateLabel(reportDate)} is ready.`,
        relatedId: String(report.id || report._id || ''),
        isRead: false,
      });
    }

    if (DAILY_REPORT_EMAILS_ENABLED) {
      await sendTemplatedEmailSafe({
        to: user.email,
        templateKey: 'dailyWorkReport',
        variables: {
          userName: user.name,
          reportDate: formatDateLabel(reportDate),
          workspaceName: workspace?.name || 'Workspace',
          totalCompletedToday: report.summary?.totalCompletedToday || 0,
          totalOverdueOpen: report.summary?.totalOverdueOpen || 0,
          averagePerformanceScore: report.summary?.averagePerformanceScore || 0,
          topPerformerName: report.summary?.topPerformerName || 'Not available',
          headline: report.analysis?.headline || 'Daily work report generated.',
        },
      });
      emailsSent += 1;
    }
  }

  return { emailsSent };
}

export async function runWorkspaceAutomation({ companyId, workspaceId, date = new Date() }) {
  const report = await buildDailyWorkspaceReport({ companyId, workspaceId, reportDate: date, persist: true });
  const [reportEmailSummary, reminderSummary] = await Promise.all([
    sendDailyReportSummary({ companyId, workspaceId, report }),
    sendDueDateReminderSweep({ companyId, workspaceId, date }),
  ]);
  return {
    report,
    emailsSent: reportEmailSummary.emailsSent,
    remindersSent: reminderSummary.remindersSent,
  };
}

export async function runAutomationSweep(date = new Date()) {
  if (AUTOMATION_STATE.isRunning) {
    return { skipped: true, reason: 'already_running' };
  }

  AUTOMATION_STATE.isRunning = true;
  try {
    await runOverdueTaskSweep(date);
    const companies = await Company.find({ status: { $ne: 'suspended' } }).select('_id').lean();
    const results = [];

    for (const company of companies) {
      const { Workspace } = await getTenantModels(company._id);
      const workspaces = await Workspace.find({ tenantId: company._id }).select('_id').lean();
      for (const workspace of workspaces) {
        const result = await runWorkspaceAutomation({
          companyId: company._id,
          workspaceId: workspace._id,
          date,
        });
        results.push({
          companyId: String(company._id),
          workspaceId: String(workspace._id),
          remindersSent: result.remindersSent,
          emailsSent: result.emailsSent,
        });
      }
    }

    return { skipped: false, results };
  } finally {
    AUTOMATION_STATE.isRunning = false;
  }
}

export function startReportAutomationScheduler() {
  if (String(process.env.REPORT_AUTOMATION_DISABLED || '').trim() === 'true') {
    safeConsoleLog('Report automation scheduler disabled by environment.');
    return;
  }
  if (AUTOMATION_STATE.timer) {
    return;
  }

  const run = async () => {
    try {
      const result = await runAutomationSweep(new Date());
      if (!result.skipped) {
        safeConsoleLog('Report automation sweep complete.', result.results?.length || 0);
      }
    } catch (error) {
      safeConsoleError('Report automation sweep failed:', error?.message || error);
    }
  };

  AUTOMATION_STATE.timer = setInterval(run, AUTOMATION_INTERVAL_MS);
  void run();
  safeConsoleLog(`Report automation scheduler started. Interval: ${AUTOMATION_INTERVAL_MS}ms`);
}

export function stopReportAutomationScheduler() {
  if (AUTOMATION_STATE.timer) {
    clearInterval(AUTOMATION_STATE.timer);
    AUTOMATION_STATE.timer = null;
  }
}
