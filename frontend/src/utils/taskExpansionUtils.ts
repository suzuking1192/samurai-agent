import { Task } from '../types'

/**
 * Identifies newly created tasks by comparing current tasks with previous tasks
 * @param currentTasks - Current list of tasks
 * @param previousTasks - Previous list of tasks (from previous render)
 * @returns Array of newly created task IDs
 */
export const identifyNewTasks = (
  currentTasks: Task[],
  previousTasks: Task[]
): string[] => {
  const previousTaskIds = new Set(previousTasks.map(task => task.id))
  return currentTasks
    .filter(task => !previousTaskIds.has(task.id))
    .map(task => task.id)
}

/**
 * Determines which parent tasks should be auto-expanded when they have sub-tasks
 * @param tasks - Current list of tasks
 * @param newTaskIds - Array of newly created task IDs
 * @returns Array of parent task IDs that should be auto-expanded
 */
export const getParentTasksToAutoExpand = (
  tasks: Task[],
  newTaskIds: string[]
): string[] => {
  const parentTasksToExpand = new Set<string>()
  
  // Build a map of parent -> children
  const childrenMap = new Map<string, Task[]>()
  for (const task of tasks) {
    if (task.parent_task_id) {
      if (!childrenMap.has(task.parent_task_id)) {
        childrenMap.set(task.parent_task_id, [])
      }
      childrenMap.get(task.parent_task_id)!.push(task)
    }
  }
  
  // For each new task, check if it's a sub-task and if its parent should be expanded
  for (const newTaskId of newTaskIds) {
    const newTask = tasks.find(task => task.id === newTaskId)
    if (newTask && newTask.parent_task_id) {
      const parentId = newTask.parent_task_id
      const parentTask = tasks.find(task => task.id === parentId)
      
      // Auto-expand parent if it has sub-tasks and is newly created
      if (parentTask && newTaskIds.includes(parentId)) {
        parentTasksToExpand.add(parentId)
      }
      
      // Also auto-expand parent if it's an existing task that now has new sub-tasks
      if (parentTask && !newTaskIds.includes(parentId)) {
        const children = childrenMap.get(parentId) || []
        const hasNewChildren = children.some(child => newTaskIds.includes(child.id))
        if (hasNewChildren) {
          parentTasksToExpand.add(parentId)
        }
      }
    }
  }
  
  return Array.from(parentTasksToExpand)
}

/**
 * Checks if a task has any sub-tasks
 * @param taskId - The task ID to check
 * @param tasks - Current list of tasks
 * @returns True if the task has sub-tasks
 */
export const hasSubTasks = (taskId: string, tasks: Task[]): boolean => {
  return tasks.some(task => task.parent_task_id === taskId)
}

/**
 * Gets all sub-tasks of a given task
 * @param taskId - The parent task ID
 * @param tasks - Current list of tasks
 * @returns Array of sub-tasks
 */
export const getSubTasks = (taskId: string, tasks: Task[]): Task[] => {
  return tasks.filter(task => task.parent_task_id === taskId)
}

/**
 * Determines if a task should be auto-expanded based on its creation time
 * and whether it has sub-tasks
 * @param task - The task to check
 * @param tasks - Current list of tasks
 * @param isNewlyCreated - Whether this task was just created
 * @returns True if the task should be auto-expanded
 */
export const shouldAutoExpandTask = (
  task: Task,
  tasks: Task[],
  isNewlyCreated: boolean
): boolean => {
  if (!isNewlyCreated) return false
  
  // Auto-expand if the task has sub-tasks
  return hasSubTasks(task.id, tasks)
}
