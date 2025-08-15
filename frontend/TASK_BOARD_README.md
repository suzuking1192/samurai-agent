# TaskBoard Component

A Kanban-style board component for displaying and managing tasks by priority levels with drag-and-drop functionality.

## Features

- **Three Priority Rows**: High, Medium, and Low priority sections
- **Drag and Drop**: Change task priorities by dragging tasks between rows
- **Optimistic Updates**: Immediate UI feedback with rollback on errors
- **Visual Feedback**: Loading states, success/error messages, and hover effects
- **Responsive Design**: Works on different screen sizes
- **Error Handling**: Graceful handling of API failures with user feedback

## Usage

### Basic Implementation

```tsx
import TaskBoard from './components/TaskBoard'
import { Task, TaskPriority } from './types'

const MyComponent = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleTaskClick = (task: Task) => {
    // Handle task click - e.g., open task details
    console.log('Task clicked:', task)
  }

  const handleTaskUpdate = (updatedTask: Task) => {
    // Update local state when task is modified
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ))
  }

  return (
    <TaskBoard
      tasks={tasks}
      isLoading={isLoading}
      onTaskClick={handleTaskClick}
      projectId="project-123"
      onTaskUpdate={handleTaskUpdate}
    />
  )
}
```

### Integration with TaskPanel

The TaskBoard is integrated into the existing TaskPanel component and can be accessed via the view controls:

```tsx
// In TaskPanel component
<ViewControls
  currentView={viewMode}
  onViewChange={setViewMode}
  className="task-view-controls"
/>

{viewMode === 'kanban' ? (
  <TaskBoard
    tasks={tasks}
    isLoading={isLoading}
    onTaskClick={handleTaskClick}
    projectId={projectId}
    onTaskUpdate={handleTaskUpdate}
  />
) : (
  <TaskListView /* existing list view */ />
)}
```

## API Integration

The TaskBoard component uses the existing `updateTask` API endpoint:

```typescript
// PUT /projects/{project_id}/tasks/{task_id}
await updateTask(projectId, taskId, { priority: newPriority })
```

### Backend Requirements

The backend must support updating task priorities via the existing endpoint:

```python
@app.put("/projects/{project_id}/tasks/{task_id}")
async def update_task(project_id: str, task_id: str, request: dict):
    # Must handle 'priority' field in request body
    if 'priority' in request:
        updates['priority'] = request['priority']
    # ... rest of implementation
```

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tasks` | `Task[]` | Yes | Array of tasks to display |
| `isLoading` | `boolean` | Yes | Whether the component is loading |
| `onTaskClick` | `(task: Task) => void` | Yes | Callback when a task is clicked |
| `projectId` | `string` | No | Project ID for API calls |
| `onTaskUpdate` | `(task: Task) => void` | No | Callback when a task is updated |

## Task Interface

```typescript
interface Task {
  id: string
  project_id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority // 'low' | 'medium' | 'high'
  created_at: string
  updated_at: string
  parent_task_id?: string | null
}
```

## Drag and Drop Behavior

1. **Drag Start**: Task becomes semi-transparent and gets a "dragging" class
2. **Drag Over**: Target priority row highlights with a colored border
3. **Drop**: 
   - Optimistic update: Task immediately moves to new priority row
   - API call: Backend is updated with new priority
   - Success: Success message is shown
   - Error: Task reverts to original position, error message is shown

## Visual Design

### Priority Colors
- **High Priority**: Red (#ef4444)
- **Medium Priority**: Amber (#f59e0b)  
- **Low Priority**: Green (#10b981)

### States
- **Normal**: White background with subtle shadow
- **Hover**: Elevated shadow and slight upward movement
- **Dragging**: 50% opacity and slight rotation
- **Updating**: Shimmer animation overlay
- **Drag Over**: Colored border and background tint

## Error Handling

The component handles various error scenarios:

- **Network Errors**: Shows error message and reverts optimistic update
- **Invalid Project ID**: Gracefully handles missing project ID
- **API Failures**: Displays user-friendly error messages
- **Same Priority Drop**: No-op when dropping on same priority level

## Testing

The component includes comprehensive tests:

- **Unit Tests**: Component rendering, interactions, and state management
- **Integration Tests**: Full drag-and-drop flow with API integration
- **Error Scenarios**: Network failures and edge cases

Run tests with:
```bash
npm test -- --run TaskBoard
npm test -- --run task-board-integration
```

## CSS Classes

The component uses the following CSS classes for styling:

- `.task-board`: Main container
- `.priority-rows`: Container for priority sections
- `.priority-row`: Individual priority row
- `.priority-row.drag-over`: Row being dragged over
- `.task-cards`: Container for task cards
- `.task-card`: Individual task card
- `.task-card.dragging`: Card being dragged
- `.task-card.updating`: Card being updated

## Browser Support

The component uses standard HTML5 drag and drop APIs and should work in all modern browsers:

- Chrome 4+
- Firefox 3.5+
- Safari 3.1+
- Edge 12+

## Performance Considerations

- **Optimistic Updates**: Immediate UI feedback without waiting for API
- **Debounced API Calls**: Prevents excessive API requests during rapid interactions
- **Efficient Re-renders**: Uses React.memo and useCallback for performance
- **Minimal DOM Updates**: Only updates necessary elements during drag operations

## Future Enhancements

Potential improvements for future versions:

- **Multi-select**: Select multiple tasks for bulk operations
- **Custom Priorities**: Allow custom priority levels beyond High/Medium/Low
- **Keyboard Navigation**: Full keyboard accessibility
- **Animations**: Smooth transitions between priority levels
- **Filters**: Filter tasks by status, assignee, or other criteria
- **Sorting**: Sort tasks within priority levels
- **Export**: Export board state or task lists
