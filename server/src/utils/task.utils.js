export function isTaskOverdue(task, currentDate = new Date()) {
  if (!task.dueDate) return false;

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);

  // Map system statuses to terminal states (DONE maps to COMPLETED)
  const status = (task.status || '').toUpperCase();
  const terminalStatuses = ['DONE', 'COMPLETED', 'CANCELLED'];

  return (
    due.getTime() < today.getTime() && 
    !terminalStatuses.includes(status)
  );
}

export function getOverdueQueryFilter(currentDate = new Date()) {
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  return {
    dueDate: { $lt: today, $ne: null },
    status: { $nin: ['done', 'completed', 'cancelled'] },
  };
}
