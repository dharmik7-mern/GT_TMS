import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Crown,
  Edit3,
  FolderKanban,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { PROJECT_COLORS, STATUS_CONFIG } from '../../app/constants';
import { ColorPicker } from '../../components/ColorPicker';
import { UserAvatar, AvatarGroup } from '../../components/UserAvatar';
import { Modal } from '../../components/Modal';
import { ProgressBar, EmptyState } from '../../components/ui';
import type { Project, Task, Team, User } from '../../app/types';
import { teamsService } from '../../services/api';
import { emitSuccessToast } from '../../context/toastBus';

type TeamFormModalProps = {
  open: boolean;
  onClose: () => void;
  team?: Team | null;
  onSaved: (team: Team) => void;
};

type TeamMetrics = {
  members: User[];
  leaders: User[];
  teamProjects: Project[];
  teamTasks: Task[];
  doneTasks: number;
  activeTasks: number;
  progress: number;
  completionRate: number;
};

function getLinkedProjects(team: Team, projects: Project[]) {
  return projects.filter((project) => project.teamId === team.id || team.projectIds.includes(project.id));
}

function getTeamMetrics(team: Team, users: User[], projects: Project[], tasks: Task[]): TeamMetrics {
  const members = users.filter((user) => team.members.includes(user.id));
  const leaderIds = team.leaderIds?.length ? team.leaderIds : [team.leaderId];
  const leaders = users.filter((user) => leaderIds.includes(user.id));
  const teamProjects = getLinkedProjects(team, projects);
  const teamTasks = tasks.filter((task) => teamProjects.some((project) => project.id === task.projectId));
  const doneTasks = teamTasks.filter((task) => task.status === 'done').length;
  const activeTasks = teamTasks.filter((task) => task.status !== 'done').length;
  const progress = teamTasks.length ? Math.round((doneTasks / teamTasks.length) * 100) : 0;

  return {
    members,
    leaders,
    teamProjects,
    teamTasks,
    doneTasks,
    activeTasks,
    progress,
    completionRate: progress,
  };
}

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; tone?: string; onClick?: () => void }> = ({
  icon,
  label,
  value,
  tone = 'bg-surface-50 dark:bg-surface-900/60',
  onClick,
}) => (
  <div
    onClick={onClick}
    className={cn(
      'rounded-2xl border border-surface-100 p-4 dark:border-surface-800 transition-all duration-200',
      tone,
      onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
    )}
  >
    <div className="flex items-center gap-2 text-surface-500 dark:text-surface-400">
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-[0.18em]">{label}</span>
    </div>
    <p className="mt-3 text-2xl font-display font-semibold text-surface-900 dark:text-white">{value}</p>
  </div>
);

const TeamCard: React.FC<{
  team: Team;
  onOpen: (teamId: string) => void;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
}> = ({ team, onOpen, onEdit, onDelete }) => {
  const { projects, tasks, users } = useAppStore();
  const { members, leaders, teamProjects, activeTasks, progress } = getTeamMetrics(team, users, projects, tasks);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
      <button type="button" onClick={() => onOpen(team.id)} className="w-full p-5 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-display font-bold text-base flex-shrink-0"
              style={{ backgroundColor: team.color }}
            >
              {team.name[0]}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white truncate">{team.name}</h3>
              <p className="mt-1 text-xs text-surface-400 line-clamp-2">{team.description || 'No description yet.'}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-surface-400">{formatDate(team.createdAt, 'MMM d')}</span>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-50 px-3 py-2.5 dark:bg-surface-800/60">
          <Crown size={13} className="text-amber-500 flex-shrink-0" />
          <span className="text-xs text-surface-600 dark:text-surface-300 truncate">
            {leaders.length ? leaders.map((leader) => leader.name).join(', ') : 'No leader assigned'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-surface-50 px-3 py-3 text-center dark:bg-surface-800/60">
            <p className="text-lg font-semibold text-surface-900 dark:text-white">{members.length}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-surface-400">Members</p>
          </div>
          <div className="rounded-2xl bg-surface-50 px-3 py-3 text-center dark:bg-surface-800/60">
            <p className="text-lg font-semibold text-surface-900 dark:text-white">{teamProjects.length}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-surface-400">Projects</p>
          </div>
          <div className="rounded-2xl bg-surface-50 px-3 py-3 text-center dark:bg-surface-800/60">
            <p className="text-lg font-semibold text-surface-900 dark:text-white">{activeTasks}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-surface-400">Open Tasks</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-surface-500">
            <span>Delivery health</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} color={team.color} size="md" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <AvatarGroup users={members} max={4} size="xs" />
          <span className="text-xs text-surface-400">Open workspace</span>
        </div>
      </button>

      <div className="border-t border-surface-100 px-5 py-3 dark:border-surface-800">
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onEdit(team)} className="btn-ghost btn-sm"><Edit3 size={14} />Edit</button>
          <button type="button" onClick={() => onDelete(team)} className="btn-ghost btn-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={14} />Delete</button>
        </div>
      </div>
    </motion.div>
  );
};

const TeamFormModal: React.FC<TeamFormModalProps> = ({ open, onClose, team, onSaved }) => {
  const { users, projects, teams, addTeam, updateTeam } = useAppStore();
  const isEditing = Boolean(team);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [selectedLeaderIds, setSelectedLeaderIds] = useState<string[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const usedTeamColors = teams.filter((existingTeam) => existingTeam.id !== team?.id).map((existingTeam) => existingTeam.color.toLowerCase());
  const firstAvailableColor = PROJECT_COLORS.find((candidate) => !usedTeamColors.includes(candidate.toLowerCase())) || PROJECT_COLORS[0];

  useEffect(() => {
    if (!open) return;
    const linkedProjectIds = team ? getLinkedProjects(team, projects).map((project) => project.id) : [];
    setName(team?.name || '');
    setDescription(team?.description || '');
    setColor(team?.color || firstAvailableColor);
    setSelectedLeaderIds(team?.leaderIds?.length ? team.leaderIds : team?.leaderId ? [team.leaderId] : []);
    setSelectedMembers(team?.members || []);
    setSelectedProjects(linkedProjectIds);
    setLeaderSearch('');
    setMemberSearch('');
    setProjectSearch('');
  }, [firstAvailableColor, open, projects, team]);

  const availableLeaderUsers = users.filter((user) =>
    `${user.name} ${user.email} ${user.jobTitle || ''}`.toLowerCase().includes(leaderSearch.toLowerCase()) &&
    !selectedMembers.includes(user.id)
  );
  const availableMemberUsers = users.filter((user) =>
    `${user.name} ${user.email} ${user.jobTitle || ''}`.toLowerCase().includes(memberSearch.toLowerCase()) &&
    !selectedLeaderIds.includes(user.id)
  );
  const filteredProjects = projects.filter((project) =>
    `${project.name} ${project.description || ''} ${project.department || ''}`.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const toggleLeader = (leaderId: string, checked: boolean) => {
    setSelectedLeaderIds((prev) => checked ? Array.from(new Set([...prev, leaderId])) : prev.filter((id) => id !== leaderId));
    if (checked) setSelectedMembers((prev) => prev.filter((id) => id !== leaderId));
  };

  const toggleMember = (memberId: string, checked: boolean) => {
    setSelectedMembers((prev) => checked ? Array.from(new Set([...prev, memberId])) : prev.filter((id) => id !== memberId));
    if (checked) setSelectedLeaderIds((prev) => prev.filter((id) => id !== memberId));
  };

  const toggleProject = (projectId: string, checked: boolean) => {
    setSelectedProjects((prev) => checked ? Array.from(new Set([...prev, projectId])) : prev.filter((id) => id !== projectId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedLeaderIds.length) return;
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
        leaderId: selectedLeaderIds[0],
        leaderIds: selectedLeaderIds,
        members: Array.from(new Set([...selectedMembers, ...selectedLeaderIds])),
        projectIds: selectedProjects,
      };
      const response = isEditing && team ? await teamsService.update(team.id, payload) : await teamsService.create(payload);
      const savedTeam = response.data.data ?? response.data;
      if (isEditing && team) {
        updateTeam(team.id, savedTeam);
        emitSuccessToast('Team updated successfully.');
      } else {
        addTeam(savedTeam);
        emitSuccessToast('Team created successfully.');
      }
      onSaved(savedTeam);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Team' : 'Create Team'} size="xl">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <label className="label">Team name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Delivery Excellence" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input h-auto min-h-[110px] resize-none py-3" rows={4} />
            </div>
            <div>
              <label className="label">Leaders *</label>
              <input value={leaderSearch} onChange={(e) => setLeaderSearch(e.target.value)} className="input h-9 mb-2" placeholder="Search leaders..." />
              <div className="max-h-40 overflow-y-auto rounded-2xl border border-surface-100 p-2 space-y-1.5 dark:border-surface-800">
                {availableLeaderUsers.map((leader) => (
                  <label key={leader.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800">
                    <input type="checkbox" checked={selectedLeaderIds.includes(leader.id)} onChange={(e) => toggleLeader(leader.id, e.target.checked)} />
                    <UserAvatar name={leader.name} color={leader.color} size="sm" isOnline={leader.isActive} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{leader.name}</p>
                      <p className="truncate text-xs text-surface-400">{leader.jobTitle || leader.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Members</label>
              <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="input h-9 mb-2" placeholder="Search members..." />
              <div className="max-h-44 overflow-y-auto rounded-2xl border border-surface-100 p-2 space-y-1.5 dark:border-surface-800">
                {availableMemberUsers.map((member) => (
                  <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800">
                    <input type="checkbox" checked={selectedMembers.includes(member.id)} onChange={(e) => toggleMember(member.id, e.target.checked)} />
                    <UserAvatar name={member.name} color={member.color} size="sm" isOnline={member.isActive} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{member.name}</p>
                      <p className="truncate text-xs text-surface-400">{member.jobTitle || member.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="label">Team color</label>
              <ColorPicker
                value={color}
                onChange={setColor}
                palette={PROJECT_COLORS}
                disallowedColors={usedTeamColors}
                helperText="Choose a unique color for this team workspace."
              />
            </div>
            <div className="rounded-2xl border border-surface-100 p-4 dark:border-surface-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="label mb-0">Linked Projects</p>
                  <p className="text-xs text-surface-400">Attach projects so the team has a proper workspace view.</p>
                </div>
                <span className="badge-gray text-xs">{selectedProjects.length} linked</span>
              </div>
              <input value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} className="input h-9 mb-2" placeholder="Search projects..." />
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-surface-100 p-2 space-y-1.5 dark:border-surface-800">
                {filteredProjects.map((project) => (
                  <label key={project.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800">
                    <input type="checkbox" checked={selectedProjects.includes(project.id)} onChange={(e) => toggleProject(project.id, e.target.checked)} />
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{project.name}</p>
                      <p className="truncate text-xs text-surface-400">{project.department || 'General'} department</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-surface-100 pt-5 dark:border-surface-800">
          <button type="button" onClick={onClose} className="btn-ghost btn-md">Cancel</button>
          <button type="submit" disabled={loading || !name.trim() || !selectedLeaderIds.length} className="btn-primary btn-md min-w-[140px]">
            {loading ? (isEditing ? 'Saving...' : 'Creating...') : isEditing ? 'Save Team' : 'Create Team'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const TeamDetailModal: React.FC<{
  team: Team | null;
  onClose: () => void;
  onEdit: (team: Team) => void;
  onDelete: (team: Team) => void;
}> = ({ team, onClose, onEdit, onDelete }) => {
  const { projects, tasks, users } = useAppStore();
  if (!team) return null;

  const { members, leaders, teamProjects, teamTasks, doneTasks, activeTasks, completionRate } = getTeamMetrics(team, users, projects, tasks);
  const statusBreakdown = Object.entries(STATUS_CONFIG)
    .map(([status, config]) => ({
      status,
      label: config.label,
      color: config.color,
      count: teamTasks.filter((task) => task.status === status).length,
    }))
    .filter((item) => item.count > 0);

  return (
    <Modal open={!!team} onClose={onClose} size="xl" showClose={false}>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-3xl flex items-center justify-center text-white font-display font-bold text-xl flex-shrink-0" style={{ backgroundColor: team.color }}>
              {team.name[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-semibold text-2xl text-surface-900 dark:text-white">{team.name}</h2>
                <span className="badge-gray text-[10px]">Team Workspace</span>
              </div>
              <p className="mt-1 text-sm text-surface-400">{team.description || 'No team description has been added yet.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-surface-400">
                <span className="flex items-center gap-1.5"><Calendar size={12} /> Created {formatDate(team.createdAt)}</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> {leaders.length} leader{leaders.length === 1 ? '' : 's'}</span>
                <span className="flex items-center gap-1.5"><Briefcase size={12} /> {teamProjects.length} linked project{teamProjects.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(team)} className="btn-secondary btn-sm"><Edit3 size={14} />Edit</button>
            <button type="button" onClick={() => onDelete(team)} className="btn-ghost btn-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={14} />Delete</button>
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">Close</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard icon={<Users size={14} />} label="Members" value={String(members.length)} />
          <MetricCard icon={<FolderKanban size={14} />} label="Projects" value={String(teamProjects.length)} />
          <MetricCard icon={<CheckCircle2 size={14} />} label="Completed Tasks" value={String(doneTasks)} />
          <MetricCard icon={<ShieldCheck size={14} />} label="Delivery Health" value={`${completionRate}%`} tone="bg-emerald-50 dark:bg-emerald-950/20" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-surface-100 p-5 dark:border-surface-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white">Leads & Members</h3>
              <AvatarGroup users={members} max={5} size="xs" />
            </div>
            <div className="mt-4 space-y-2">
              {leaders.map((leader) => (
                <div key={leader.id} className="flex items-center gap-3 rounded-2xl bg-surface-50 px-3 py-3 dark:bg-surface-800/60">
                  <UserAvatar name={leader.name} color={leader.color} size="sm" isOnline={leader.isActive} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{leader.name}</p>
                    <p className="truncate text-xs text-surface-400">{leader.jobTitle || leader.email}</p>
                  </div>
                  <span className="badge text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">Leader</span>
                </div>
              ))}
              {members.map((member) => {
                const memberTasks = teamTasks.filter((task) => task.assigneeIds.includes(member.id));
                const memberDoneTasks = memberTasks.filter((task) => task.status === 'done').length;
                return (
                  <div key={member.id} className="rounded-2xl border border-surface-100 px-3 py-3 dark:border-surface-800">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={member.name} color={member.color} size="sm" isOnline={member.isActive} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{member.name}</p>
                        <p className="truncate text-xs text-surface-400">{member.jobTitle || member.email}</p>
                      </div>
                      <span className="text-xs text-surface-400">{memberDoneTasks}/{memberTasks.length} done</span>
                    </div>
                    <ProgressBar value={memberDoneTasks} max={memberTasks.length || 1} size="sm" color={member.color || team.color} className="mt-3" />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-surface-100 p-5 dark:border-surface-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-semibold text-surface-900 dark:text-white">Workload & Projects</h3>
              <span className="text-xs text-surface-400">{activeTasks} open items</span>
            </div>
            <div className="mt-4 space-y-3">
              {statusBreakdown.map((item) => (
                <div key={item.status} className="rounded-2xl bg-surface-50 px-3 py-3 dark:bg-surface-800/60">
                  <div className="mb-2 flex items-center justify-between text-xs text-surface-500">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                  <ProgressBar value={item.count} max={teamTasks.length || 1} size="sm" color={item.color} />
                </div>
              ))}
              {teamProjects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-surface-100 px-4 py-4 dark:border-surface-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: project.color }}>
                      {project.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-surface-900 dark:text-white">{project.name}</p>
                        <span className="text-xs text-surface-400">{project.progress}%</span>
                      </div>
                      <p className="mt-1 text-xs text-surface-400">{project.department || 'General'} department</p>
                      <div className="mt-3"><ProgressBar value={project.progress} color={project.color} size="sm" /></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
};

const UserListModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  usersList: User[];
}> = ({ open, onClose, title, usersList }) => {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
        {usersList.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-4">No users found.</p>
        ) : (
          usersList.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-surface-100 p-3 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/60 transition-colors">
              <UserAvatar name={u.name} color={u.color} size="sm" isOnline={u.isActive} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">{u.name}</p>
                <p className="truncate text-xs text-surface-400">{u.jobTitle || u.email}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

export const TeamsPage: React.FC = () => {
  const { teams, users, projects, tasks, deleteTeam } = useAppStore();
  const navigate = useNavigate();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState('');
  const [listModalConfig, setListModalConfig] = useState<{ open: boolean; title: string; list: User[] }>({ open: false, title: '', list: [] });

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) || null;

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((team) => {
      const metrics = getTeamMetrics(team, users, projects, tasks);
      return [team.name, team.description, ...metrics.members.map((member) => member.name), ...metrics.teamProjects.map((project) => project.name)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [projects, search, tasks, teams, users]);

  const globalStats = useMemo(() => {
    const linkedProjectIds = new Set(teams.flatMap((team) => getLinkedProjects(team, projects).map((project) => project.id)));
    const linkedTaskCount = tasks.filter((task) => linkedProjectIds.has(task.projectId)).length;
    const completedTaskCount = tasks.filter((task) => linkedProjectIds.has(task.projectId) && task.status === 'done').length;
    const leaderIds = new Set(teams.flatMap((team) => (team.leaderIds?.length ? team.leaderIds : [team.leaderId])));
    const memberIds = new Set(teams.flatMap((team) => team.members));

    return {
      teamsCount: teams.length,
      uniqueMembers: users.filter((u) => memberIds.has(u.id)),
      uniqueLeaders: users.filter((u) => leaderIds.has(u.id)),
      linkedProjects: linkedProjectIds.size,
      taskCompletion: linkedTaskCount ? Math.round((completedTaskCount / linkedTaskCount) * 100) : 0,
    };
  }, [projects, tasks, teams, users]);

  const openCreate = () => {
    setEditingTeam(null);
    setShowForm(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setShowForm(true);
  };

  const handleDelete = async (team: Team) => {
    const confirmed = window.confirm(`Delete "${team.name}"? Linked projects will be detached from this team.`);
    if (!confirmed) return;
    await teamsService.delete(team.id);
    deleteTeam(team.id);
    if (selectedTeamId === team.id) setSelectedTeamId(null);
    emitSuccessToast('Team deleted successfully.');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 -mt-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end mb-2">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:min-w-[260px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams..." className="input pl-9 w-full" />
          </div>
          <button onClick={openCreate} className="btn-primary btn-md whitespace-nowrap"><Plus size={14} />Create Team</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard onClick={() => setSearch('')} icon={<Users size={14} />} label="Teams" value={String(globalStats.teamsCount)} />
        <MetricCard onClick={() => setListModalConfig({ open: true, title: 'All Team Leads', list: globalStats.uniqueLeaders })} icon={<ShieldCheck size={14} />} label="Leads" value={String(globalStats.uniqueLeaders.length)} />
        <MetricCard onClick={() => setListModalConfig({ open: true, title: 'All Team Members', list: globalStats.uniqueMembers })} icon={<Users size={14} />} label="Members" value={String(globalStats.uniqueMembers.length)} />
        <MetricCard onClick={() => navigate('/projects')} icon={<FolderKanban size={14} />} label="Linked Projects" value={String(globalStats.linkedProjects)} />
        <MetricCard onClick={() => navigate('/tasks')} icon={<CheckCircle2 size={14} />} label="Completion" value={`${globalStats.taskCompletion}%`} tone="bg-emerald-50 dark:bg-emerald-950/20" />
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No teams yet"
          description="Get started by creating a new team."
          action={<button onClick={openCreate} className="btn-primary btn-md"><Plus size={14} /> Create Team</button>}
        />
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="No teams match your search"
          description="Try a team name, member name, or linked project."
          action={<button onClick={() => setSearch('')} className="btn-secondary btn-md">Clear Search</button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard key={team.id} team={team} onOpen={setSelectedTeamId} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <TeamDetailModal
        team={selectedTeam}
        onClose={() => setSelectedTeamId(null)}
        onEdit={(team) => {
          setSelectedTeamId(null);
          openEdit(team);
        }}
        onDelete={handleDelete}
      />

      <TeamFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTeam(null);
        }}
        team={editingTeam}
        onSaved={(team) => {
          setShowForm(false);
          setEditingTeam(null);
          setSelectedTeamId(team.id);
        }}
      />

      <UserListModal 
        open={listModalConfig.open} 
        onClose={() => setListModalConfig(prev => ({ ...prev, open: false }))} 
        title={listModalConfig.title} 
        usersList={listModalConfig.list} 
      />
    </div>
  );
};

export default TeamsPage;
