import express from 'express';

import authRoutes from './modules/auth.routes.js';
import projectsRoutes from './modules/projects.routes.js';
import tasksRoutes from './modules/tasks.routes.js';
import teamsRoutes from './modules/teams.routes.js';
import quickTasksRoutes from './modules/quickTasks.routes.js';
import notificationsRoutes from './modules/notifications.routes.js';
import activityRoutes from './modules/activity.routes.js';
import usersRoutes from './modules/users.routes.js';
import workspacesRoutes from './modules/workspaces.routes.js';
import companiesRoutes from './modules/companies.routes.js';
import settingsRoutes from './modules/settings.routes.js';
import misRoutes from './modules/mis.routes.js';
import reportsRoutes from './modules/reports.routes.js';
import timelineRoutes from './modules/timeline.routes.js';


const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/companies', companiesRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/teams', teamsRoutes);
router.use('/quick-tasks', quickTasksRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/activity', activityRoutes);
router.use('/settings', settingsRoutes);
router.use('/mis', misRoutes);
router.use('/reports', reportsRoutes);
router.use('/timeline', timelineRoutes);


export default router;

