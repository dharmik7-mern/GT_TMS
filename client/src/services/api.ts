  import axios from "axios";

function resolveApiOrigin() {
  const configured = String(import.meta.env.VITE_PMS_API_ROOT || '').trim().replace(/\/+$/, '');
  if (configured && typeof window !== 'undefined') {
    return configured.replace('http://localhost:', `http://${window.location.hostname}:`);
  }
  if (configured) return configured;
  if (typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    return `http://${window.location.hostname}:5002`;
  }
  return 'http://localhost:5002';
}

// Primary Axios instance for PMS
// Relying entirely on HTTP-only cookies for authentication
const api = axios.create({
  baseURL: `${resolveApiOrigin()}/api/v1`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
const authApi = axios.create({
  baseURL: `${resolveApiOrigin()}/api/auth`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const projectsService = {
  getAll: () => api.get('/projects'),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: unknown) => api.post('/projects', data),
  update: (id: string, data: unknown) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const tasksService = {
  getAll: (projectId?: string) => api.get('/tasks', { params: { projectId } }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: unknown) => api.post('/tasks', data),
  update: (id: string, data: unknown) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  getOverview: () => api.get('/tasks/overview'),
  getOverdue: (config?: unknown) => api.get('/tasks/overdue', config as any),
};

export const teamsService = {
  getAll: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: unknown) => api.post('/teams', data, { idempotencyKey: createIdempotencyKey('team-create') }),
  update: (id: string, data: unknown) => api.put(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
};

export const quickTasksService = {
  getAll: () => api.get('/quick-tasks'),
  create: (data: unknown) => api.post('/quick-tasks', data),
  update: (id: string, data: unknown) => api.put(`/quick-tasks/${id}`, data),
  delete: (id: string) => api.delete(`/quick-tasks/${id}`),
};

export const notificationsService = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const usersService = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  me: () => api.get('/users/me'),
  updateMe: (data: unknown) => api.put('/users/me', data),
};

export const workspacesService = {
  getAll: () => api.get('/workspaces'),
};

export const companiesService = {
  getAll: () => api.get('/companies'),
  getById: (id: string) => api.get(`/companies/${id}`),
  create: (data: unknown) => api.post('/companies', data),
  update: (id: string, data: unknown) => api.put(`/companies/${id}`, data),
  delete: (id: string) => api.delete(`/companies/${id}`),
};

export const activityService = {
  getAll: () => api.get('/activities'),
  getRecent: (limit: number = 10) => api.get('/activity', { params: { limit } }),
};

export const reportsService = {
  getWeekly: () => api.get('/reports/weekly'),
  getEmployee: () => api.get('/reports/employee'),
  getProject: () => api.get('/reports/project'),
  getDaily: (limit: number = 10) => api.get('/reports/daily', { params: { limit } }),
  getDailyLatest: () => api.get('/reports/daily/latest'),
  runDaily: () => api.post('/reports/daily/run'),
};

export const systemSettingsService = {
  get: () => api.get('/settings/system'),
  update: (data: unknown) => api.put('/settings/system', data),
  clearCache: () => api.post('/settings/system/clear-cache'),
  refresh: () => api.post('/settings/system/refresh'),
  testEmail: (email: unknown) => api.post('/settings/system/test-email', { email }),
};

export const timelineService = {
  getByProject: (projectId: string) => api.get(`/projects/${projectId}/timeline`),
  create: (projectId: string, data: unknown) => api.post(`/projects/${projectId}/timeline`, data),
  update: (projectId: string, eventId: string, data: unknown) => api.put(`/projects/${projectId}/timeline/${eventId}`, data),
  remove: (projectId: string, eventId: string) => api.delete(`/projects/${projectId}/timeline/${eventId}`),
};

export const personalTasksService = {
  getAll: () => api.get('/personal-tasks'),
  getStats: () => api.get('/personal-tasks/stats'),
  create: (data: unknown) => api.post('/personal-tasks', data, { idempotencyKey: createIdempotencyKey('personal-task-create') }),
  update: (id: string, data: unknown) => api.put(`/personal-tasks/${id}`, data),
  delete: (id: string) => api.delete(`/personal-tasks/${id}`),
};

export const labelsService = {
  getAll: () => api.get('/labels'),
  getById: (id: string) => api.get(`/labels/${id}`),
  create: (data: unknown) => api.post('/labels', data),
  update: (id: string, data: unknown) => api.put(`/labels/${id}`, data),
  remove: (id: string) => api.delete(`/labels/${id}`),
};

export const reassignService = {
  getAll: () => api.get('/reassign-requests'),
  approve: (id: string) => api.post(`/reassign-requests/${id}/approve`),
  reject: (id: string, note?: string) => api.post(`/reassign-requests/${id}/reject`, { note }),
};

export const authService = {
  login: (payload: any) => authApi.post('/login', payload),
  logout: () => authApi.post('/sso-logout'),
  ssoMe: () => authApi.get('/sso/me'),
};

export default api;




