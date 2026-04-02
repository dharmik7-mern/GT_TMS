const RESERVED_TASK_TITLES = new Set(['test', 'new']);

export function normalizeTaskTitle(value?: string | null) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getReservedTaskTitleError(value?: string | null) {
  if (!RESERVED_TASK_TITLES.has(normalizeTaskTitle(value).toLowerCase())) return null;
  return 'Titles "test" and "new" are not allowed. Please use a descriptive title.';
}
