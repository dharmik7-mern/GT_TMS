import Company from '../models/Company.js';
import { getTenantModels } from '../config/tenantDb.js';
import { getOverdueQueryFilter } from '../utils/task.utils.js';

/**
 * Sweeps all active companies and their workspaces to find overdue tasks.
 * Marks them as overdue and triggers notifications.
 */
export async function runOverdueTaskSweep(date = new Date()) {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);

  const companies = await Company.find({ status: { $ne: 'suspended' } }).select('_id').lean();
  const summary = [];

  for (const company of companies) {
    const { Task, Notification } = await getTenantModels(company._id);
    
    // 1. Find tasks that SHOULD BE overdue but aren't marked yet
    const overdueFilter = getOverdueQueryFilter(date);
    const query = {
      tenantId: company._id,
      ...overdueFilter,
      isOverdue: { $ne: true }
    };

    const overdueTasks = await Task.find(query).lean();
    
    if (overdueTasks.length > 0) {
      const taskIds = overdueTasks.map(t => t._id);
      
      // Mark tasks as overdue
      await Task.updateMany(
        { _id: { $in: taskIds } },
        { 
          $set: { 
            isOverdue: true, 
            overdueSince: date 
          } 
        }
      );
      
      // ... notifications trigger code below ...
    }

    // 2. CLEANUP: Unmark tasks that are NOT overdue but marked as such (e.g. due today)
    // A task is NOT overdue if due_date >= today OR status is terminal
    await Task.updateMany(
      {
        tenantId: company._id,
        isOverdue: true,
        $or: [
          { dueDate: { $gte: today } },
          { status: { $in: ['done', 'completed', 'cancelled'] } }
        ]
      },
      {
        $set: { isOverdue: false, overdueSince: null }
      }
    );

    // Trigger notifications for each task
    for (const task of overdueTasks) {
      const audience = new Set();
      if (task.reporterId) audience.add(String(task.reporterId));
      if (task.assigneeIds) {
        task.assigneeIds.forEach(id => {
          if (id) audience.add(String(id));
        });
      }

      if (audience.size > 0) {
        const notificationData = Array.from(audience).map(userId => ({
          tenantId: company._id,
          workspaceId: task.workspaceId,
          userId,
          type: 'task_overdue',
          title: 'Task Overdue',
          message: `Task "${task.title}" is overdue. Please provide a reason or request an extension.`,
          relatedId: String(task._id),
          isRead: false
        }));
        
        await Notification.insertMany(notificationData);
      }
    }

    summary.push({
      companyId: String(company._id),
      markedCount: overdueTasks.length
    });
  }

  return summary;
}
