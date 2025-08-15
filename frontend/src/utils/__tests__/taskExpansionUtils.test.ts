import { Task, TaskStatus, TaskPriority } from '../../types'
import {
  identifyNewTasks,
  getParentTasksToAutoExpand,
  hasSubTasks,
  getSubTasks,
  shouldAutoExpandTask
} from '../taskExpansionUtils'

describe('taskExpansionUtils', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      project_id: 'project-1',
      title: 'Parent Task 1',
      description: 'A parent task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'task-2',
      project_id: 'project-1',
      title: 'Child Task 1',
      description: 'A child task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      parent_task_id: 'task-1'
    },
    {
      id: 'task-3',
      project_id: 'project-1',
      title: 'Child Task 2',
      description: 'Another child task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      parent_task_id: 'task-1'
    },
    {
      id: 'task-4',
      project_id: 'project-1',
      title: 'Standalone Task',
      description: 'A standalone task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]

  describe('identifyNewTasks', () => {
    it('should identify newly created tasks', () => {
      const previousTasks = mockTasks.slice(0, 2) // task-1, task-2
      const currentTasks = mockTasks // task-1, task-2, task-3, task-4
      
      const newTaskIds = identifyNewTasks(currentTasks, previousTasks)
      
      expect(newTaskIds).toEqual(['task-3', 'task-4'])
    })

    it('should return empty array when no new tasks', () => {
      const newTaskIds = identifyNewTasks(mockTasks, mockTasks)
      expect(newTaskIds).toEqual([])
    })

    it('should handle empty previous tasks', () => {
      const newTaskIds = identifyNewTasks(mockTasks, [])
      expect(newTaskIds).toEqual(['task-1', 'task-2', 'task-3', 'task-4'])
    })
  })

  describe('hasSubTasks', () => {
    it('should return true for task with sub-tasks', () => {
      expect(hasSubTasks('task-1', mockTasks)).toBe(true)
    })

    it('should return false for task without sub-tasks', () => {
      expect(hasSubTasks('task-4', mockTasks)).toBe(false)
    })

    it('should return false for non-existent task', () => {
      expect(hasSubTasks('non-existent', mockTasks)).toBe(false)
    })
  })

  describe('getSubTasks', () => {
    it('should return all sub-tasks of a parent task', () => {
      const subTasks = getSubTasks('task-1', mockTasks)
      expect(subTasks).toHaveLength(2)
      expect(subTasks.map(t => t.id)).toEqual(['task-2', 'task-3'])
    })

    it('should return empty array for task without sub-tasks', () => {
      const subTasks = getSubTasks('task-4', mockTasks)
      expect(subTasks).toEqual([])
    })
  })

  describe('shouldAutoExpandTask', () => {
    it('should return true for newly created task with sub-tasks', () => {
      const result = shouldAutoExpandTask(mockTasks[0], mockTasks, true)
      expect(result).toBe(true)
    })

    it('should return false for newly created task without sub-tasks', () => {
      const result = shouldAutoExpandTask(mockTasks[3], mockTasks, true)
      expect(result).toBe(false)
    })

    it('should return false for existing task', () => {
      const result = shouldAutoExpandTask(mockTasks[0], mockTasks, false)
      expect(result).toBe(false)
    })
  })

  describe('getParentTasksToAutoExpand', () => {
    it('should return parent tasks that should be auto-expanded when they have new sub-tasks', () => {
      const newTaskIds = ['task-2', 'task-3'] // New sub-tasks
      const parentTasksToExpand = getParentTasksToAutoExpand(mockTasks, newTaskIds)
      
      expect(parentTasksToExpand).toEqual(['task-1'])
    })

    it('should return parent tasks that are newly created and have sub-tasks', () => {
      const newTaskIds = ['task-1', 'task-2'] // New parent and child
      const parentTasksToExpand = getParentTasksToAutoExpand(mockTasks, newTaskIds)
      
      expect(parentTasksToExpand).toEqual(['task-1'])
    })

    it('should return empty array when no parent tasks need expansion', () => {
      const newTaskIds = ['task-4'] // Only standalone task
      const parentTasksToExpand = getParentTasksToAutoExpand(mockTasks, newTaskIds)
      
      expect(parentTasksToExpand).toEqual([])
    })

    it('should handle complex hierarchy scenarios', () => {
      const complexTasks: Task[] = [
        {
          id: 'parent-1',
          project_id: 'project-1',
          title: 'Parent 1',
          description: 'Parent task',
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'parent-2',
          project_id: 'project-1',
          title: 'Parent 2',
          description: 'Another parent task',
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'child-1',
          project_id: 'project-1',
          title: 'Child 1',
          description: 'Child of parent 1',
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          parent_task_id: 'parent-1'
        },
        {
          id: 'child-2',
          project_id: 'project-1',
          title: 'Child 2',
          description: 'Child of parent 2',
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          parent_task_id: 'parent-2'
        }
      ]

      const newTaskIds = ['child-1', 'child-2'] // New children
      const parentTasksToExpand = getParentTasksToAutoExpand(complexTasks, newTaskIds)
      
      expect(parentTasksToExpand).toEqual(['parent-1', 'parent-2'])
    })
  })
})
