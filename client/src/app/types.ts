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
  canUsePrivateQuickTasks?: boolean;
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

export interface ProjectImportRow {
  rowNumber?: number;
  projectKey?: string;
  projectName: string;
  projectDescription?: string;
  projectStatus?: ProjectStatus;
  projectDepartment?: string;
  projectColor?: string;
  memberEmails?: string;
  memberNames?: string;
  reportingPersonEmails?: string;
  reportingPersonNames?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  budgetCurrency?: string;
  sdlcPlan?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskStatus?: TaskStatus;
  taskPriority?: Priority;
  taskAssigneeEmails?: string;
  taskAssigneeNames?: string;
  taskStartDate?: string;
  taskDurationDays?: number;
  taskEstimatedHours?: number;
  taskPhase?: string;
  taskSubtasks?: string;
}

export interface ProjectImportFailure {
  rowNumber: number;
  projectKey?: string;
  projectName?: string;
  taskTitle?: string;
  message: string;
  code?: string;
}

export interface ProjectImportResult {
  totalRows: number;
  createdCount: number;
  createdTaskCount: number;
  failedCount: number;
  createdProjects: Project[];
  failures: ProjectImportFailure[];
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
  phaseId?: string;
  dependencies?: string[];
  type?: 'task' | 'milestone';
  /** Embedded checklist items (GW-style subtask bar) */
  subtasks?: TaskSubtask[];
  subtaskCompleted?: number;
  subtaskTotal?: number;
  labels?: string[];
  startDate?: string;
  dueDate?: string;
  endDate?: string;
  estimatedHours?: number;
  trackedHours?: number;
  comments?: Comment[];
  attachments?: Attachment[];
  completionReview?: CompletionReview;
  activityHistory?: Activity[];
  isReassignPending?: boolean;
  requestedAssigneeId?: string;
  reassignRequestedBy?: string;
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
  assignedTo?: string;
  createdBy?: string;
  isPrivate?: boolean;
  dueDate?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  completionReview?: CompletionReview;
  activityHistory?: Activity[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTask {
  id: string;
  userId: string;
  tenantId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  dueTime?: string;
  labels: string[];
  subtasks?: TaskSubtask[];
  reminder?: {
    enabled: boolean;
    at?: string;
  };
  isPinned: boolean;
  completedAt?: string;
  order: number;
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
  leaderIds?: string[];
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
  title: string;
  projectId: string;
  phaseId?: string | null;
  startDate: string;
  endDate: string;
  startOffset: number;
  endOffset: number;
  durationInDays: number;
  dependencies: string[];
  predecessorIds?: string[];
  type: 'task' | 'milestone';
  assigneeIds: string[];
  assignee?: string | null;
  status: string;
  priority?: Priority;
  progress: number;
  isCritical?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimelinePhase {
  id: string;
  projectId: string;
  name: string;
  order: number;
  color?: string;
  tasks: TimelineTask[];
}

export interface TimelineDependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: 'finish_to_start';
}

export interface TimelineConflict {
  assigneeId: string;
  taskIds: string[];
  startDate: string;
  endDate: string;
}

export interface ProjectTimeline {
  projectId: string;
  status: 'Draft' | 'Approved';
  settings: {
    zoom: 'day' | 'week' | 'month';
    baselineVisible?: boolean;
    showCriticalPath?: boolean;
  };
  projectWindow: {
    startDate: string;
    endDate: string;
    totalDays: number;
    todayOffset: number;
  };
  phases: TimelinePhase[];
  tasks: TimelineTask[];
  dependencies: TimelineDependency[];
  resourceConflicts: TimelineConflict[];
  summary: {
    totalTasks: number;
    criticalTasks: number;
    overdueTasks: number;
    milestoneCount: number;
  };
}
