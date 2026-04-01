# Quick Start Guide - New Features

## 🎯 Three New Capabilities Implemented

### 1️⃣ Project Subcategories
**What it is**: Organize tasks into logical groups within a project  
**Example**: Website Redesign → [Mobile App Design, Backend, Frontend, UI Design]

**How to use**:
1. Create subcategories via API:
   ```javascript
   PUT /api/v1/projects/{projectId}/subcategories
   {
     "subcategories": [
       {"id": "ui", "name": "UI Design", "color": "#3b82f6", "order": 0},
       {"id": "backend", "name": "Backend", "color": "#8b5cf6", "order": 1}
     ]
   }
   ```
2. When creating a task, a dropdown appears to select the subcategory
3. Tasks are now grouped and filterable by subcategory

---

### 2️⃣ Assign Multiple People to Tasks
**What it is**: Assign a task to 2+ team members with shared responsibility  
**Example**: "API Development" assigned to [John Dev, Sarah Dev]

**How to use**:
1. Open "New task" modal
2. Scroll to "Assignees" section
3. Check boxes for multiple team members
4. All selected people will be assigned to the task
5. Click "Create" to save

**In the UI**:
- Table view shows the first assignee
- Expand the row to see all assignees with avatars

---

### 3️⃣ Assign People to Subtasks
**What it is**: Assign subtasks to specific team members for granular responsibility  
**Example**: Task → Subtasks: [Design (assigned to Designer), Code Review (assigned to Lead)]

**How to use**:
1. Expand a task (click the chevron button)
2. Scroll to "Subtasks" section
3. Enter subtask title
4. In "Assign to (optional)" section, check team members
5. Click "Add" to create the subtask
6. Subtasks now show assignee avatars

**Visual Feedback**:
- Small avatar icons appear next to subtask names
- Hover avatars to see member names

---

## 🚀 Step-by-Step Example

### Scenario: Create a Website Redesign Project

**Step 1: Set up subcategories**
```bash
curl -X PUT http://localhost:3000/api/v1/projects/123/subcategories \
  -d '{
    "subcategories": [
      {"id": "mob", "name": "Mobile Design", "color": "#3b82f6"},
      {"id": "web", "name": "Web Design", "color": "#06b6d4"},
      {"id": "back", "name": "Backend", "color": "#8b5cf6"},
      {"id": "front", "name": "Frontend", "color": "#ec4899"}
    ]
  }'
```

**Step 2: Create a task with subcategory and multiple assignees**
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -d '{
    "projectId": "123",
    "title": "Design login page UI",
    "subcategoryId": "mob",
    "assigneeIds": ["user_designer1", "user_designer2"],
    "priority": "high",
    "status": "in_progress"
  }'
```

**Step 3: Add subtasks with individual assignees**
```bash
# Subtask 1
curl -X POST http://localhost:3000/api/v1/tasks/task_456/subtasks \
  -d '{
    "title": "Create wireframes",
    "assigneeIds": ["user_designer1"]
  }'

# Subtask 2  
curl -X POST http://localhost:3000/api/v1/tasks/task_456/subtasks \
  -d '{
    "title": "Get client feedback",
    "assigneeIds": ["user_manager"]
  }'

# Subtask 3
curl -X POST http://localhost:3000/api/v1/tasks/task_456/subtasks \
  -d '{
    "title": "Create mockups",
    "assigneeIds": ["user_designer1", "user_designer2"]
  }'
```

---

## 📊 Feature Comparison Matrix

| Feature | Before | After |
|---------|--------|-------|
| **Task Organization** | By phase only | By phase + subcategory |
| **Task Assignment** | Single person | Multiple people |
| **Subtask Assignment** | Not possible | Multiple people per subtask |
| **Task Filtering** | By status, phase | + By subcategory |
| **Team Collaboration** | Implied | Explicit assignment |

---

## 🎨 UI Components

### In Task Creation Modal
```
┌─────────────────────────────────────┐
│ New Task                         [✕] │
├─────────────────────────────────────┤
│ Title: [_____________________]       │
│ Type: [Operational ▼]               │
│ Status: [Todo ▼]                    │
│ Start Date: [2024-04-01]            │
│ End Date: [2024-04-15]              │
│ Duration: [14] days                 │
│ Phase: [Ungrouped ▼]                │
│ Subcategory: [Mobile Design ▼]  NEW │
│ Assignees:           NEW             │
│   ☑ John Developer                  │
│   ☑ Sarah Designer                  │
│   ☐ Mike Manager                    │
├─────────────────────────────────────┤
│            [Cancel] [Create]         │
└─────────────────────────────────────┘
```

### In Task Expansion
```
┌─────────────────────────────────────┐
│ Subtasks                            │
├─────────────────────────────────────┤
│ ☑ Design wireframes      👤 John    │
│ ☐ Review designs  👤Sarah 👤Mike    │
│ ☐ Client feedback                   │
├─────────────────────────────────────┤
│ New Subtask: [____________]         │
│ Assign to (optional):        NEW    │
│   ☑ John Developer                  │
│   ☐ Sarah Designer                  │
│   ☐ Mike Manager                    │
│              [Add] [Cancel]         │
└─────────────────────────────────────┘
```

---

## ⚙️ Configuration & Customization

### Color Codes for Subcategories
```javascript
// Recommended color palette
const subcategoryColors = {
  "UI Design": "#3b82f6",        // Blue
  "UX Research": "#8b5cf6",      // Purple
  "Frontend": "#ec4899",         // Pink
  "Backend": "#14b8a6",          // Teal
  "DevOps": "#f59e0b",           // Amber
  "QA Testing": "#10b981",       // Green
  "Documentation": "#6b7280"     // Gray
};
```

### Ordering Subcategories
```javascript
// Subcategories are ordered by the 'order' field
// Workflow-based example:
[
  { id: "1", name: "Design", order: 0 },
  { id: "2", name: "Development", order: 1 },
  { id: "3", name: "Testing", order: 2 },
  { id: "4", name: "Deployment", order: 3 }
]
```

---

## ✅ Common Tasks

### "I want to assign 3 people to a task"
→ Use the **Multi-Assignee** feature in task creation modal

### "I want to organize tasks by design vs backend"
→ Use **Subcategories** (create "Design" and "Backend" subcategories)

### "I want the QA team to own a specific testing subtask"
→ Use **Subtask Assignees** (assign the testing subtask to QA members)

### "I want to see who's responsible for each subtask"
→ Expand the task - subtask **assignee avatars** show at a glance

### "I want to filter tasks by subcategory"
→ Currently by API; UI filtering coming in future enhancement

---

## 🔧 Troubleshooting

**"Subcategory dropdown doesn't appear"**
- Verify project has subcategories created
- Refresh the page to reload project data

**"Can't select multiple assignees"**
- Make sure you're checking boxes (not radio buttons)
- Verify team members exist and are in the project

**"Subtask assignees not showing"**
- Refresh the task list
- Check if members are in the project team
- Wait a moment for avatars to render

**"Error saving task with subcategoryId"**
- Verify subcategoryId is a valid string from the project
- Check the browser console for API error details

---

## 📚 More Information

- Full API docs: See `IMPLEMENTATION_SUMMARY.md`
- Feature guide: See `PROJECT_FEATURES.md`
- Code examples: See `.md` files in project root

---

**Ready to use!** 🎉  
Build with `npm run build` and deploy.
