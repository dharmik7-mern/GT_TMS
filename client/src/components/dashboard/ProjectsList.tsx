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
  const rows: Array<ProjectListItem | null> = loading ? Array.from({ length: 4 }, () => null) : projects;

  return (
    <div className="card h-full overflow-hidden border border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
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
      <div className="max-h-[300px] divide-y divide-surface-50 overflow-y-auto dark:divide-surface-800">
        {rows.map((project, idx) => (
          <motion.div
            key={project?.id || `skeleton-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx }}
            onClick={() => project?.id && onItemClick?.(project.id)}
            className={cn(
              'flex items-center gap-4 px-5 py-3.5',
              project ? 'cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50' : 'animate-pulse select-none'
            )}
          >
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: project?.color || '#e5e7eb' }}
            >
              {project?.name?.[0] || ''}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-surface-800 dark:text-surface-200">
                {project?.name || '...'}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {project ? (
                  <>
                    <ProgressBar
                      value={project.progress ?? 0}
                      size="sm"
                      color={getProgressColor(project.progress ?? 0)}
                      className="w-24"
                    />
                    <span className="text-xs text-surface-400">{project.progress ?? 0}%</span>
                  </>
                ) : (
                  <div className="h-2 w-24 rounded bg-surface-100 dark:bg-surface-800" />
                )}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              {project?.members && project.members.length ? (
                <AvatarGroup users={project.members} max={3} size="xs" />
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-surface-400">
                  <Users size={14} />
                  <span>{project ? '-' : ''}</span>
                </div>
              )}
              {project && (
                <div className="hidden text-right sm:block">
                  <p className="text-xs text-surface-500">
                    {project.completedTasksCount ?? 0}/{project.tasksCount ?? 0}
                  </p>
                  <p className="text-[11px] text-surface-400">tasks</p>
                </div>
              )}
              {project && <ArrowRight size={14} className="text-surface-300" />}
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
