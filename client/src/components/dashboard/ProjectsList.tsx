import React from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { AvatarGroup } from '../UserAvatar';
import { ProgressBar } from '../ui';
import { cn, getProgressColor } from '../../utils/helpers';

export type ProjectListItem = {
  id: string;
  name: string;
  progress?: number;
  tasksCount?: number;
  completedTasksCount?: number;
  color?: string;
  members?: { id: string; avatar?: string; name: string }[];
  meta?: string;
};

interface Props {
  title?: string;
  projects: ProjectListItem[];
  loading?: boolean;
  onItemClick?: (id: string) => void;
  cta?: { label: string; onClick: () => void };
}

export const ProjectsList: React.FC<Props> = ({ title = 'Active Projects', projects, loading, onItemClick, cta }) => {
  const skeletonRows = Array.from({ length: 4 });
  return (
    <div className="card overflow-hidden h-full border border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="font-display font-semibold text-surface-900 dark:text-white">{title}</h3>
          <p className="text-xs text-surface-400">Clickable rows</p>
        </div>
        {cta && (
          <button onClick={cta.onClick} className="btn-ghost btn-sm text-xs text-brand-600 dark:text-brand-400">
            {cta.label} <ArrowRight size={12} />
          </button>
        )}
      </div>
      <div className="divide-y divide-surface-50 dark:divide-surface-800 max-h-[300px] overflow-y-auto">
        {(loading ? skeletonRows : projects).map((project, idx) => (
          <motion.div
            key={loading ? `skeleton-${idx}` : project.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx }}
            onClick={() => !loading && project.id && onItemClick?.(project.id)}
            className={cn(
              'flex items-center gap-4 px-5 py-3.5',
              !loading && 'hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors',
              loading && 'animate-pulse select-none'
            )}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: loading ? '#e5e7eb' : project.color || '#3366ff' }}
            >
              {loading ? '' : (project.name || '?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                {loading ? '···' : project.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {loading ? (
                  <div className="h-2 w-24 rounded bg-surface-100 dark:bg-surface-800" />
                ) : (
                  <>
                    <ProgressBar value={project.progress ?? 0} size="sm" color={getProgressColor(project.progress ?? 0)} className="w-24" />
                    <span className="text-xs text-surface-400">{project.progress ?? 0}%</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {loading ? (
                <div className="h-6 w-16 rounded bg-surface-100 dark:bg-surface-800" />
              ) : project.members && project.members.length ? (
                <AvatarGroup users={project.members} max={3} size="xs" />
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-surface-400">
                  <Users size={14} />
                  <span>—</span>
                </div>
              )}
              {!loading && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-surface-500">{project.completedTasksCount ?? 0}/{project.tasksCount ?? 0}</p>
                  <p className="text-[11px] text-surface-400">tasks</p>
                </div>
              )}
              {!loading && <ArrowRight size={14} className="text-surface-300" />}
            </div>
          </motion.div>
        ))}
        {!loading && projects.length === 0 && (
          <div className="px-5 py-4 text-sm text-surface-400">No projects found.</div>
        )}
      </div>
    </div>
  );
};

export default ProjectsList;
