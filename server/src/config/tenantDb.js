import mongoose from 'mongoose';
import { getUserModel } from '../models/User.js';
import { getWorkspaceModel } from '../models/Workspace.js';
import { getMembershipModel } from '../models/Membership.js';
import { getProjectModel } from '../models/Project.js';
import { getTaskModel } from '../models/Task.js';
import { getTeamModel } from '../models/Team.js';
import { getQuickTaskModel } from '../models/QuickTask.js';
import { getNotificationModel } from '../models/Notification.js';
import { getActivityLogModel } from '../models/ActivityLog.js';
import { getRefreshTokenModel } from '../models/RefreshToken.js';

// Single-database, shared-collections strategy:
// keep this helper name for compatibility, but always use the default connection.
export function getTenantModels() {
  const conn = mongoose.connection;
  return {
    conn,
    User: getUserModel(conn),
    Workspace: getWorkspaceModel(conn),
    Membership: getMembershipModel(conn),
    Project: getProjectModel(conn),
    Task: getTaskModel(conn),
    Team: getTeamModel(conn),
    QuickTask: getQuickTaskModel(conn),
    Notification: getNotificationModel(conn),
    ActivityLog: getActivityLogModel(conn),
    RefreshToken: getRefreshTokenModel(conn),
  };
}

