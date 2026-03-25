import Company from '../models/Company.js';
import AuthLookup from '../models/AuthLookup.js';
import { buildTenantDatabaseName, getTenantModels } from '../config/tenantDb.js';
import { hashPassword } from '../utils/password.js';
import { formatGeneratedId, getCompanyIdConfig } from '../services/settings.service.js';

async function reserveOrganizationId() {
  const config = await getCompanyIdConfig();
  let nextSequence = config.nextSequence;
  let organizationId = formatGeneratedId(config, nextSequence);

  while (await Company.exists({ organizationId })) {
    nextSequence += 1;
    organizationId = formatGeneratedId(config, nextSequence);
  }

  return organizationId;
}

async function dedupeUsersForEmail({ User, companyId, email, keepUserId }) {
  await User.deleteMany({
    _id: { $ne: keepUserId },
    email,
    $or: [
      { tenantId: companyId },
      { tenantId: { $exists: false } },
      { tenantId: null },
      { companyId },
    ],
  });
}

export async function ensureBootstrapSuperAdmin() {
  const superAdminEmail = (process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || 'gitakshmi@gmail.com').toLowerCase();
  const superAdminName = process.env.BOOTSTRAP_SUPER_ADMIN_NAME || 'Dhiren Makwana';
  const superAdminPassword = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD || 'Gitakshmi@123';
  const workspaceName = process.env.BOOTSTRAP_SUPER_ADMIN_WORKSPACE || 'Gitakshmi Technologies';

  let company = await Company.findOne({ email: superAdminEmail });
  if (!company) {
    const organizationId = await reserveOrganizationId();
    company = await Company.create({
      organizationId,
      name: workspaceName,
      email: superAdminEmail,
      databaseName: buildTenantDatabaseName({ companyName: workspaceName, organizationId }),
      status: 'active',
      color: '#3366ff',
    });
  }

  const { User, Workspace, Membership } = await getTenantModels(company._id);

  await AuthLookup.updateOne(
    { email: superAdminEmail },
    { $set: { email: superAdminEmail, tenantId: company._id } },
    { upsert: true }
  );

  let superAdmin = await User.findOne({ tenantId: company._id, email: superAdminEmail }).select('+passwordHash');
  if (!superAdmin) {
    superAdmin = await User.findOne({
      email: superAdminEmail,
      $or: [
        { tenantId: { $exists: false } },
        { tenantId: null },
        { companyId: company._id },
      ],
    }).select('+passwordHash');

    if (superAdmin) {
      await User.updateOne(
        { _id: superAdmin._id },
        { $set: { tenantId: company._id }, $unset: { companyId: '' } }
      );
      superAdmin.tenantId = company._id;
    }
  }

  if (!superAdmin) {
    const passwordHash = await hashPassword(superAdminPassword);
    superAdmin = await User.create({
      tenantId: company._id,
      name: superAdminName,
      email: superAdminEmail,
      passwordHash,
      role: 'super_admin',
      jobTitle: 'Super Admin',
      department: 'Platform',
      isActive: true,
      color: '#3366ff',
    });
  }

  const slugBase = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
  let workspace = await Workspace.findOne({ tenantId: company._id }).sort({ createdAt: 1 });
  if (!workspace) {
    workspace = await Workspace.create({
      tenantId: company._id,
      name: workspaceName,
      slug: slugBase,
      plan: 'pro',
      ownerId: superAdmin._id,
    });
  }

  await Membership.updateOne(
    { tenantId: company._id, workspaceId: workspace._id, userId: superAdmin._id },
    { $set: { role: 'super_admin', status: 'active' } },
    { upsert: true }
  );
}

export async function ensureDevSeed() {
  if (process.env.NODE_ENV === 'production') return;
  const superAdminEmail = 'gitakshmi@gmail.com';
  const superAdminName = 'Dhiren Makwana';

  let company = await Company.findOne({ email: superAdminEmail });
  if (!company) {
    const organizationId = await reserveOrganizationId();
    company = await Company.create({
      organizationId,
      name: 'Gitakshmi Technologies',
      email: superAdminEmail,
      databaseName: buildTenantDatabaseName({ companyName: 'Gitakshmi Technologies', organizationId }),
      status: 'active',
      color: '#3366ff',
    });
  }

  await dedupeUsersForEmail({
    User,
    companyId: company._id,
    email: superAdminEmail,
    keepUserId: superAdmin._id,
  });

  await AuthLookup.updateOne(
    { email: superAdminEmail },
    { $set: { email: superAdminEmail, tenantId: company._id }, $unset: { companyId: '' } },
    { upsert: true }
  );

  const { User, Workspace, Membership } = await getTenantModels(company._id);

  let superAdmin = await User.findOne({ tenantId: company._id, email: superAdminEmail }).select('+passwordHash');
  // Pre-migration docs may still have companyId instead of tenantId — avoid duplicate User.create.
  if (!superAdmin) {
    superAdmin = await User.findOne({ email: superAdminEmail }).select('+passwordHash');
    if (superAdmin) {
      await User.updateOne(
        { _id: superAdmin._id },
        { $set: { tenantId: company._id }, $unset: { companyId: '' } }
      );
      superAdmin.tenantId = company._id;
    }
  }
  if (!superAdmin) {
    const passwordHash = await hashPassword('Gitakshmi@123');
    superAdmin = await User.create({
      tenantId: company._id,
      name: superAdminName,
      email: superAdminEmail,
      passwordHash,
      role: 'super_admin',
      jobTitle: 'Super Admin',
      department: 'Platform',
      isActive: true,
      color: '#3366ff',
    });
  }

  await dedupeUsersForEmail({
    User,
    companyId: company._id,
    email: superAdminEmail,
    keepUserId: superAdmin._id,
  });

  let workspace = await Workspace.findOne({ tenantId: company._id, slug: 'gitakshmitech' });
  if (!workspace) {
    workspace = await Workspace.findOne({ companyId: company._id, slug: 'gitakshmitech' });
    if (workspace) {
      await Workspace.updateOne({ _id: workspace._id }, { $set: { tenantId: company._id }, $unset: { companyId: '' } });
      workspace.tenantId = company._id;
    }
  }
  if (!workspace) {
    workspace = await Workspace.create({
      tenantId: company._id,
      name: 'Gitakshmi Technologies',
      slug: 'gitakshmitech',
      plan: 'pro',
      ownerId: superAdmin._id,
    });
  }

  // Match by workspace + user (unique); do not use tenantId in filter — legacy rows may only have companyId.
  await Membership.updateOne(
    { workspaceId: workspace._id, userId: superAdmin._id },
    {
      $set: { tenantId: company._id, role: 'super_admin', status: 'active' },
      $unset: { companyId: '' },
    },
    { upsert: true }
  );

  // After migrating tenantId on documents, align indexes (removes legacy email_1 unique if present).
  try {
    await User.syncIndexes();
    await Workspace.syncIndexes();
    await Membership.syncIndexes();
  } catch (e) {
    console.warn('[seed] syncIndexes:', e.message);
    try {
      await User.collection.dropIndex('email_1');
      await User.syncIndexes();
    } catch (e2) {
      console.warn('[seed] Could not fix User indexes (try: db.users.dropIndex("email_1")):', e2.message);
    }
  }
}

