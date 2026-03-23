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
    if (error.response?.status === 401) {
      localStorage.removeItem('flowboard-auth');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (!error.config?.suppressErrorToast) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Request failed';
      emitErrorToast(message, `Error ${error?.response?.status || ''}`.trim());
    }

    return Promise.reject(error);
  }
);

export default api;

// Typed service functions (stubbed — replace with real API calls)
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
  move: (id: string, status: string) => api.patch(`/tasks/${id}/status`, { status }),
  review: (id: string, body: { action: 'approve' | 'changes_requested'; reviewRemark?: string }) =>
    api.post(`/tasks/${id}/review`, body),
  addSubtask: (taskId: string, body: { title: string }) => api.post(`/tasks/${taskId}/subtasks`, body),
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
  create: (data: unknown) => api.post('/users', data),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  me: () => api.get('/users/me'),
  updateMe: (data: unknown) => api.put('/users/me', data),
  updatePreferences: (data: unknown) => api.put('/users/me/preferences', data),
  updatePassword: (data: { currentPassword: string; newPassword: string }) => api.put('/users/me/password', data),
};

export const teamsService = {
  getAll: () => api.get('/teams'),
  getById: (id: string) => api.get(`/teams/${id}`),
  create: (data: unknown) => api.post('/teams', data),
  update: (id: string, data: unknown) => api.put(`/teams/${id}`, data),
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
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: unknown) => api.post('/auth/register', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  logout: (refreshToken?: string | null) => api.post('/auth/logout', refreshToken ? { refreshToken } : {}),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

export const quickTasksService = {
  getAll: () => api.get('/quick-tasks'),
  create: (data: unknown) => api.post('/quick-tasks', data),
  update: (id: string, data: unknown) => api.put(`/quick-tasks/${id}`, data),
  delete: (id: string) => api.delete(`/quick-tasks/${id}`),
  review: (id: string, body: { action: 'approve' | 'changes_requested'; reviewRemark?: string }) =>
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
