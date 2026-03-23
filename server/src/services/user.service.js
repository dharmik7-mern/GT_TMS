import AuthLookup from '../models/AuthLookup.js';
import { getTenantModels } from '../config/tenantDb.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { assertPasswordAllowed } from './settings.service.js';

export async function getMe({ companyId, userId }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const user = await User.findOne({ _id: userId, tenantId });
  return user;
}

export async function listUsers({ companyId }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const users = await User.find({ tenantId }).sort({ createdAt: -1 });
  return users;
}

export async function getUser({ companyId, id }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const user = await User.findOne({ _id: id, tenantId });
  return user;
}

export async function createUser({ companyId, workspaceId, actorRole, input }) {
  let tenantId = companyId;
  let targetWorkspaceId = workspaceId;
  const { User, Membership, Workspace } = getTenantModels();
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can create users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const requestedCompanyId = typeof input.companyId === 'string' ? input.companyId.trim() : '';
  if (actorRole === 'super_admin' && requestedCompanyId) {
    tenantId = requestedCompanyId;
    const workspace = await Workspace.findOne({ tenantId }).sort({ createdAt: 1 });
    if (!workspace) {
      const err = new Error('Selected company has no workspace configured');
      err.statusCode = 400;
      err.code = 'WORKSPACE_NOT_FOUND';
      throw err;
    }
    targetWorkspaceId = workspace._id;
  }

  const allowedRoles = actorRole === 'super_admin'
    ? ['super_admin', 'admin', 'manager', 'team_leader', 'team_member']
    : ['admin', 'manager', 'team_leader', 'team_member'];

  if (!allowedRoles.includes(input.role)) {
    const err = new Error('You are not allowed to create a user with this role');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }

  const email = input.email.trim().toLowerCase();
  const existingLookup = await AuthLookup.findOne({ email });
  if (existingLookup) {
    const err = new Error('A user with this email already exists');
    err.statusCode = 409;
    err.code = 'USER_EXISTS';
    throw err;
  }

  const existing = await User.findOne({ tenantId, email });
  if (existing) {
    const err = new Error('A user with this email already exists in this company');
    err.statusCode = 409;
    err.code = 'USER_EXISTS';
    throw err;
  }

  await assertPasswordAllowed(input.password);

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    tenantId,
    name: input.name.trim(),
    email,
    passwordHash,
    role: input.role,
    jobTitle: input.jobTitle?.trim() || '',
    department: input.department?.trim() || '',
    isActive: true,
    color: input.color?.trim() || '#3366ff',
  });

  await AuthLookup.updateOne(
    { email },
    { $set: { email, tenantId } },
    { upsert: true }
  );

  await Membership.updateOne(
    { tenantId, workspaceId: targetWorkspaceId, userId: user._id },
    { $setOnInsert: { role: input.role, status: 'active' } },
    { upsert: true }
  );

  return user;
}

export async function updateUser({ companyId, workspaceId, actorRole, userId, targetUserId, updates }) {
  const tenantId = companyId;
  const { User, Membership } = getTenantModels();
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can update users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  const user = await User.findOne({ _id: targetUserId, tenantId });
  if (!user) return null;

  if (String(user._id) === String(userId) && updates.role && updates.role !== user.role) {
    const err = new Error('You cannot change your own role');
    err.statusCode = 400;
    err.code = 'SELF_ROLE_CHANGE_BLOCKED';
    throw err;
  }

  const allowedRoles = actorRole === 'super_admin'
    ? ['super_admin', 'admin', 'manager', 'team_leader', 'team_member']
    : ['admin', 'manager', 'team_leader', 'team_member'];

  if (updates.role && !allowedRoles.includes(updates.role)) {
    const err = new Error('You are not allowed to assign this role');
    err.statusCode = 403;
    err.code = 'FORBIDDEN_ROLE';
    throw err;
  }

  if (typeof updates.email === 'string') {
    const email = updates.email.trim().toLowerCase();
    if (email !== user.email) {
      const existingLookup = await AuthLookup.findOne({ email });
      if (existingLookup) {
        const err = new Error('A user with this email already exists');
        err.statusCode = 409;
        err.code = 'USER_EXISTS';
        throw err;
      }

      await AuthLookup.deleteOne({ email: user.email });
      await AuthLookup.updateOne(
        { email },
        { $set: { email, tenantId } },
        { upsert: true }
      );
      user.email = email;
    }
  }

  if (typeof updates.name === 'string') user.name = updates.name.trim();
  if (typeof updates.role === 'string') user.role = updates.role;
  if (typeof updates.jobTitle === 'string') user.jobTitle = updates.jobTitle.trim();
  if (typeof updates.department === 'string') user.department = updates.department.trim();
  if (typeof updates.isActive === 'boolean') user.isActive = updates.isActive;
  if (typeof updates.color === 'string') user.color = updates.color.trim();

  await user.save();

  await Membership.updateMany(
    { tenantId, userId: user._id, ...(workspaceId ? { workspaceId } : {}) },
    {
      $set: {
        ...(updates.role ? { role: updates.role } : {}),
        ...(typeof updates.isActive === 'boolean' ? { status: updates.isActive ? 'active' : 'disabled' } : {}),
      },
    }
  );

  return user;
}

export async function deleteUser({ companyId, actorRole, userId, targetUserId }) {
  const tenantId = companyId;
  const { User, Membership } = getTenantModels();
  if (!['super_admin', 'admin'].includes(actorRole)) {
    const err = new Error('Only company admins can delete users');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (String(userId) === String(targetUserId)) {
    const err = new Error('You cannot delete your own account');
    err.statusCode = 400;
    err.code = 'SELF_DELETE_BLOCKED';
    throw err;
  }

  const user = await User.findOneAndDelete({ _id: targetUserId, tenantId });
  if (!user) return null;

  await Membership.deleteMany({ tenantId, userId: user._id });
  await AuthLookup.deleteOne({ email: user.email });
  return user;
}

export async function updateMe({ companyId, userId, updates }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const payload = {};

  if (typeof updates.name === 'string') payload.name = updates.name.trim();
  if (typeof updates.jobTitle === 'string') payload.jobTitle = updates.jobTitle.trim();
  if (typeof updates.department === 'string') payload.department = updates.department.trim();
  if (typeof updates.bio === 'string') payload.bio = updates.bio.trim();
  if (typeof updates.color === 'string') payload.color = updates.color.trim();

  const user = await User.findOneAndUpdate(
    { _id: userId, tenantId },
    { $set: payload },
    { new: true }
  );
  return user;
}

export async function updateMyPreferences({ companyId, userId, preferences }) {
  const tenantId = companyId;
  const { User } = getTenantModels();

  const setPayload = {};
  for (const [groupKey, groupValue] of Object.entries(preferences || {})) {
    if (!groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) continue;
    for (const [key, value] of Object.entries(groupValue)) {
      setPayload[`preferences.${groupKey}.${key}`] = value;
    }
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, tenantId },
    { $set: setPayload },
    { new: true }
  );
  return user;
}

export async function updateMyPassword({ companyId, userId, currentPassword, newPassword }) {
  const tenantId = companyId;
  const { User } = getTenantModels();
  const user = await User.findOne({ _id: userId, tenantId }).select('+passwordHash');
  if (!user) return null;

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 400;
    err.code = 'BAD_PASSWORD';
    throw err;
  }

  await assertPasswordAllowed(newPassword);
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  return true;
}

