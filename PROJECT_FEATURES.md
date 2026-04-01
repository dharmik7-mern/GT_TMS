# Project Management Features Guide

## 1. Project Subcategories

### Overview
Project subcategories allow you to organize tasks within a project into logical groupings. For example:
- **Parent Project**: "Website Redesign"
  - **Subcategories**: 
    - Mobile Application Design
    - UI Design
    - Backend Development
    - Frontend Development

### Using Subcategories

#### Creating Subcategories
Subcategories can be created via the API:

```javascript
// PUT /api/v1/projects/{projectId}/subcategories
{
  "subcategories": [
    {
      "id": "sub_001",
      "name": "Mobile Application Design",
      "description": "Mobile app design tasks",
      "color": "#3b82f6",
      "order": 0
    },
    {
      "id": "sub_002", 
      "name": "Backend Development",
      "description": "Server-side tasks",
      "color": "#8b5cf6",
      "order": 1
    }
  ]
}
```

#### Assigning Tasks to Subcategories
When creating a new task, select a subcategory from the dropdown (if any exist):

```javascript
// POST /api/v1/tasks
{
  "projectId": "proj_123",
  "title": "Design login page",
  "subcategoryId": "sub_001",
  "assigneeIds": ["user1", "user2"],
  // ... other fields
}
```

---

## 2. Multiple Task Assignees

### Overview
Tasks now support assigning multiple team members. This is useful for collaborative tasks where multiple people share responsibility.

### How to Use

#### During Task Creation
1. Open "New task" modal in a project
2. In the "Assignees" section, select multiple team members using checkboxes
3. All selected members will be assigned to the task

#### Task Details
- Main table view shows the first assignee's name
- When a task is expanded, all assignees are visible
- Each assignee receives notifications about the task

```javascript
// Example: Create task with multiple assignees
{
  "title": "API Development",
  "projectId": "proj_123",
  "assigneeIds": ["user_backend_1", "user_backend_2"],
  "status": "in_progress",
  // ... other fields
}
```

---

## 3. Subtask Management with Assignees

### Overview
Subtasks can now be assigned to individual team members. This provides granular task tracking and responsibility.

### How to Use

#### Adding Subtasks with Assignees
1. In the task details (expand a row), find the "Subtasks" section
2. Enter the subtask title
3. In the "Assign to (optional)" section, check boxes for team members to assign
4. Click "Add" to create the subtask

#### Viewing Subtask Assignees
- When tasks are expanded, subtasks show small avatar icons for assigned members
- Hover over avatars to see the member's name

#### API Format
```javascript
// POST /api/v1/tasks/{taskId}/subtasks
{
  "title": "Write unit tests",
  "assigneeIds": ["user_quality_assurance"]
}
```

---

## 4. Data Model Updates

### Project Model
```typescript
interface Project {
  // ... existing fields
  subcategories?: ProjectSubcategory[];
}

interface ProjectSubcategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order?: number;
}
```

### Task Subtask Model
```typescript
interface TaskSubtask {
  id: string;
  title: string;
  isCompleted: boolean;
  assigneeIds?: string[];  // NEW
  order: number;
  createdAt?: string;
  updatedAt?: string;
}
```

---

## 5. API Endpoints

### Project Subcategories

#### Update Project Subcategories
```
PUT /api/v1/projects/{projectId}/subcategories
Content-Type: application/json

{
  "subcategories": [
    {
      "id": string,
      "name": string,
      "description": string (optional),
      "color": string (optional),
      "order": number (optional)
    }
  ]
}

Response: { success: true, data: Project }
```

### Task Subtasks

#### Add Subtask with Assignees
```
POST /api/v1/tasks/{taskId}/subtasks
Content-Type: application/json

{
  "title": string,
  "assigneeIds": string[] (optional)
}

Response: { success: true, data: Task }
```

---

## 6. Best Practices

### Subcategories
- Keep subcategory names concise and descriptive
- Use consistent naming conventions (e.g., "Frontend", "Backend", "QA")
- Assign distinct colors to make visual distinction easier
- Order them logically (by workflow sequence or dependency)

### Multi-Assignees
- Use for collaborative tasks requiring multiple skill sets
- Keep the number of assignees reasonable (2-3 optimal)
- Designate one person as primary owner for accountability

### Subtask Assignees  
- Assign subtasks to specific experts (e.g., QA testing to QA team)
- Use for dependency tracking between subtasks
- Low-level tasks should have 1 assignee (avoid ambiguity)

---

## 7. UI Components

### Subcategory Selector (Task Creation Modal)
- Appears only if project has subcategories
- Dropdown with "None" default option
- Color-coded display in dropdown

### Multi-Assignee Checkbox List
- Available in task creation modal
- Shows all project members
- Role badges displayed next to names
- Scrollable if many members

### Subtask Assignee Selection (Expanded Task Row)
- Expandable section under subtask input
- Member checkboxes in scrollable container
- Compact avatar display in subtask list
- Empty state: no avatars if unassigned

---

## 8. Migration Guide

If upgrading from previous version:

1. **Database Migration** - `subcategories` array added to projects (defaults to empty)
2. **Existing Tasks** - No changes to assigneeIds (still supported)
3. **Existing Subtasks** - `assigneeIds` field added (defaults to empty array)
4. **Backward Compatibility** - All APIs remain compatible

---

## 9. Examples

### Example 1: Create Project with Subcategories
```javascript
// First, create project normally, then update with subcategories
const updateResponse = await fetch('/api/v1/projects/proj_123/subcategories', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subcategories: [
      {
        id: 'ui_design',
        name: 'UI Design',
        color: '#06b6d4',
        order: 0
      },
      {
        id: 'ux_research',
        name: 'UX Research',
        color: '#ec4899',
        order: 1
      }
    ]
  })
});
```

### Example 2: Create Task with Multiple Assignees and Subcategory
```javascript
const taskResponse = await fetch('/api/v1/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'proj_123',
    title: 'Design user dashboard',
    description: 'Create responsive dashboard UI',
    subcategoryId: 'ui_design',
    assigneeIds: ['designer_1', 'designer_2'],
    priority: 'high',
    status: 'in_progress',
    startDate: '2024-04-01',
    dueDate: '2024-04-15',
    durationDays: 14
  })
});
```

### Example 3: Add Subtask with Assignment
```javascript
const subtaskResponse = await fetch('/api/v1/tasks/task_456/subtasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Create wireframes',
    assigneeIds: ['designer_1']
  })
});
```

---

For more information, see the [API Documentation](./SERVER_API.md) or contact the development team.
