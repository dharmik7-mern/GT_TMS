# GT_TMS System Documentation

## 1. Document Purpose

This document provides a professional working overview of the `GT_TMS` platform based on the current codebase in this repository.

It is intended to answer two core questions:

1. What functionality is currently implemented and available in the system?
2. What functionality can be added or expanded in future releases?

This document is written from the present implementation state of the repository and should be updated as features evolve.

---

## 2. Product Overview

`GT_TMS` is a multi-tenant project and task management platform designed for internal team operations, project execution, quick work assignment, reporting, notifications, and administrative control.

The system supports:

- company-level tenant separation
- workspace-oriented operations
- role-based access control
- project and quick-task execution flows
- activity tracking and audit visibility
- notifications and email-driven task communication
- reporting and operational dashboards

The product combines project management, task monitoring, quick assignment workflows, planner tools, MIS functions, and super-admin controls in a single application.

---

## 3. Architecture Summary

### Frontend

- React
- TypeScript
- Vite
- React Router
- Zustand-based state management
- Tailwind CSS
- Framer Motion

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- JWT-based authentication
- Role-aware middleware and route guards
- Static asset and upload serving through Express

### Tenant Model

The platform uses a tenant-aware database pattern.

- A central company record is stored in the base database.
- Each company can be mapped to its own tenant database.
- Application models are resolved dynamically per tenant via `tenantDb.js`.

This means the product is already structured for multi-company operation.

---

## 4. Role Model

The current system supports the following main roles:

- `super_admin`
- `admin`
- `manager`
- `team_leader`
- `team_member`

Role-based restrictions are already used in routing and backend service logic for:

- page access
- task visibility
- quick-task visibility
- review rights
- administrative management
- reporting and log access

---

## 5. Current Working Functionalities

The items below are based on the routed pages, backend modules, services, and current implementation patterns present in the repository.

### 5.1 Authentication and Access Control

Current working scope:

- login flow
- forgot-password flow
- reset-password flow
- authenticated route protection
- guest-only route protection
- role-restricted routes
- seeded bootstrap super-admin creation on server startup

Implementation indicators:

- frontend auth routes
- backend auth routes and middleware
- bootstrap seed logic

### 5.2 Multi-Tenant Company and Workspace Structure

Current working scope:

- company-level tenant resolution
- workspace-aware model usage
- company routes and workspace routes
- company-scoped user and task operations
- tenant database naming and caching

Implementation indicators:

- `server/src/config/tenantDb.js`
- company and workspace route modules

### 5.3 Dashboard

Current working scope:

- dashboard route and page
- task-based overview metrics
- overdue task counts
- active project counts
- recent platform/workspace activity
- super-admin overview widgets

The dashboard already acts as an operational summary layer for both standard users and higher roles.

### 5.4 Project Management

Current working scope:

- projects listing
- project detail view
- project todo page
- project status and progress handling
- project members and reporting persons
- project-level task visibility
- project statistics synchronization

Related capabilities visible in the codebase:

- project create/update/delete flows
- SDLC/timeline-aware structure support
- project activity logging

### 5.5 Project Task Management

Current working scope:

- create project tasks
- update tasks
- delete tasks
- task detail modal workflows
- task status movement
- task assignee management
- task comments
- attachments
- subtask handling
- review and approval workflow for completed tasks
- reassignment request integration
- activity log tracking for task actions

Additional observed behavior:

- task completion review model exists
- notifications are generated for new assignments
- assignment emails are sent through templated mail handling

### 5.6 Quick Tasks

Current working scope:

- quick-task list page
- quick-task detail page
- create, edit, and delete quick tasks
- due date support
- assignee support
- private quick-task support
- attachments
- comments
- completion review workflow
- quick-task import support
- overdue highlighting
- activity logging

Recent implemented behavior now present in the codebase:

- required `title`
- required `due date`
- at least one assignee required
- default current date for new quick tasks
- broader global search by title, description, creator, assignees, dates, status, and priority
- duplicate activity-log reduction for update actions

### 5.7 Task Management Overview Screens

Current working scope:

- unified task-management page
- my-tasks page
- quick-task and project-task visibility in task views
- overdue filtering
- task lookup and task detail navigation

These screens give users an execution-focused working layer beyond project pages.

### 5.8 Teams Management

Current working scope:

- teams module and teams page
- team leader and member-aware organization
- team-to-project association support
- team activity logging

### 5.9 Planner / Personal Tasking

Current working scope:

- planner page
- personal task routes
- personal labels
- personal subtasks
- due date tracking
- pin/unpin support
- done/in-progress/todo management

This gives the system a personal productivity layer in addition to shared project work.

### 5.10 Calendar and Timeline

Current working scope:

- calendar route and calendar page
- admin calendar routes
- project timeline routes
- task timeline patching
- dependency creation
- timeline summary including overdue counts and milestone counts

The codebase shows a strong foundation for visual planning and schedule management.

### 5.11 Reports

Current working scope:

- reports page
- task and quick-task reporting
- assignee-level metrics
- overdue metrics
- completion and rating metrics
- scope-aware filtered reporting

This module is already positioned as a management reporting layer.

### 5.12 MIS Module

Current working scope:

- MIS entry page
- MIS manager page
- MIS reports page
- backend MIS routes

This indicates that MIS workflows are already part of the active product surface.

### 5.13 Notifications and Communication

Current working scope:

- notifications page
- notification delivery through backend modules
- task assignment notifications
- completion-review notifications
- quick-task notifications
- broadcast notification routes/pages for higher roles
- email notification templates in settings

The system already supports both in-app and email-oriented communication behavior.

### 5.14 Activity Logs / Audit Trail

Current working scope:

- activity route module
- activity history attachment to tasks and quick tasks
- log generation for create/update/delete/review flows
- log access route for higher roles

This provides traceability across operational changes.

### 5.15 Settings and Administration

Current working scope:

- user settings page
- role-aware settings routing
- super-admin settings module
- maintenance-mode middleware enforcement
- email/SMTP-related settings flows
- permission-oriented admin pages
- workspace admin pages
- admin billing page

### 5.16 Super Admin Capabilities

Current working scope:

- companies management routes/pages
- users management routes/pages
- roles and permissions page
- logs page
- support page
- broadcast notifications page
- platform settings page

This indicates a working platform-administration layer beyond normal workspace operations.

### 5.17 API and Operational Readiness

Current working scope:

- `/healthz` health endpoint
- `/readyz` readiness endpoint
- request logging
- rate limiting
- security middleware
- compression
- static asset serving
- upload serving
- maintenance-mode enforcement

---

## 6. Working Module Status Matrix

| Module | Current Status | Notes |
|---|---|---|
| Authentication | Working | Login, password recovery, protected routing are present |
| Companies / Multi-Tenancy | Working | Tenant database model is implemented |
| Workspaces | Working | Workspace-aware model access and routes exist |
| Dashboard | Working | Role-aware operational dashboards are present |
| Projects | Working | Project lifecycle and detail pages are implemented |
| Project Tasks | Working | CRUD, reviews, attachments, comments, reassignment support |
| Quick Tasks | Working | CRUD, import, review, private tasks, attachments, activity history |
| Teams | Working | Team routes and pages exist |
| Notifications | Working | In-app and email-related flows exist |
| Reports | Working | Management reporting layer is implemented |
| MIS | Working | Entry, management, and reporting modules are routed |
| Planner / Personal Tasks | Working | Personal productivity layer exists |
| Timeline / Dependencies | Working | Timeline routes and dependency actions exist |
| Activity Logs | Working | Audit trail module exists |
| Settings | Working | User and admin settings are present |
| Super Admin | Working | Platform-level management modules are present |

---

## 7. Current Strengths of the System

The current repository already shows strong product maturity in the following areas:

- multi-tenant backend architecture
- role-aware access control
- combined project-task and quick-task execution model
- auditability through activity logs
- notification and email foundations
- reporting and admin operations
- planner and personal productivity support
- project timeline and dependency groundwork

This is no longer just a basic task tracker. It is already structured as an internal operations and work-management platform.

---

## 8. Future Implementation Opportunities

The following items are recommended future enhancements. These are not marked as fully implemented today and should be treated as roadmap candidates.

### 8.1 Workflow and Tasking Enhancements

Recommended future scope:

- recurring tasks and recurring quick tasks
- task templates
- checklist templates
- SLA and deadline policies
- escalation chains for overdue items
- dependency-aware blocking rules
- bulk update actions for tasks and quick tasks
- task watchers or followers separate from assignees
- approval chains with multiple reviewers

### 8.2 Collaboration Enhancements

Recommended future scope:

- richer real-time collaboration using sockets across all task views
- mentions in comments
- threaded comments
- internal chat tied directly to tasks/projects
- richer activity feed filtering by team, user, project, and module

### 8.3 Reporting and Analytics

Recommended future scope:

- exportable executive dashboards
- PDF and scheduled report generation
- productivity trend forecasting
- workload capacity planning
- team utilization heatmaps
- project risk scoring
- on-time delivery analytics by project/team/user

### 8.4 Admin and Governance

Recommended future scope:

- stronger permission matrix editor
- audit retention policies
- audit export and archival tools
- tenant backup and restore controls
- environment diagnostics panel
- configuration version history

### 8.5 Notification and Communication Layer

Recommended future scope:

- reminder scheduling engine
- recurring reminder policies
- WhatsApp/SMS notification integration
- Slack or Microsoft Teams integration
- digest subscriptions by module
- notification preference granularity by event type

### 8.6 Integrations

Recommended future scope:

- HRMS synchronization expansion
- ERP/accounting integration
- calendar sync with Google and Microsoft
- webhook support for external systems
- SSO integration with Google/Microsoft/Azure AD/Okta

### 8.7 Mobile and User Experience

Recommended future scope:

- responsive optimization pass across all modules
- dedicated mobile-first task execution views
- offline-friendly mobile experience
- PWA packaging
- native mobile application

### 8.8 Platform Operations

Recommended future scope:

- background job queue for mail, reminders, imports, and report generation
- structured monitoring and alerting
- log aggregation dashboard
- better automated test coverage
- CI/CD release pipelines
- seeded demo environments for onboarding and sales demos

---

## 9. Recommended Roadmap Priorities

If the goal is business value with minimum disruption, the recommended priority order is:

### Phase 1: Operational Stability and Scale

- automated reminder engine
- task and quick-task bulk operations
- stronger audit filtering and exports
- background job processing for emails and notifications
- improved test coverage around task workflows

### Phase 2: Managerial Visibility

- advanced reporting exports
- workload and capacity analytics
- overdue escalation policies
- approval workflow expansion

### Phase 3: Enterprise Readiness

- SSO
- webhook and third-party integrations
- backup/restore tooling
- platform observability improvements
- mobile/PWA delivery

---

## 10. Suggested Document Maintenance Process

To keep this document useful, update it whenever one of the following happens:

- a new routed page is added
- a backend module is introduced or removed
- a feature moves from partial to production-ready
- a roadmap item becomes active implementation work
- permissions or role behaviors change

Recommended update frequency:

- once per release
- or at minimum once per sprint for active product development

---

## 11. Conclusion

The current `GT_TMS` system already contains a substantial amount of working functionality across project execution, quick tasks, planning, reporting, notifications, administration, and multi-tenant management.

The strongest immediate opportunity is not to rebuild the product foundation, but to strengthen it through:

- workflow automation
- analytics depth
- enterprise integrations
- scale and reliability improvements

This repository already provides a solid platform base for a professional internal operations and project-management system.

