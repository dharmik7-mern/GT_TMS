import type { Role } from '../app/types';

const ROLE_MAP: Record<string, Role> = {
  super_admin: 'super_admin',
  admin: 'admin',
  company_admin: 'admin',
  workspace_admin: 'admin',
  manager: 'manager',
  team_lead: 'team_leader',
  team_leader: 'team_leader',
  employee: 'team_member',
  member: 'team_member',
  user: 'team_member',
  team_member: 'team_member',
};

export function mapGtOneRole(rawRole: unknown): Role {
  const key = String(rawRole || '').trim().toLowerCase();
  return ROLE_MAP[key] || 'team_member';
}
