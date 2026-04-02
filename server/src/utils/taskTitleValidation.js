export const RESERVED_TASK_TITLES = new Set(['test', 'new']);

export function normalizeTaskTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function isReservedTaskTitle(value) {
  return RESERVED_TASK_TITLES.has(normalizeTaskTitle(value).toLowerCase());
}

export function reservedTaskTitleMessage() {
  return 'Titles "test" and "new" are not allowed. Please use a descriptive title.';
}

export function assertAllowedTaskTitle(value) {
  if (!isReservedTaskTitle(value)) return;

  const err = new Error(reservedTaskTitleMessage());
  err.statusCode = 400;
  err.code = 'RESERVED_TASK_TITLE';
  throw err;
}
