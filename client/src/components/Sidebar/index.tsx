import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FolderKanban, Calendar, Users, BarChart3, ListTodo,
  Bell, Settings, ChevronDown, Plus, Search, LogOut,
  Building2, Shield, Briefcase, UserCircle, ChevronsLeft,
  ChevronsRight, Hash, Zap, Activity
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { useAuthStore } from '../../context/authStore';
import { useAppStore } from '../../context/appStore';
import { UserAvatar } from '../UserAvatar';
import type { Role } from '../../app/types';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  path: string;
  roles?: Role[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Teams', icon: Users, path: '/teams', roles: ['super_admin', 'admin', 'manager', 'team_leader'] },
  { label: 'Reports', icon: BarChart3, path: '/reports', roles: ['super_admin', 'admin', 'manager'] },
  { label: 'Activity Logs', icon: Activity, path: '/logs', roles: ['super_admin', 'admin', 'manager', 'team_leader'] },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
];

const SUPER_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Projects', icon: FolderKanban, path: '/projects' },
  { label: 'Calendar', icon: Calendar, path: '/calendar' },
  { label: 'Teams', icon: Users, path: '/teams' },
  { label: 'Reports', icon: BarChart3, path: '/reports' },
  { label: 'Activity Logs', icon: Activity, path: '/logs' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
];

const PLATFORM_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Companies', icon: Building2, path: '/companies' },
  { label: 'Users List', icon: UserCircle, path: '/users' },
  { label: 'Reports & Analytics', icon: BarChart3, path: '/reports' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'System Logs', icon: Briefcase, path: '/logs' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
];

const SA_MANAGEMENT_NAV: NavItem[] = [
  { label: 'Companies', icon: Building2, path: '/companies' },
  { label: 'Users List', icon: UserCircle, path: '/users' },
  { label: 'Roles & Permissions', icon: Shield, path: '/roles-permissions' },
  { label: 'Site Settings', icon: Settings, path: '/settings' },
  { label: 'System Logs', icon: Briefcase, path: '/logs' },
  { label: 'Help & Support', icon: Users, path: '/support' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Workspaces', icon: Building2, path: '/admin/workspaces', roles: ['super_admin'] },
  { label: 'Users', icon: UserCircle, path: '/admin/users', roles: ['super_admin', 'admin'] },
  { label: 'Permissions', icon: Shield, path: '/admin/permissions', roles: ['super_admin', 'admin'] },
  // { label: 'Billing', icon: Briefcase, path: '/admin/billing', roles: ['super_admin', 'admin'] },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, projects, unreadNotificationsCount, workspaces } = useAppStore();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [openDepartments, setOpenDepartments] = useState<Record<string, boolean>>({});
  const [quickTasksExpanded, setQuickTasksExpanded] = useState(true);
  const [openProjectTodos, setOpenProjectTodos] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const unread = unreadNotificationsCount();
  const workspace = workspaces[0];

  const activeProjects = projects.filter(p => p.status === 'active');
  const recentProjects = activeProjects.slice(0, 5);

  const groupedProjects = activeProjects.reduce((acc, p) => {
    const dept = p.department || 'General';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(p);
    return acc;
  }, {} as Record<string, typeof projects>);

  const toggleDept = (dept: string) => {
    setOpenDepartments(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  const canSeeAdminNav = user?.role === 'super_admin' || user?.role === 'admin';
  const isCollapsed = sidebarCollapsed;

  const filteredNav = user?.role === 'super_admin'
    ? PLATFORM_ADMIN_NAV
    : (user?.role === 'admin')
      ? SUPER_ADMIN_NAV
      : NAV_ITEMS.filter(item => !item.roles || (user && item.roles.includes(user.role)));

  if (!workspace) {
    return (
      <motion.aside
        animate={window.innerWidth >= 768 ? { width: isCollapsed ? 64 : 260 } : { width: 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-full bg-white dark:bg-surface-900 border-r border-surface-100 dark:border-surface-800 z-30 hidden md:flex flex-col shadow-sidebar overflow-hidden"
      >
        <div className="p-4 border-b border-surface-100 dark:border-surface-800">
          <div className="h-4 w-32 bg-surface-100 dark:bg-surface-800 rounded" />
          <div className="h-3 w-20 bg-surface-100 dark:bg-surface-800 rounded mt-2" />
        </div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      animate={window.innerWidth >= 768 ? { width: isCollapsed ? 64 : 260 } : { width: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-white dark:bg-surface-900 border-r border-surface-100 dark:border-surface-800 z-30 hidden md:flex flex-col shadow-sidebar overflow-hidden"
    >
      {/* Logo & Workspace */}
      <div className="flex items-center gap-3 p-4 border-b border-surface-100 dark:border-surface-800">
        <div className="w-8 h-8 bg-white-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-glow">
          {/* <Zap size={16} className="text-white" /> */}
          <img src='/logo.png' />
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-w-0"
            >
              <button
                onClick={() => setWorkspaceOpen(!workspaceOpen)}
                className="flex items-center gap-1 w-full group"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-display font-bold text-surface-900 dark:text-white text-sm leading-tight truncate">
                    {workspace.name}
                  </p>
                  <p className="text-xs text-surface-400 capitalize">{workspace.plan} plan</p>
                </div>
                <ChevronDown
                  size={14}
                  className={cn('text-surface-400 transition-transform flex-shrink-0', workspaceOpen && 'rotate-180')}
                />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Workspace Switcher Dropdown */}
      <AnimatePresence>
        {workspaceOpen && !isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-surface-100 dark:border-surface-800"
          >
            <div className="p-2 space-y-1">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
                    ws.id === workspace?.id
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                      : 'text-surface-600 hover:bg-surface-50 dark:text-surface-400 dark:hover:bg-surface-800'
                  )}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ backgroundColor: ws.id === workspace?.id ? '#3366ff' : '#7c3aed' }}
                  >
                    {ws.name[0]}
                  </div>
                  <span className="truncate font-medium">{ws.name}</span>
                  {ws.id === workspace?.id && <span className="ml-auto text-[10px] text-brand-500">✓</span>}
                </button>
              ))}
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
                <Plus size={14} />
                New Workspace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      {!isCollapsed && (
        <div className="px-3 py-2.5">
          <button
            onClick={() => { }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-100 dark:border-surface-700 text-surface-400 text-sm hover:border-surface-200 dark:hover:border-surface-600 transition-colors"
          >
            <Search size={14} />
            <span>Search...</span>
            {/* <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded font-mono text-surface-500">⌘K</kbd> */}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-hide">
        {/* {!isCollapsed && (
          <p className="section-title px-3 py-1 mb-1">Menu</p>
        )} */}

        {filteredNav.map((item) => {
          const Icon = item.icon;
          const badge = item.label === 'Notifications' ? unread : item.badge;
          return (
            <React.Fragment key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    isActive ? 'nav-item-active' : 'nav-item-inactive',
                    isCollapsed && 'justify-center px-0'
                  )
                }
                title={isCollapsed ? item.label : undefined}
                onClick={(e) => {
                  if (item.label === 'Projects' && !isCollapsed) {
                    // Stay on page but toggle if needed, or just let both happen
                    setProjectsExpanded(!projectsExpanded);
                  }
                }}
              >
                <Icon size={18} className="flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.label === 'Projects' && (
                      <div className="flex items-center gap-1">
                        <button
                          className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); navigate('/projects?new=true'); }}
                        >
                          <Plus size={12} className="text-surface-500" />
                        </button>
                        <ChevronDown
                          size={12}
                          className={cn('text-surface-400 transition-transform mr-1', projectsExpanded && 'rotate-180')}
                        />
                      </div>
                    )}
                    {badge && badge > 0 && (
                      <span className="ml-auto w-5 h-5 bg-brand-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>

              {item.label === 'Projects' && !isCollapsed && (
                <AnimatePresence>
                  {projectsExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1 ml-4 mt-1"
                    >
                      {user?.role === 'admin' ? (
                        Object.entries(groupedProjects).map(([dept, deptProjects]) => (
                          <div key={dept} className="space-y-0.5">
                            <button
                              onClick={() => toggleDept(dept)}
                              className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-surface-50 dark:hover:bg-surface-800/30 rounded-lg group/dept transition-colors"
                            >
                              <ChevronDown
                                size={10}
                                className={cn('text-surface-400 transition-transform', openDepartments[dept] !== false ? 'rotate-180' : 'rotate-270')}
                              />
                              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{dept}</span>
                            </button>

                            <AnimatePresence>
                              {openDepartments[dept] !== false && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden space-y-0.5"
                                >
                                  {deptProjects.map(project => {
                                    const todoPath = `/projects/${project.id}/todo`;
                                    const isOnTodo = pathname === todoPath;
                                    const open = Boolean(openProjectTodos[project.id]) || isOnTodo;

                                    return (
                                      <div key={project.id} className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <NavLink
                                            to={`/projects/${project.id}`}
                                            className={({ isActive }) =>
                                              cn(
                                                isActive ? 'nav-item-active' : 'nav-item-inactive',
                                                'pl-8 pr-2 flex-1'
                                              )
                                            }
                                          >
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
                                            <span className="text-xs truncate">{project.name}</span>
                                          </NavLink>

                                          {!isCollapsed && (
                                            <button
                                              type="button"
                                              className={cn(
                                                'w-6 h-6 rounded-md flex items-center justify-center text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/30 transition-colors cursor-pointer flex-shrink-0',
                                                isOnTodo ? 'text-brand-600 dark:text-brand-400' : ''
                                              )}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setOpenProjectTodos((prev) => ({ ...prev, [project.id]: !open }));
                                              }}
                                              title="Toggle To-do"
                                            >
                                              <ChevronDown
                                                size={14}
                                                className={cn(
                                                  'transition-transform',
                                                  open ? 'rotate-180' : 'rotate-0'
                                                )}
                                              />
                                            </button>
                                          )}
                                        </div>

                                        <AnimatePresence>
                                          {!isCollapsed && open && (
                                            <motion.div
                                              initial={{ opacity: 0, height: 0 }}
                                              animate={{ opacity: 1, height: 'auto' }}
                                              exit={{ opacity: 0, height: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <NavLink
                                                to={`/projects/${project.id}`}
                                                className={({ isActive }) =>
                                                  cn(
                                                    isActive ? 'nav-item-active' : 'nav-item-inactive',
                                                    'pl-10 pr-4 py-1 text-[11px] text-surface-500'
                                                  )
                                                }
                                              >
                                                <FolderKanban size={12} className="flex-shrink-0 opacity-70" />
                                                <span className="truncate">Board</span>
                                              </NavLink>
                                              <NavLink
                                                to={todoPath}
                                                className={({ isActive }) =>
                                                  cn(
                                                    isActive ? 'nav-item-active' : 'nav-item-inactive',
                                                    'pl-10 pr-4 py-1 text-[11px] text-surface-500'
                                                  )
                                                }
                                              >
                                                <ListTodo size={12} className="flex-shrink-0 opacity-70" />
                                                <span className="truncate">To-do</span>
                                              </NavLink>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))
                      ) : (
                        recentProjects.map(project => {
                          const todoPath = `/projects/${project.id}/todo`;
                          const isOnTodo = pathname === todoPath;
                          const open = Boolean(openProjectTodos[project.id]) || isOnTodo;

                          return (
                            <div key={project.id} className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <NavLink
                                  to={`/projects/${project.id}`}
                                  className={({ isActive }) =>
                                    cn(
                                      isActive ? 'nav-item-active' : 'nav-item-inactive',
                                      'px-4 flex-1'
                                    )
                                  }
                                >
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                                  <span className="text-xs truncate">{project.name}</span>
                                </NavLink>

                                {!isCollapsed && (
                                  <button
                                    type="button"
                                    className={cn(
                                      'w-6 h-6 rounded-md flex items-center justify-center text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/30 transition-colors cursor-pointer flex-shrink-0',
                                      isOnTodo ? 'text-brand-600 dark:text-brand-400' : ''
                                    )}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setOpenProjectTodos((prev) => ({ ...prev, [project.id]: !open }));
                                    }}
                                    title="Toggle To-do"
                                  >
                                    <ChevronDown
                                      size={14}
                                      className={cn(
                                        'transition-transform',
                                        open ? 'rotate-180' : 'rotate-0'
                                      )}
                                    />
                                  </button>
                                )}
                              </div>

                              <AnimatePresence>
                                {!isCollapsed && open && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <NavLink
                                      to={`/projects/${project.id}`}
                                      className={({ isActive }) =>
                                        cn(
                                          isActive ? 'nav-item-active' : 'nav-item-inactive',
                                          'pl-6 pr-4 py-1 text-[11px] text-surface-500'
                                        )
                                      }
                                    >
                                      <FolderKanban size={12} className="flex-shrink-0 opacity-70" />
                                      <span className="truncate">Board</span>
                                    </NavLink>
                                    <NavLink
                                      to={todoPath}
                                      className={({ isActive }) =>
                                        cn(
                                          isActive ? 'nav-item-active' : 'nav-item-inactive',
                                          'pl-6 pr-4 py-1 text-[11px] text-surface-500'
                                        )
                                      }
                                    >
                                      <ListTodo size={12} className="flex-shrink-0 opacity-70" />
                                      <span>To-do</span>
                                    </NavLink>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </React.Fragment>
          );
        })}

        {/* Administration Section for Workspace Admins */}
        {user?.role === 'admin' && (
          <div className={cn("pt-3", isCollapsed && "pt-2")}>
            {!isCollapsed && <p className="section-title px-3 py-1 mb-1">Administration</p>}
            {ADMIN_NAV.filter(item => !item.roles || (user && item.roles.includes(user.role))).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      isActive ? 'nav-item-active' : 'nav-item-inactive',
                      isCollapsed && 'justify-center px-0'
                    )
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={isCollapsed ? 18 : 16} className="flex-shrink-0" />
                  {!isCollapsed && <span className="flex-1 text-xs">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        )}


        {/* Quick Tasks Section */}
        {!isCollapsed && user?.role !== 'super_admin' && (
          <div className="pt-3">
            <div
              onClick={() => setQuickTasksExpanded(!quickTasksExpanded)}
              className="w-full flex items-center gap-1 px-3 py-1 mb-1 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 rounded-lg transition-colors"
            >

              <p className="section-title flex-1 text-left">Quick tasks</p>

              {/* Quick Task Plus Button */}
              <button
                className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); navigate('/quick-tasks?new=1'); }}
              >
                <Plus size={14} className="text-surface-500" />
              </button>

              <ChevronDown size={12} className={cn('text-surface-400 transition-transform', quickTasksExpanded && 'rotate-180')} />
            </div>

            <AnimatePresence>
              {quickTasksExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-0.5"
                >
                  <NavLink
                    to="/quick-tasks"
                    className={({ isActive }) => cn(isActive ? 'nav-item-active' : 'nav-item-inactive', 'text-xs')}
                  >
                    <Zap size={14} className="flex-shrink-0" />
                    <span className="truncate">Quick Tasks</span>
                  </NavLink>

                  <button
                    onClick={() => navigate('/quick-tasks?new=1')}
                    className="nav-item-inactive text-xs w-full"
                  >
                    <Plus size={14} />
                    <span>New Quick Task</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}


        {/* Hash/Direct links for team members */}
        {!isCollapsed && user?.role !== 'super_admin' && (
          <div className="pt-3">
            <p className="section-title px-3 py-1 mb-1">Quick Links</p>
            <NavLink to="/my-tasks" className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item-inactive'}>
              <Hash size={18} className="flex-shrink-0" />
              <span>My Tasks</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-surface-100 dark:border-surface-800 p-2 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(isActive ? 'nav-item-active' : 'nav-item-inactive', isCollapsed && 'justify-center px-0')}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </NavLink>

        {/* User Profile */}
        {!isCollapsed && user && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer group">
            <UserAvatar name={user.name} color={user.color} size="sm" isOnline={true} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{user.name}</p>
              <p className="text-xs text-surface-400 truncate capitalize">{user.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-rose-500 transition-all"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {isCollapsed && user && (
          <button
            onClick={logout}
            className="nav-item-inactive justify-center px-0 w-full"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center py-1.5 text-surface-400 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
