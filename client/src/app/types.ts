export type Role = 'super_admin' | 'admin' | 'manager' | 'team_leader' | 'team_member';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'scheduled'
  | 'in_progress'
  | 'in_review'
  | 'blocked'
  | 'done';
export type TaskType = 'operational' | 'design' | 'important';

export interface TaskSubtask {
  id: string;
  title: string;
  isCompleted: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}
export type QuickTaskStatus = 'todo' | 'in_progress' | 'done';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type CompletionReviewStatus = 'pending' | 'approved' | 'changes_requested';

export interface CompletionReview {
  completedAt?: string;
  completedBy?: string;
  completionRemark: string;
  reviewStatus: CompletionReviewStatus;
  rating?: number;
  reviewRemark: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface PerformanceSummary {
  assignedTasks: number;
  completedTasks: number;
  approvedTasks: number;
  pendingReviewTasks: number;
  changesRequestedTasks: number;
  overdueOpenTasks: number;
  averageRating: number;
  completionRate: number;
  approvalRate: number;
  onTimeRate: number;
  performanceScore: number;
  activeProjects: number;
}

export interface PerformanceTrendPoint {
  month: string;
  completed: number;
  approved: number;
  averageRating: number;
}

export interface PerformanceEvaluation {
  id: string;
  type: 'project_task' | 'quick_task';
  title: string;
  projectId?: string;
  rating?: number;
  reviewRemark: string;
  reviewedAt?: string;
  completedAt?: string;
}

export interface UserPerformance {
  userId: string;
  summary: PerformanceSummary;
  ratingDistribution: Array<{ rating: number; count: number }>;
  monthlyTrend: PerformanceTrendPoint[];
  activeProjects: Array<{ id: string; name: string; status: ProjectStatus }>;
  recentEvaluations: PerformanceEvaluation[];
}

export interface User {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  jobTitle?: string;
  bio?: string;
  department?: string;
  workspaceId: string;
  createdAt: string;
  isActive: boolean;
  color?: string;
  preferences?: {
    notifications?: {
      taskAssigned?: boolean;
      taskCompleted?: boolean;
      comments?: boolean;
      deadlines?: boolean;
      projectUpdates?: boolean;
      weeklyDigest?: boolean;
      emailNotifs?: boolean;
      pushNotifs?: boolean;
    };
    appearance?: {
      theme?: 'light' | 'dark' | 'system';
      density?: 'compact' | 'default' | 'comfortable';
    };
    locale?: {
      language?: string;
      timezone?: string;
      dateFormat?: string;
      weekStartsOn?: string;
    };
  };
}

export interface UserImportRow {
  rowNumber?: number;
  name: string;
  email: string;
  password: string;
  role?: Role;
  jobTitle?: string;
  department?: string;
  color?: string;
}

export interface UserImportFailure {
  rowNumber: number;
  email?: string;
  name?: string;
  message: string;
  code?: string;
}

export interface UserImportResult {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  createdUsers: User[];
  failures: UserImportFailure[];
}

export interface QuickTaskImportRow {
  rowNumber?: number;
  title: string;
  description?: string;
  priority?: Priority;
  status?: QuickTaskStatus;
  assigneeEmails?: string;
  assigneeNames?: string;
  reporterEmail?: string;
  reporterName?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuickTaskImportFailure {
  rowNumber: number;
  title?: string;
  assigneeEmails?: string;
  message: string;
  code?: string;
}

export interface QuickTaskImportResult {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  createdTasks: QuickTask[];
  failures: QuickTaskImportFailure[];
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: 'free' | 'pro' | 'enterprise';
  membersCount: number;
  createdAt: string;
  ownerId: string;
  settings?: {
    defaultLanguage?: string;
    timezone?: string;
    dateFormat?: string;
    weekStartsOn?: string;
    employeeIdConfig?: {
      prefix?: string;
      separator?: string;
      digits?: number;
      nextSequence?: number;
    };
    security?: {
      strongPasswords?: boolean;
    };
    permissions?: Record<string, Partial<Record<Role, boolean>>>;
  };
}

export interface ProjectSdlcPhase {
  name: string;
  durationDays: number;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  status: ProjectStatus;
  department?: string;
  workspaceId: string;
  teamId?: string;
  ownerId: string;
  members: string[];
  reportingPersonIds: string[];
  chatId?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  budgetCurrency?: string;
  sdlcPlan?: ProjectSdlcPhase[];
  totalPlannedDurationDays?: number;
  progress: number;
  tasksCount: number;
  completedTasksCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  taskType?: TaskType;
  priority: Priority;
  projectId: string;
  assigneeIds: string[];
  reporterId: string;
  parentTaskId?: string;
  /** Embedded checklist items (GW-style subtask bar) */
  subtasks?: TaskSubtask[];
  subtaskCompleted?: number;
  subtaskTotal?: number;
  labels?: string[];
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  trackedHours?: number;
  comments?: Comment[];
  attachments?: Attachment[];
  completionReview?: CompletionReview;
  activityHistory?: Activity[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuickTask {
  id: string;
  title: string;
  description?: string;
  status: QuickTaskStatus;
  priority: Priority;
  assigneeIds: string[];
  reporterId: string;
  dueDate?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  completionReview?: CompletionReview;
  activityHistory?: Activity[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  leaderId: string;
  members: string[];
  projectIds: string[];
  color: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'task_assigned' | 'comment_added' | 'deadline_approaching' | 'project_update' | 'mention';
  title: string;
  message: string;
  isRead: boolean;
  userId: string;
  relatedId?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  userId: string;
  entityId: string;
  entityType: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
  tasks: Task[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: 'task' | 'meeting' | 'deadline' | 'event';
  color?: string;
  projectId?: string;
}

export interface Report {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  teamVelocity: number;
  productivityScore: number;
  byPriority: Record<Priority, number>;
  byStatus: Record<TaskStatus, number>;
  weeklyCompletion: { week: string; completed: number; total: number }[];
  memberPerformance: { userId: string; completed: number; inProgress: number }[];
}

export interface TimelineTask {
  id: string;
  taskName: string;
  startDate: string; // Maintain backward compatibility (Legacy)
  endDate: string;   // Maintain backward compatibility (Legacy)
  duration: number;  // Maintain backward compatibility (Legacy)

  // BASELINE (PLANNED)
  plannedStartDate: string;
  plannedEndDate: string;
  plannedDuration: number;

  // ACTUAL (REAL)
  actualStartDate?: string;
  actualEndDate?: string;
  actualDuration?: number;

  assignedRole?: string;
  dependencyTaskId?: string;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  
  varianceDays?: number; // actualDuration - plannedDuration
  delayDays?: number;    // if actualEndDate > plannedEndDate
}

export interface ProjectTimeline {
  projectId: string;
  tasks: TimelineTask[];
  status: 'Draft' | 'Approved';
  createdAt: string;
  updatedAt: string;
}
