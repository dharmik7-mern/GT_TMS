import Company from '../models/Company.js';
import AuthLookup from '../models/AuthLookup.js';
import { buildTenantDatabaseName, getTenantModels } from '../config/tenantDb.js';
import { hashPassword } from '../utils/password.js';
import { formatGeneratedId, getCompanyIdConfig } from '../services/settings.service.js';
import { normalizeOrganizationId, resolveOrganizationId } from '../utils/organizationId.js';

async function reserveOrganizationId() {
  const config = await getCompanyIdConfig();
  let nextSequence = config.nextSequence;
  let organizationId = formatGeneratedId(config, nextSequence);

  if (!normalizeOrganizationId(organizationId)) {
    const err = new Error(
      '[seed] Failed to generate organizationId from system settings. Configure idGeneration.company settings or set DEFAULT_ORGANIZATION_ID in .env.'
    );
    err.code = 'SEED_MISSING_ORGANIZATION_ID';
    throw err;
  }

  while (await Company.exists({ organizationId })) {
    nextSequence += 1;
    organizationId = formatGeneratedId(config, nextSequence);
    if (!normalizeOrganizationId(organizationId)) {
      const err = new Error(
        '[seed] Failed to generate next organizationId from system settings. Configure idGeneration.company settings or set DEFAULT_ORGANIZATION_ID in .env.'
      );
      err.code = 'SEED_MISSING_ORGANIZATION_ID';
      throw err;
    }
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
    const resolved = await resolveOrganizationId({
      envOrganizationId: process.env.DEFAULT_ORGANIZATION_ID,
      contextLabel: 'ensureBootstrapSuperAdmin',
      forCreate: true,
      contactEmail: superAdminEmail,
      failOnMissing: false,
    });
    const organizationId = resolved.organizationId;
    if (!organizationId) {
      return;
    }

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

  // Deduplicate primary bootstrap admin
  await User.deleteMany({
    _id: { $ne: superAdmin._id },
    email: superAdminEmail,
    tenantId: company._id
  });

  // Force update primary superAdmin password to match env
  const primaryPasswordHash = await hashPassword(superAdminPassword);
  await User.updateOne({ _id: superAdmin._id }, { $set: { passwordHash: primaryPasswordHash, isActive: true } });
  console.log(`[Seed] Forced password reset and deduplication for primary admin: ${superAdminEmail}`);

  await Membership.updateOne(
    { tenantId: company._id, workspaceId: workspace._id, userId: superAdmin._id },
    { $set: { role: 'super_admin', status: 'active' } },
    { upsert: true }
  );

  // Force drop the problematic index if it exists, to allow partial index creation
  try {
    const indexes = await User.collection.indexes();
    if (indexes.some(idx => idx.name === 'tenantId_1_employeeId_1')) {
      await User.collection.dropIndex('tenantId_1_employeeId_1');
      console.log(`[Seed] Dropped problematic unique index for users to allow partial rebuild.`);
    }
  } catch (err) {
    console.warn(`[Seed] Could not drop user index (might not exist):`, err.message);
  }

  // ─── Ensure User's specific account is also bootstrapped if needed ───────
  const userEmail = 'ivaharpal@gmail.com';
  let secondAdmin = await User.findOne({ tenantId: company._id, email: userEmail }).select('+passwordHash');
  if (!secondAdmin) {
    const passwordHash = await hashPassword(superAdminPassword);
    secondAdmin = await User.create({
      tenantId: company._id,
      name: 'Iva Harpal',
      email: userEmail,
      passwordHash,
      role: 'super_admin',
      isActive: true,
      color: '#3366ff',
    });
    console.log(`[Seed] Bootstrapped second admin: ${userEmail}`);
  } else {
    // Deduplicate secondary admin
    await User.deleteMany({
      _id: { $ne: secondAdmin._id },
      email: userEmail,
      tenantId: company._id
    });
    // Force update password and role
    const passwordHash = await hashPassword(superAdminPassword);
    await User.updateOne({ _id: secondAdmin._id }, { $set: { passwordHash, isActive: true, role: 'super_admin' } });
    console.log(`[Seed] Forced password reset and deduplication for: ${userEmail}`);
  }

  // Ensure AuthLookup exists for them
  await AuthLookup.updateOne(
    { email: userEmail },
    { $set: { email: userEmail, tenantId: company._id } },
    { upsert: true }
  );
}

export async function ensureSystemTestTenant() {
  const companyCode = 'TEST001';
  const companyEmail = 'test@gmail.com';
  const companyName = 'Test';
  const testPassword = 'Test@1234';
  const testUserName = 'Test User';
  const testWorkspaceSlug = 'test';
  const testEmployeeId = 'TEST001';

  let company = await Company.findOne({
    $or: [
      { organizationId: companyCode },
      { email: companyEmail },
    ],
  });

  if (!company) {
    company = await Company.create({
      organizationId: companyCode,
      name: companyName,
      email: companyEmail,
      databaseName: buildTenantDatabaseName({ companyName, organizationId: companyCode }),
      status: 'active',
      color: '#0f766e',
      systemFlags: {
        isSystemTestTenant: true,
        billingExempt: true,
        moduleValidationExempt: true,
      },
    });
  } else {
    await Company.updateOne(
      { _id: company._id },
      {
        $set: {
          organizationId: companyCode,
          name: companyName,
          email: companyEmail,
          status: 'active',
          color: company.color || '#0f766e',
          systemFlags: {
            ...(company.systemFlags?.toObject?.() || company.systemFlags || {}),
            isSystemTestTenant: true,
            billingExempt: true,
            moduleValidationExempt: true,
          },
        },
      }
    );
    company = await Company.findById(company._id);
  }

  const { User, Workspace, Membership } = await getTenantModels(company._id);
  const passwordHash = await hashPassword(testPassword);

  await AuthLookup.updateOne(
    { email: companyEmail },
    { $set: { email: companyEmail, tenantId: company._id } },
    { upsert: true }
  );

  let testUser = await User.findOne({ tenantId: company._id, email: companyEmail }).select('+passwordHash');
  if (!testUser) {
    testUser = await User.findOne({
      email: companyEmail,
      $or: [
        { tenantId: { $exists: false } },
        { tenantId: null },
        { companyId: company._id },
      ],
    }).select('+passwordHash');

    if (testUser) {
      await User.updateOne(
        { _id: testUser._id },
        { $set: { tenantId: company._id }, $unset: { companyId: '' } }
      );
      testUser.tenantId = company._id;
    }
  }

  if (!testUser) {
    testUser = await User.create({
      tenantId: company._id,
      name: testUserName,
      email: companyEmail,
      employeeId: testEmployeeId,
      passwordHash,
      role: 'admin',
      jobTitle: 'Testing Account',
      department: 'QA',
      isActive: true,
      color: '#0f766e',
    });
  } else {
    await User.updateOne(
      { _id: testUser._id },
      {
        $set: {
          tenantId: company._id,
          name: testUserName,
          email: companyEmail,
          employeeId: testEmployeeId,
          passwordHash,
          role: 'admin',
          jobTitle: 'Testing Account',
          department: 'QA',
          isActive: true,
          color: '#0f766e',
        },
        $unset: { companyId: '' },
      }
    );
    testUser = await User.findById(testUser._id).select('+passwordHash');
  }

  let workspace = await Workspace.findOne({ tenantId: company._id, slug: testWorkspaceSlug });
  if (!workspace) {
    workspace = await Workspace.findOne({ tenantId: company._id }).sort({ createdAt: 1 });
  }

  if (!workspace) {
    workspace = await Workspace.create({
      tenantId: company._id,
      name: companyName,
      slug: testWorkspaceSlug,
      plan: 'enterprise',
      ownerId: testUser._id,
      settings: {
        permissions: {},
        security: {
          strongPasswords: false,
        },
      },
    });
  } else {
    await Workspace.updateOne(
      { _id: workspace._id },
      {
        $set: {
          tenantId: company._id,
          name: companyName,
          slug: workspace.slug || testWorkspaceSlug,
          plan: 'enterprise',
          ownerId: testUser._id,
        },
        $unset: { companyId: '' },
      }
    );
    workspace = await Workspace.findById(workspace._id);
  }

  await Membership.updateOne(
    { tenantId: company._id, workspaceId: workspace._id, userId: testUser._id },
    { $set: { role: 'admin', status: 'active' }, $unset: { companyId: '' } },
    { upsert: true }
  );
}

export async function ensureDevSeed() {
  if (process.env.NODE_ENV === 'production') return;
  const superAdminEmail = 'gitakshmi@gmail.com';
  const superAdminName = 'Dhiren Makwana';

  let company = await Company.findOne({ email: superAdminEmail });
  if (!company) {
    const resolved = await resolveOrganizationId({
      envOrganizationId: process.env.DEFAULT_ORGANIZATION_ID,
      contextLabel: 'ensureDevSeed',
      forCreate: true,
      contactEmail: superAdminEmail,
      failOnMissing: false,
      // Keep generated fallback for dev seed backward compatibility.
      getGeneratedOrganizationId: reserveOrganizationId,
    });
    const organizationId = resolved.organizationId;
    if (!organizationId) {
      return;
    }

    company = await Company.create({
      organizationId,
      name: 'Gitakshmi Technologies',
      email: superAdminEmail,
      databaseName: buildTenantDatabaseName({ companyName: 'Gitakshmi Technologies', organizationId }),
      status: 'active',
      color: '#3366ff',
    });
  }

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

