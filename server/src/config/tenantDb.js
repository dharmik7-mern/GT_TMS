import mongoose from 'mongoose';
import Company from '../models/Company.js';
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
import { getProjectTimelineModel } from '../models/ProjectTimeline.js';


const TENANT_DB_PREFIX = process.env.TENANT_DB_PREFIX || 'GT_TMS';
const tenantDbCache = new Map();

function normalizeSegment(value, fallback = 'tenant') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (normalized || fallback).slice(0, 24);
}

export function buildTenantDatabaseName({ companyName, organizationId }) {
  const namePart = normalizeSegment(companyName, 'company');
  const orgPart = normalizeSegment(organizationId, 'org');
  return `${TENANT_DB_PREFIX}_${namePart}_${orgPart}`.slice(0, 63);
}

async function resolveTenantDatabaseName(companyId) {
  const cacheKey = String(companyId);
  if (tenantDbCache.has(cacheKey)) {
    return tenantDbCache.get(cacheKey);
  }

  const company = await Company.findById(companyId).select('name organizationId databaseName');
  if (!company) {
    const err = new Error('Company not found');
    err.statusCode = 404;
    err.code = 'COMPANY_NOT_FOUND';
    throw err;
  }

  const databaseName = company.databaseName || buildTenantDatabaseName({
    companyName: company.name,
    organizationId: company.organizationId,
  });

  if (company.databaseName !== databaseName) {
    company.databaseName = databaseName;
    await company.save();
  }

  tenantDbCache.set(cacheKey, databaseName);
  return databaseName;
}

export async function getTenantConnection(companyId = null) {
  const baseConn = mongoose.connection;
  if (!companyId) {
    return baseConn;
  }

  const databaseName = await resolveTenantDatabaseName(companyId);
  return baseConn.useDb(databaseName, { useCache: true });
}

export function clearTenantDbCache(companyId = null) {
  if (!companyId) {
    tenantDbCache.clear();
    return;
  }
  tenantDbCache.delete(String(companyId));
}

export async function getTenantModels(companyId = null) {
  const conn = await getTenantConnection(companyId);
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
    ProjectTimeline: getProjectTimelineModel(conn),
  };
}


