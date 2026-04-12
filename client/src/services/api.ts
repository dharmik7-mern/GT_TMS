import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { emitErrorToast } from '../context/toastBus';

declare module 'axios' {
  export interface AxiosRequestConfig {
    suppressErrorToast?: boolean;
    retryable?: boolean;
    __skipAuthRefresh?: boolean;
    _retry?: boolean;
    idempotencyKey?: string;
    retryCount?: number;
  }

  export interface InternalAxiosRequestConfig {
    suppressErrorToast?: boolean;
    retryable?: boolean;
    __skipAuthRefresh?: boolean;
    _retry?: boolean;
    idempotencyKey?: string;
    retryCount?: number;
  }
}

const MAX_SAFE_RETRIES = 1;
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const resolvedBaseUrl = (import.meta.env.VITE_API_URL?.trim() || '/api/v1').replace(/\/+$/, '');

function getPersistedAuth() {
  const raw = localStorage.getItem('flowboard-auth');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getAccessToken() {
  return getPersistedAuth()?.state?.token || null;
}

function getRefreshToken() {
  return getPersistedAuth()?.state?.refreshToken || null;
}

function persistAuthState(nextState: Record<string, unknown>) {
  const current = getPersistedAuth();
  if (!current?.state) return;

  localStorage.setItem('flowboard-auth', JSON.stringify({
    ...current,
    state: {
      ...current.state,
      ...nextState,
    },
  }));
}

function clearPersistedAuth() {
  localStorage.removeItem('flowboard-auth');
}

function redirectToLogin() {
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

function createIdempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function shouldRetryRequest(error: AxiosError) {
  const config = error.config;
  if (!config) return false;

  const method = String(config.method || 'get').toLowerCase();
  const isRetryableMethod = RETRYABLE_METHODS.has(method) || Boolean(config.retryable);
  if (!isRetryableMethod) return false;
  if ((config.retryCount || 0) >= MAX_SAFE_RETRIES) return false;

  const status = error.response?.status;
  if (status && RETRYABLE_STATUS_CODES.has(status)) return true;
  return !error.response;
}

async function waitBeforeRetry(attempt: number) {
  await new Promise((resolve) => window.setTimeout(resolve, attempt * 250));
}

const api = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      const response = await refreshClient.post('/auth/refresh', { refreshToken }, { __skipAuthRefresh: true });
      const payload = response.data?.data || {};
      const nextToken = payload.token || null;
      if (!nextToken) return null;

      persistAuthState({
        token: nextToken,
        refreshToken: payload.refreshToken || refreshToken,
        user: payload.user,
        isAuthenticated: true,
      });

      return nextToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const originalMethod = String(config.method || 'get').toUpperCase();
    if (originalMethod === 'PUT' || originalMethod === 'PATCH' || originalMethod === 'DELETE') {
      config.headers = config.headers || {};
      config.headers['X-HTTP-Method-Override'] = originalMethod;
      config.method = 'post';
    }

    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.idempotencyKey) {
      config.headers['Idempotency-Key'] = config.idempotencyKey;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest.__skipAuthRefresh && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const nextToken = await refreshAccessToken();
        if (nextToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          return api(originalRequest);
        }
      } catch {
        clearPersistedAuth();
        redirectToLogin();
        return Promise.reject(error);
      }
    }

    if (status === 401) {
      clearPersistedAuth();
      redirectToLogin();
      return Promise.reject(error);
    }

    if (shouldRetryRequest(error) && originalRequest) {
      originalRequest.retryCount = (originalRequest.retryCount || 0) + 1;
      await waitBeforeRetry(originalRequest.retryCount);
      return api(originalRequest);
    }

    if (!originalRequest?.suppressErrorToast) {
      const message =
        (error.response?.data as any)?.error?.message ||
        (error.response?.data as any)?.message ||
        error.message ||
        'Request failed';

      if (status === 403) {
        window.alert(message);
        if (originalRequest) {
          originalRequest.suppressErrorToast = true;
        }
      } else {
        emitErrorToast(message, `Error ${status || ''}`.trim());
      }
    }

    return Promise.reject(error);
  }
);

export default api;

interface LoginPayload {
  email?: string;
  companyCode?: string;
  employeeCode?: string;
  password: string;
}

export const projectsService = {
  getAll: () => api.get('/projects'),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: unknown) => api.post('/projects', data, { idempotencyKey: createIdempotencyKey('project-create') }),
  importBulk: (rows: unknown[]) => api.post('/projects/import', { rows }, { idempotencyKey: createIdempotencyKey('project-import') }),
  update: (id: string, data: unknown) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const tasksService = {
  getAll: (projectId?: string, labels?: string[], tags?: string[], page?: number, limit?: number) =>
    api.get('/tasks', { params: { projectId, labels: labels?.join(','), tags: tags?.join(','), page, limit } }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: unknown) => api.post('/tasks', data, { idempotencyKey: createIdempotencyKey('task-create') }),
  getRequests: (params?: { projectId?: string; requestStatus?: 'pending' | 'approved' | 'rejected' }) =>
    api.get('/tasks/requests', { params }),
  createRequest: (data: unknown) => api.post('/tasks/requests', data, { idempotencyKey: createIdempotencyKey('task-request') }),
  reviewRequest: (id: string, body: { action: 'approve' | 'reject'; reviewNote?: string }) =>
    api.post(`/tasks/requests/${id}/review`, body),
  update: (id: string, data: unknown) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  getOverdue: () => api.get('/tasks/overdue'),
  move: (id: string, status: string) => api.patch(`/tasks/${id}/status`, { status }),
  review: (id: string, body: { action: 'approve' | 'changes_requested'; rating?: number; reviewRemark?: string }) =>
    api.post(`/tasks/${id}/review`, body),
  addSubtask: (taskId: string, body: { title: string; assigneeId?: string }) => api.post(`/tasks/${taskId}/subtasks`, body),
  patchSubtask: (taskId: string, subtaskId: string, body: unknown) =>
    api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, body),
  deleteSubtask: (taskId: string, subtaskId: string) => api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`),
  uploadAttachments: (taskId: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return api.post(`/tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  addComment: (taskId: string, body: { content: string }) => api.post(`/tasks/${taskId}/comments`, body),
  getActivities: (taskId: string) => api.get(`/tasks/${taskId}/activities`),
  getTimeTracking: (taskId: string, type: 'project' | 'quick') => api.get(`/tasks/${taskId}/time-tracking`, { params: { type } }),
};

export const usersService = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  getPerformance: (id: string) => api.get(`/users/${id}/performance`),
  create: (data: unknown) => api.post('/users', data, { idempotencyKey: createIdempotencyKey('user-create') }),
  importBulk: (rows: unknown[]) => api.post('/users/import', { rows }, { idempotencyKey: createIdempotencyKey('user-import') }),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  setPassword: (id: string, data: { newPassword: string }) => api.put(`/users/${id}/password`, data),
  getPendingTasks: (id: string) => api.get(`/users/${id}/pending-tasks`),
  reassignAndDeactivate: (id: string, data: { mappings: any[] }) => api.post(`/users/${id}/reassign-and-deactivate`, data, { idempotencyKey: createIdempotencyKey('user-deactivate') }),
  me: () => api.get('/users/me'),
  myPerformance: () => api.get('/users/me/performance'),
  updateMe: (data: unknown) => api.put('/users/me', data),
  updatePreferences: (data: unknown) => api.put('/users/me/preferences', data),
  updatePassword: (data: { currentPassword: string; newPassword: string }) => api.put('/users/me/password', data),
  updateProfilePhoto: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.put('/users/profile-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  delete: (id: string) => api.delete(`/users/${id}`),
};

export const labelsService = {
  getAll: () => api.get('/labels'),
  create: (data: { name: string; color: string }) => api.post('/labels', data, { idempotencyKey: createIdempotencyKey('label-create') }),
  delete: (id: string) => api.delete(`/labels/${id}`),
};

export const teamsService = {
  getAll: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: unknown) => api.post('/teams', data, { idempotencyKey: createIdempotencyKey('team-create') }),
  update: (id: string, data: unknown) => api.put(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
};

export const workspacesService = {
  getAll: () => api.get('/workspaces'),
  update: (id: string, data: unknown) => api.put(`/workspaces/${id}`, data),
  exportData: (id: string) => api.get(`/workspaces/${id}/export`),
};

export const companiesService = {
  getAll: () => api.get('/companies'),
  create: (data: unknown) => api.post('/companies', data, { idempotencyKey: createIdempotencyKey('company-create') }),
  update: (id: string, data: unknown) => api.put(`/companies/${id}`, data),
};

export const authService = {
  login: (payload: LoginPayload) => api.post('/auth/login', payload, { __skipAuthRefresh: true }),
  register: (data: unknown) => api.post('/auth/register', data, { __skipAuthRefresh: true, idempotencyKey: createIdempotencyKey('auth-register') }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }, { __skipAuthRefresh: true }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }, { __skipAuthRefresh: true }),
  logout: (refreshToken?: string | null) => api.post('/auth/logout', refreshToken ? { refreshToken } : {}, { __skipAuthRefresh: true }),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }, { __skipAuthRefresh: true }),
};

export const quickTasksService = {
  getAll: () => api.get('/quick-tasks'),
  create: (data: unknown) => api.post('/quick-tasks', data, { idempotencyKey: createIdempotencyKey('quick-task-create') }),
  importBulk: (rows: unknown[]) => api.post('/quick-tasks/import', { rows }, { idempotencyKey: createIdempotencyKey('quick-task-import') }),
  update: (id: string, data: unknown) => api.put(`/quick-tasks/${id}`, data),
  delete: (id: string) => api.delete(`/quick-tasks/${id}`),
  review: (id: string, body: { action: 'approve' | 'changes_requested'; rating?: number; reviewRemark?: string }) =>
    api.post(`/quick-tasks/${id}/review`, body),
  addComment: (taskId: string, body: { content: string }) => api.post(`/quick-tasks/${taskId}/comments`, body),
  uploadAttachments: (taskId: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return api.post(`/quick-tasks/${taskId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const notificationsService = {
  getAll: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  broadcast: (data: unknown) => api.post('/notifications/broadcast', data, { idempotencyKey: createIdempotencyKey('notifications-broadcast') }),
  getBroadcastHistory: () => api.get('/notifications/broadcast-history'),
};

export const misService = {
  getSummary: () => api.get('/mis/summary'),
  getTasks: () => api.get('/mis/tasks'),
  getEmployees: () => api.get('/mis/employees'),
  getProjects: () => api.get('/mis/projects'),
  getTime: () => api.get('/mis/time'),
  getWeeklyReport: () => api.get('/mis/weekly-report'),
};

export const reportsService = {
  getWeekly: () => api.get('/reports/weekly'),
  getEmployee: () => api.get('/reports/employee'),
  getProject: () => api.get('/reports/project'),
  getDaily: (limit = 14) => api.get('/reports/daily', { params: { limit } }),
  getDailyLatest: () => api.get('/reports/daily/latest'),
  runDailyNow: () => api.post('/reports/daily/run', {}, { idempotencyKey: createIdempotencyKey('reports-daily-run') }),
};

export const activityService = {
  getRecent: (limit = 50) => api.get('/activity', { params: { limit } }),
  list: (params?: { limit?: number; q?: string; type?: string; entityType?: string; days?: number }) =>
    api.get('/activity', { params }),
  getByProject: (projectId: string) => api.get(`/activity/project/${projectId}`),
  getProjectTimeline: (
    projectId: string,
    params?: {
      limit?: number;
      cursor?: string | null;
      userId?: string;
      status?: 'all' | 'created' | 'assigned' | 'completed' | 'updated';
      q?: string;
      startDate?: string;
      endDate?: string;
    },
    signal?: AbortSignal
  ) => api.get(`/activity/project/${projectId}/timeline`, { params, signal }),
};

export const systemSettingsService = {
  get: () => api.get('/settings/system'),
  update: (data: unknown) => api.put('/settings/system', data),
  clearCache: () => api.post('/settings/system/clear-cache', {}, { idempotencyKey: createIdempotencyKey('settings-clear-cache') }),
  refresh: () => api.post('/settings/system/refresh', {}, { idempotencyKey: createIdempotencyKey('settings-refresh') }),
  testEmail: (email: unknown) => api.post('/settings/system/test-email', email, { idempotencyKey: createIdempotencyKey('settings-test-email') }),
};

export const timelineService = {
  get: (projectId: string) => api.get(`/timeline/${projectId}`),
  upsert: (projectId: string, data: unknown) => api.post(`/timeline/${projectId}`, data, { idempotencyKey: createIdempotencyKey('timeline-upsert') }),
  patchTask: (taskId: string, data: unknown) => api.patch(`/timeline/task/${taskId}`, data),
  createDependency: (data: unknown) => api.post('/timeline/dependency', data, { idempotencyKey: createIdempotencyKey('timeline-dependency') }),
  lock: (projectId: string) => api.patch(`/timeline/${projectId}/lock`),
  unlock: (projectId: string) => api.patch(`/timeline/${projectId}/unlock`),
};

export const personalTasksService = {
  getAll: () => api.get('/personal-tasks'),
  getStats: () => api.get('/personal-tasks/stats'),
  create: (data: unknown) => api.post('/personal-tasks', data, { idempotencyKey: createIdempotencyKey('personal-task-create') }),
  update: (id: string, data: unknown) => api.put(`/personal-tasks/${id}`, data),
  delete: (id: string) => api.delete(`/personal-tasks/${id}`),
  togglePinned: (id: string) => api.patch(`/personal-tasks/${id}/toggle-pinned`),
};

export const reassignService = {
  create: (data: { taskId: string; requestedAssigneeId: string; note?: string }) => api.post('/tasks/reassign-request', data, { idempotencyKey: createIdempotencyKey('reassign-request') }),
  getAll: () => api.get('/tasks/reassign-requests'),
  approve: (id: string) => api.put(`/tasks/reassign-request/${id}/approve`),
  reject: (id: string, note?: string) => api.put(`/tasks/reassign-request/${id}/reject`, { note }),
  getStatus: (taskId: string) => api.get(`/tasks/reassign-request/status/${taskId}`),
};

export const extensionRequestsService = {
  create: (data: { taskIds: string[]; reason: string; requestedDueDate?: string; isExplanationOnly: boolean }) =>
    api.post('/extension-requests', data, { idempotencyKey: createIdempotencyKey('extension-request') }),
  getAll: () => api.get('/extension-requests'),
  approve: (id: string, comment?: string) => api.put(`/extension-requests/${id}/approve`, { comment }),
  reject: (id: string, comment: string) => api.put(`/extension-requests/${id}/reject`, { comment }),
};
