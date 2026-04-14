import Company from '../models/Company.js';

export function normalizeOrganizationId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function isValidOrganizationId(value) {
  const normalized = normalizeOrganizationId(value);
  if (!normalized) return false;
  if (normalized.length > 80) return false;
  return true;
}

async function resolveFromAuthContext(authContext) {
  if (!authContext || typeof authContext !== 'object') return null;

  const direct = normalizeOrganizationId(
    authContext.organizationId ||
    authContext.tenantId ||
    authContext?.user?.organizationId ||
    authContext?.user?.tenantId
  );
  if (direct) return direct;

  const companyId = authContext.companyId || authContext?.user?.companyId;
  if (!companyId) return null;

  try {
    const company = await Company.findById(companyId).select('organizationId').lean();
    return normalizeOrganizationId(company?.organizationId);
  } catch {
    return null;
  }
}

async function isUsableForCreate({ organizationId, contactEmail, source, contextLabel, logger }) {
  const existing = await Company.findOne({ organizationId }).select('_id email').lean();
  if (!existing) return true;

  const normalizedEmail = String(contactEmail || '').trim().toLowerCase();
  if (normalizedEmail && String(existing.email || '').toLowerCase() === normalizedEmail) {
    return true;
  }

  logger.error(
    `[org-id] ${contextLabel}: ${source} organizationId "${organizationId}" is already used by ${existing.email || existing._id}.`
  );
  return false;
}

/**
 * Resolve organizationId with fallback order:
 * 1) explicit payload field
 * 2) authenticated user context
 * 3) DEFAULT_ORGANIZATION_ID env
 * 4) optional generated fallback (for backward compatibility)
 */
export async function resolveOrganizationId({
  payloadOrganizationId,
  authContext,
  envOrganizationId = process.env.DEFAULT_ORGANIZATION_ID,
  getGeneratedOrganizationId,
  forCreate = false,
  contactEmail,
  contextLabel = 'organizationId',
  failOnMissing = true,
  logger = console,
} = {}) {
  const candidates = [
    { source: 'payload', value: normalizeOrganizationId(payloadOrganizationId) },
    { source: 'auth_context', value: await resolveFromAuthContext(authContext) },
    { source: 'env_DEFAULT_ORGANIZATION_ID', value: normalizeOrganizationId(envOrganizationId) },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    if (!forCreate || await isUsableForCreate({
      organizationId: candidate.value,
      contactEmail,
      source: candidate.source,
      contextLabel,
      logger,
    })) {
      return { organizationId: candidate.value, source: candidate.source };
    }
  }

  if (typeof getGeneratedOrganizationId === 'function') {
    const generated = normalizeOrganizationId(await getGeneratedOrganizationId());
    if (generated) {
      if (!forCreate || await isUsableForCreate({
        organizationId: generated,
        contactEmail,
        source: 'generated',
        contextLabel,
        logger,
      })) {
        return { organizationId: generated, source: 'generated' };
      }
    }
  }

  const message =
    'Missing organizationId. Set DEFAULT_ORGANIZATION_ID in server/.env or pass organizationId in payload.';

  if (failOnMissing) {
    const err = new Error(message);
    err.code = 'ORGANIZATION_ID_REQUIRED';
    err.statusCode = 400;
    throw err;
  }

  logger.error(message);
  return { organizationId: null, source: 'missing' };
}
