import Company from '../models/Company.js';
import AuthLookup from '../models/AuthLookup.js';
import SystemSetting from '../models/SystemSetting.js';
import { getTenantModels } from '../config/tenantDb.js';
import { hashPassword } from '../utils/password.js';
import { assertPasswordAllowed, formatGeneratedId, getCompanyIdConfig } from './settings.service.js';

async function reserveOrganizationId() {
  const config = await getCompanyIdConfig();
  let nextSequence = config.nextSequence;
  let organizationId = formatGeneratedId(config, nextSequence);

  while (await Company.exists({ organizationId })) {
    nextSequence += 1;
    organizationId = formatGeneratedId(config, nextSequence);
  }

  return {
    organizationId,
    nextSequenceUsed: nextSequence,
  };
}

function getDefaultEmployeeIdConfig() {
  return {
    prefix: 'EMP',
    separator: '-',
    digits: 4,
    nextSequence: 1,
  };
}

function formatEmployeeId(config, sequence) {
  const normalized = {
    prefix: String(config?.prefix ?? 'EMP').trim(),
    separator: String(config?.separator ?? '-'),
    digits: Math.max(1, Math.min(8, Number(config?.digits ?? 4) || 4)),
  };
  return `${normalized.prefix}${normalized.separator}${String(sequence).padStart(normalized.digits, '0')}`;
}

async function getCompanyCounts(companyId) {
  const { User, Project } = getTenantModels();
  const [usersCount, projectsCount] = await Promise.all([
    User.countDocuments({ tenantId: companyId }),
    Project.countDocuments({ tenantId: companyId }),
  ]);

  return { usersCount, projectsCount };
}

async function serializeCompany(company) {
  const { usersCount, projectsCount } = await getCompanyCounts(company._id);

  return {
    id: company.id,
    organizationId: company.organizationId,
    name: company.name,
    email: company.email,
    usersCount,
    projectsCount,
    status: company.status,
    createdAt: company.createdAt.toISOString(),
    color: company.color || '#3366ff',
  };
}

export async function listCompanies() {
  const companies = await Company.find().sort({ createdAt: -1 });

  // lightweight counts (can be optimized with aggregation later)
  const uMap = new Map();
  const pMap = new Map();
  const { User, Project } = getTenantModels();

  await Promise.all(companies.map(async (c) => {
    try {
      const [uc, pc] = await Promise.all([
        User.countDocuments({ tenantId: c._id }),
        Project.countDocuments({ tenantId: c._id }),
      ]);
      uMap.set(c._id.toString(), uc);
      pMap.set(c._id.toString(), pc);
    } catch (e) {
      console.error(`Error fetching counts for company ${c._id}:`, e);
      uMap.set(c._id.toString(), 0);
      pMap.set(c._id.toString(), 0);
    }
  }));

  return companies.map((c) => ({
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    email: c.email,
    usersCount: uMap.get(c.id) || 0,
    projectsCount: pMap.get(c.id) || 0,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    color: c.color || '#3366ff',
  }));
}

export async function createCompanyWithAdmin({ name, adminName, adminEmail, adminPassword, initialUserLimit, status }) {
  const existing = await Company.findOne({ email: adminEmail.toLowerCase() });
  if (existing) {
    const err = new Error('Company admin email already exists');
    err.statusCode = 409;
    err.code = 'DUPLICATE_EMAIL';
    throw err;
  }

  await assertPasswordAllowed(adminPassword);

  const { organizationId, nextSequenceUsed } = await reserveOrganizationId();
  const company = await Company.create({
    organizationId,
    name,
    email: adminEmail.toLowerCase(),
    status,
    color: '#3366ff',
  });

  await AuthLookup.updateOne(
    { email: adminEmail.toLowerCase() },
    { $set: { email: adminEmail.toLowerCase(), tenantId: company._id } },
    { upsert: true }
  );

  const { User, Workspace, Membership } = getTenantModels();
  const employeeIdConfig = getDefaultEmployeeIdConfig();
  const adminEmployeeId = formatEmployeeId(employeeIdConfig, employeeIdConfig.nextSequence);

  const passwordHash = await hashPassword(adminPassword);
  const admin = await User.create({
    tenantId: company._id,
    name: adminName,
    email: adminEmail.toLowerCase(),
    employeeId: adminEmployeeId,
    passwordHash,
    role: 'admin',
    isActive: true,
  });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || `company-${company.id.slice(-6)}`;
  const workspace = await Workspace.create({
    tenantId: company._id,
    name,
    slug,
    plan: 'pro',
    ownerId: admin._id,
    settings: {
      employeeIdConfig: {
        ...employeeIdConfig,
        nextSequence: employeeIdConfig.nextSequence + 1,
      },
      security: {
        strongPasswords: true,
      },
    },
  });

  await Membership.create({
    tenantId: company._id,
    workspaceId: workspace._id,
    userId: admin._id,
    role: 'admin',
    status: 'active',
  });

  await SystemSetting.updateOne(
    { key: 'system' },
    { $set: { 'idGeneration.company.nextSequence': nextSequenceUsed + 1 } }
  );

  return {
    id: company.id,
    organizationId: company.organizationId,
    name: company.name,
    email: company.email,
    usersCount: 1,
    projectsCount: 0,
    status: company.status,
    createdAt: company.createdAt.toISOString(),
    color: company.color || '#3366ff',
    initialUserLimit: initialUserLimit ?? 50,
    adminUserId: admin.id,
    adminEmployeeId: admin.employeeId,
    workspaceId: workspace.id,
  };
}

export async function updateCompany({ id, name, adminEmail, status }) {
  const company = await Company.findById(id);
  if (!company) return null;

  const nextEmail = adminEmail.trim().toLowerCase();
  const existing = await Company.findOne({ email: nextEmail, _id: { $ne: id } });
  if (existing) {
    const err = new Error('Company admin email already exists');
    err.statusCode = 409;
    err.code = 'DUPLICATE_EMAIL';
    throw err;
  }

  const previousEmail = company.email;
  company.name = name.trim();
  company.email = nextEmail;
  company.status = status;
  await company.save();

  const { User, Workspace } = getTenantModels();

  if (previousEmail !== nextEmail) {
    await User.updateMany(
      { tenantId: company._id, role: 'admin', email: previousEmail.toLowerCase() },
      { $set: { email: nextEmail } }
    );
    await AuthLookup.deleteOne({ email: previousEmail.toLowerCase() });
    await AuthLookup.updateOne(
      { email: nextEmail },
      { $set: { email: nextEmail, tenantId: company._id } },
      { upsert: true }
    );
  }

  await Workspace.updateMany({ tenantId: company._id }, { $set: { name: company.name } });

  return serializeCompany(company);
}

