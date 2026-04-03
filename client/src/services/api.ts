import axios from 'axios';
import { emitErrorToast } from '../context/toastBus';

// Base API instance — connect to real backend by changing baseURL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const method = String(config.method || 'get').toUpperCase();
    if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      config.headers = config.headers || {};
      config.headers['X-HTTP-Method-Override'] = method;
      config.method = 'post';
    }

    const token = localStorage.getItem('flowboard-auth');
    if (token) {
      try {
        const parsed = JSON.parse(token);
        if (parsed?.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`;
        }
      } catch {
        // ignore
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem('flowboard-auth');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (status >= 500) {
      if (window.location.pathname !== '/500') {
        window.location.href = '/500';
      }
      return Promise.reject(error);
    }

    if (!error.config?.suppressErrorToast) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Request failed';
      
      if (status === 403) {
        window.alert(message);
        // Mark as already handled to prevent duplicate toasts in components
        if (error.config) {
          error.config.suppressErrorToast = true;
        }
      } else {
        emitErrorToast(message, `Error ${error?.response?.status || ''}`.trim());
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

// Typed service functions (stubbed — replace with real API calls)
export const projectsService = {
  getAll: () => api.get('/projects'),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: unknown) => api.post('/projects', data),
  importBulk: (rows: unknown[]) => api.post('/projects/import', { rows }),
  update: (id: string, data: unknown) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

export const tasksService = {
  getAll: (projectId?: string) => api.get('/tasks', { params: { projectId } }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: unknown) => api.post('/tasks', data),
  getRequests: (params?: { projectId?: string; requestStatus?: 'pending' | 'approved' | 'rejected' }) =>
    api.get('/tasks/requests', { params }),
  createRequest: (data: unknown) => api.post('/tasks/requests', data),
  reviewRequest: (id: string, body: { action: 'approve' | 'reject'; reviewNote?: string }) =>
    api.post(`/tasks/requests/${id}/review`, body),
  update: (id: string, data: unknown) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
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
};

export const usersService = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  getPerformance: (id: string) => api.get(`/users/${id}/performance`),
  create: (data: unknown) => api.post('/users', data),
  importBulk: (rows: unknown[]) => api.post('/users/import', { rows }),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  setPassword: (id: string, data: { newPassword: string }) => api.put(`/users/${id}/password`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
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
};

export const teamsService = {
  getAll: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: unknown) => api.post('/teams', data),
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
  create: (data: unknown) => api.post('/companies', data),
  update: (id: string, data: unknown) => api.put(`/companies/${id}`, data),
};

export const authService = {
  login: (payload: LoginPayload) => api.post('/auth/login', payload),
  register: (data: unknown) => api.post('/auth/register', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  logout: (refreshToken?: string | null) => api.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

export const quickTasksService = {
  getAll: () => api.get('/quick-tasks'),
  create: (data: unknown) => api.post('/quick-tasks', data),
  importBulk: (rows: unknown[]) => api.post('/quick-tasks/import', { rows }),
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
  broadcast: (data: unknown) => api.post('/notifications/broadcast', data),
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

export const activityService = {
  getRecent: (limit = 50) => api.get('/activity', { params: { limit } }),
  list: (params?: { limit?: number; q?: string; type?: string; entityType?: string; days?: number }) =>
    api.get('/activity', { params }),
};

export const systemSettingsService = {
  get: () => api.get('/settings/system'),
  update: (data: unknown) => api.put('/settings/system', data),
  clearCache: () => api.post('/settings/system/clear-cache'),
  refresh: () => api.post('/settings/system/refresh'),
  testEmail: (email: unknown) => api.post('/settings/system/test-email', email),
};

export const timelineService = {
  get: (projectId: string) => api.get(`/timeline/${projectId}`),
  upsert: (projectId: string, data: unknown) => api.post(`/timeline/${projectId}`, data),
  patchTask: (taskId: string, data: unknown) => api.patch(`/timeline/task/${taskId}`, data),
  createDependency: (data: unknown) => api.post('/timeline/dependency', data),
  lock: (projectId: string) => api.patch(`/timeline/${projectId}/lock`),
  unlock: (projectId: string) => api.patch(`/timeline/${projectId}/unlock`),
};

export const personalTasksService = {
  getAll: () => api.get('/personal-tasks'),
  getStats: () => api.get('/personal-tasks/stats'),
  create: (data: unknown) => api.post('/personal-tasks', data),
  update: (id: string, data: unknown) => api.put(`/personal-tasks/${id}`, data),
  delete: (id: string) => api.delete(`/personal-tasks/${id}`),
  togglePinned: (id: string) => api.patch(`/personal-tasks/${id}/toggle-pinned`),
};

export const reassignService = {
  create: (data: { taskId: string; requestedAssigneeId: string; note?: string }) => api.post('/tasks/reassign-request', data),
  getAll: () => api.get('/tasks/reassign-requests'),
  approve: (id: string) => api.put(`/tasks/reassign-request/${id}/approve`),
  reject: (id: string, note?: string) => api.put(`/tasks/reassign-request/${id}/reject`, { note }),
  getStatus: (taskId: string) => api.get(`/tasks/reassign-request/status/${taskId}`),
};
