import React from 'react';
import NotFound404 from '../pages/errors/NotFound404';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import UnauthorizedPage from '../pages/errors/UnauthorizedPage';
import AccessDeniedPage from '../pages/errors/AccessDeniedPage';
import { mapGtOneRole } from '../utils/roleMapping';

// Auth pages
import { ForgotPasswordPage, ResetPasswordPage } from '../pages/auth/ForgotPassword';
import SSOCallbackPage from '../pages/auth/SSOCallback';
import SSOErrorPage from '../pages/auth/SSOError';

// App pages
import DashboardPage from '../pages/dashboard/Dashboard';
import ProjectsPage from '../pages/projects/Projects';
import ProjectDetailPage from '../pages/projects/ProjectDetail';
import ProjectTodoPage from '../pages/projects/ProjectTodoPage';
import CalendarPage from '../pages/calendar/Calendar';
import TeamsPage from '../pages/teams/Teams';
import ReportsPage from '../pages/reports/Reports';
// import ReportManagementPage from '../pages/reports/ReportManagement';
import QuickTasksPage from '../pages/quicktasks/QuickTasks';
import QuickTaskDetailPage from '../pages/quicktasks/QuickTaskDetail';
import MyTasksPage from '../pages/tasks/MyTasks';
import TasksManagement from '../pages/tasks/TasksManagement';
import TaskRequestsPage from '../pages/tasks/TaskRequests';
import MISEntry from '../pages/mis/MISEntry';
import MISManager from '../pages/mis/MISManager';
import MISReports from '../pages/mis/MISReports';
import NotificationsPage from '../pages/notifications/Notifications';
import UserSettingsPage from '../pages/settings/Settings';
import PlannerPage from '../pages/planner/Planner';

// Admin pages
import {
  AdminWorkspacesPage,
  AdminUsersPage,
  AdminPermissionsPage,
  AdminBillingPage,
} from '../pages/admin/Admin';
import AdminUserProfilePage from '../pages/admin/AdminUserProfile';

// Super Admin pages
import {
  Companies as SACompanies,
  Users as SAUsers,
  RolesPermissions as SARoles,
  Notifications as SABroadcast,
  Settings as SASettings,
  Support as SASupport,
} from '../pages/super-admin';

const SettingsRoute: React.FC = () => {
  const { user } = useAuth();
  const role = mapGtOneRole(user?.role);
  if (role === 'super_admin' || role === 'admin' || role === 'company_admin') {
    return <SASettings />;
  }
  return <UserSettingsPage />;
};

export const router = createBrowserRouter([
  // Auth routes
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'login',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'register',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'loginWithId',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
      },
      {
        path: 'sso/callback',
        element: <SSOCallbackPage />,
      },
      {
        path: 'sso/error',
        element: <SSOErrorPage />,
      },
    ],
  },
  // App routes
  {
    path: '/',
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      { path: 'dashboard', element: <DashboardPage /> },

      // Standard App (Maintained as requested)
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'projects/:projectId/todo', element: <ProjectTodoPage /> },
      { path: 'projects/:id/requests', element: <TaskRequestsPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      // { path: 'reports-management', element: <ReportManagementPage /> },
      { path: 'mis-entry', element: <MISEntry /> },
      {
        path: 'mis-manager',
        element: (
          <PrivateRoute roles={['super_admin', 'company_admin', 'admin', 'manager', 'team_leader']}>
            <MISManager />
          </PrivateRoute>
        ),
      },
      { path: 'mis-reports', element: <MISReports /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'quick-tasks', element: <QuickTasksPage /> },
      { path: 'quick-tasks/:id', element: <QuickTaskDetailPage /> },
      { path: 'my-tasks', element: <MyTasksPage /> },
      { path: 'tasks', element: <TasksManagement /> },
      { path: 'task-requests', element: <TaskRequestsPage /> },

      // Super Admin Modules (Separate routes)
      { path: 'companies', element: <SACompanies /> },
      { path: 'companies/:id', element: <SACompanies /> },
      { path: 'users', element: <SAUsers /> },
      { path: 'roles-permissions', element: <SARoles /> },
      { path: 'settings', element: <SettingsRoute /> },
<<<<<<< HEAD
      {
        path: 'logs',
        element: (
          <PrivateRoute roles={['super_admin', 'company_admin', 'admin', 'manager', 'team_leader']}>
            <SALogs />
          </PrivateRoute>
        ),
      },
=======
>>>>>>> main
      { path: 'support', element: <SASupport /> },
      { path: 'broadcast-notifications', element: <SABroadcast /> },
      { path: 'profile', element: <UserSettingsPage /> },

      // Admin
      { path: 'admin/workspaces', element: <AdminWorkspacesPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
      { path: 'admin/users/:id', element: <AdminUserProfilePage /> },
      { path: 'admin/permissions', element: <AdminPermissionsPage /> },
      { path: 'admin/billing', element: <AdminBillingPage /> },
      { path: 'planner', element: <PlannerPage /> },
    ],
  },
  {
<<<<<<< HEAD
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },
  {
    path: '/500',
    element: <Error500Page />,
  },
  {
=======
>>>>>>> main
    path: '*',
    element: <NotFound404 />,
  },
], {
  future: {
    v7_relativeSplatPath: true,
    // @ts-expect-error: supported at runtime in newer router future flags.
    v7_startTransition: true,
  },
});

export default router;
