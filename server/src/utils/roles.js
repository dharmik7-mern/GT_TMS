const PMS_ROLES = new Set(['super_admin', 'admin', 'manager', 'team_leader', 'team_member']);

const ROLE_ALIASES = new Map([
  ['super_admin', 'super_admin'],
  ['admin', 'admin'],
  ['company_admin', 'admin'],
  ['workspace_admin', 'admin'],
  ['manager', 'manager'],
  ['team_lead', 'team_leader'],
  ['team_leader', 'team_leader'],
  ['employee', 'team_member'],
  ['member', 'team_member'],
  ['user', 'team_member'],
  ['team_member', 'team_member'],
]);

export function normalizeRole(rawRole) {
  const value = String(rawRole || '').trim().toLowerCase();
  const mapped = ROLE_ALIASES.get(value) || value;
  if (PMS_ROLES.has(mapped)) return mapped;
  return 'team_member';
}

export function normalizeRoles(roles = []) {
  return roles.map((role) => normalizeRole(role));
}
