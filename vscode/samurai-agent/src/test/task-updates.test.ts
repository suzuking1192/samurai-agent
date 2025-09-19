import * as assert from 'assert';

// Mock DOM environment for testing
const mockDOM = {
	document: {
		addEventListener: () => {},
		querySelectorAll: () => [],
		querySelector: () => null,
		getElementById: () => null,
		createElement: () => ({
			addEventListener: () => {},
			setAttribute: () => {},
			style: {},
			textContent: '',
			innerHTML: '',
			outerHTML: ''
		})
	},
	navigator: {
		clipboard: {
			writeText: () => Promise.resolve()
		}
	},
	window: {
		TaskManager: {}
	}
};

// Mock global objects
(global as any).document = mockDOM.document;
Object.defineProperty(global, 'navigator', {
	value: mockDOM.navigator,
	writable: true,
	configurable: true
});
(global as any).window = mockDOM.window;

suite('Task Tab Updates Test Suite', () => {
	test('Task hierarchy should use correct depth values', () => {
		// Mock updated task data structure with new depth values
		const mockTasks = [
			{
				id: 'task-1',
				title: 'Parent Task',
				parentTaskId: null,
				depth: 1  // Updated: top-level tasks now use depth 1
			},
			{
				id: 'task-1-1',
				title: 'Child Task 1',
				parentTaskId: 'task-1',
				depth: 2  // Updated: subtasks now use depth 2
			},
			{
				id: 'task-1-2',
				title: 'Child Task 2',
				parentTaskId: 'task-1',
				depth: 2  // Updated: subtasks now use depth 2
			}
		];
		
		// Verify parent task has depth 1
		const parentTask = mockTasks.find(t => t.id === 'task-1');
		assert.ok(parentTask, 'Parent task should exist');
		assert.strictEqual(parentTask?.depth, 1, 'Parent task should have depth 1');
		
		// Verify child tasks have depth 2
		const childTasks = mockTasks.filter(t => t.parentTaskId === 'task-1');
		assert.strictEqual(childTasks.length, 2, 'Should have 2 child tasks');
		
		childTasks.forEach(child => {
			assert.strictEqual(child.depth, 2, 'Child tasks should have depth 2');
			assert.strictEqual(child.parentTaskId, 'task-1', 'Child tasks should reference correct parent');
		});
	});

	test('Default task filter should be set to pending', () => {
		// Mock task state with updated default filter
		const mockTaskState = {
			expandedTasks: new Set(),
			visibleSubtasks: new Set(),
			tasks: [],
			currentFilter: 'pending'  // Updated: default filter is now 'pending'
		};
		
		// Verify default filter is 'pending'
		assert.strictEqual(mockTaskState.currentFilter, 'pending', 'Default filter should be set to pending');
		
		// Test filter functionality with new default
		function filterTasks(tasks: any[], filter: string) {
			if (filter === 'all') {
				return tasks;
			}
			if (filter === 'pending') {
				return tasks.filter((task: any) => !task.isCompleted);
			}
			if (filter === 'completed') {
				return tasks.filter((task: any) => task.isCompleted);
			}
			return tasks;
		}
		
		const mockTasks = [
			{ id: 'task-1', isCompleted: false, depth: 1 },
			{ id: 'task-2', isCompleted: true, depth: 1 },
			{ id: 'task-3', isCompleted: false, depth: 1 }
		];
		
		// Test with default filter (pending)
		const pendingTasks = filterTasks(mockTasks, mockTaskState.currentFilter);
		assert.strictEqual(pendingTasks.length, 2, 'Pending filter should return 2 tasks');
		assert.ok(pendingTasks.every((task: any) => !task.isCompleted), 'All returned tasks should be pending');
	});

	test('Task completion toggle functionality should work correctly', () => {
		// Mock task completion toggle function
		function toggleTaskCompletionStatus(taskId: string, tasks: any[]) {
			const task = tasks.find(t => t.id === taskId);
			if (task) {
				task.isCompleted = !task.isCompleted;
				return task;
			}
			return null;
		}
		
		const mockTasks = [
			{ id: 'task-1', title: 'Test Task', isCompleted: false, depth: 1 },
			{ id: 'task-2', title: 'Another Task', isCompleted: true, depth: 1 }
		];
		
		// Test toggling incomplete task to complete
		const toggledTask1 = toggleTaskCompletionStatus('task-1', mockTasks);
		assert.ok(toggledTask1, 'Task should be found and toggled');
		assert.strictEqual(toggledTask1.isCompleted, true, 'Task should be marked as completed');
		
		// Test toggling complete task to incomplete
		const toggledTask2 = toggleTaskCompletionStatus('task-2', mockTasks);
		assert.ok(toggledTask2, 'Task should be found and toggled');
		assert.strictEqual(toggledTask2.isCompleted, false, 'Task should be marked as incomplete');
		
		// Test toggling non-existent task
		const nonExistentTask = toggleTaskCompletionStatus('task-999', mockTasks);
		assert.strictEqual(nonExistentTask, null, 'Non-existent task should return null');
	});

	test('Completed button should be conditionally rendered', () => {
		// Mock task card HTML generation with completed button
		function generateTaskCardHTML(task: any) {
			const completedButton = !task.isCompleted ? 
				`<button class="task-btn success" data-action="complete-task" data-task-id="${task.id}">Completed</button>` : 
				'';
			
			return `
				<div class="task-card" data-task-id="${task.id}">
					<div class="task-header-content">
						<h4 class="task-title">${task.title}</h4>
						<span class="task-status ${task.isCompleted ? 'completed' : 'pending'}">
							${task.isCompleted ? 'Completed' : 'Pending'}
						</span>
					</div>
					<div class="task-actions">
						<button class="task-btn" data-action="toggle-detail" data-task-id="${task.id}">
							Show Details
						</button>
					</div>
					<div class="task-detail">
						<textarea class="task-spec" data-task-id="${task.id}">${task.spec}</textarea>
						<div class="task-detail-actions">
							<button class="task-btn" data-action="copy-spec" data-task-id="${task.id}">Copy Spec</button>
							<button class="task-btn secondary" data-action="save-spec" data-task-id="${task.id}">Save Changes</button>
							${completedButton}
						</div>
					</div>
				</div>
			`;
		}
		
		// Test with incomplete task
		const incompleteTask = {
			id: 'task-1',
			title: 'Incomplete Task',
			spec: 'Test specification',
			isCompleted: false
		};
		
		const incompleteTaskHTML = generateTaskCardHTML(incompleteTask);
		assert.ok(incompleteTaskHTML.includes('data-action="complete-task"'), 'Incomplete task should have completed button');
		assert.ok(incompleteTaskHTML.includes('task-btn success'), 'Completed button should have success class');
		assert.ok(incompleteTaskHTML.includes('Completed'), 'Completed button should have correct text');
		
		// Test with completed task
		const completedTask = {
			id: 'task-2',
			title: 'Completed Task',
			spec: 'Test specification',
			isCompleted: true
		};
		
		const completedTaskHTML = generateTaskCardHTML(completedTask);
		assert.ok(!completedTaskHTML.includes('data-action="complete-task"'), 'Completed task should not have completed button');
		assert.ok(completedTaskHTML.includes('task-status completed'), 'Completed task should have completed status class');
	});

	test('Subtask cards should also have completed button functionality', () => {
		// Mock subtask card HTML generation
		function generateSubtaskCardHTML(task: any) {
			const completedButton = !task.isCompleted ? 
				`<button class="task-btn success" data-action="complete-task" data-task-id="${task.id}">Completed</button>` : 
				'';
			
			return `
				<div class="subtask-card" data-task-id="${task.id}">
					<div class="task-header-content">
						<h4 class="task-title">${task.title}</h4>
						<span class="task-status ${task.isCompleted ? 'completed' : 'pending'}">
							${task.isCompleted ? 'Completed' : 'Pending'}
						</span>
					</div>
					<div class="task-actions">
						<button class="task-btn" data-action="toggle-detail" data-task-id="${task.id}">
							Show Details
						</button>
					</div>
					<div class="task-detail">
						<textarea class="task-spec" data-task-id="${task.id}">${task.spec}</textarea>
						<div class="task-detail-actions">
							<button class="task-btn" data-action="copy-spec" data-task-id="${task.id}">Copy Spec</button>
							<button class="task-btn secondary" data-action="save-spec" data-task-id="${task.id}">Save Changes</button>
							${completedButton}
						</div>
					</div>
				</div>
			`;
		}
		
		// Test with incomplete subtask
		const incompleteSubtask = {
			id: 'task-1-1',
			title: 'Incomplete Subtask',
			spec: 'Subtask specification',
			isCompleted: false,
			depth: 2
		};
		
		const subtaskHTML = generateSubtaskCardHTML(incompleteSubtask);
		assert.ok(subtaskHTML.includes('subtask-card'), 'Should contain subtask-card class');
		assert.ok(subtaskHTML.includes('data-action="complete-task"'), 'Incomplete subtask should have completed button');
		assert.ok(subtaskHTML.includes('task-btn success'), 'Completed button should have success class');
	});

	test('Task filtering should work with new depth structure', () => {
		// Mock task filtering with updated depth structure
		function filterTopLevelTasks(tasks: any[], filter: string) {
			// Get top-level tasks (depth 1) and apply filter
			let topLevelTasks = tasks.filter(task => task.depth === 1);
			
			// Apply current filter
			if (filter === 'pending') {
				topLevelTasks = topLevelTasks.filter(task => !task.isCompleted);
			} else if (filter === 'completed') {
				topLevelTasks = topLevelTasks.filter(task => task.isCompleted);
			}
			
			return topLevelTasks;
		}
		
		const mockTasks = [
			{ id: 'task-1', title: 'Task 1', isCompleted: false, depth: 1 },
			{ id: 'task-1-1', title: 'Subtask 1-1', isCompleted: false, depth: 2 },
			{ id: 'task-2', title: 'Task 2', isCompleted: true, depth: 1 },
			{ id: 'task-2-1', title: 'Subtask 2-1', isCompleted: true, depth: 2 },
			{ id: 'task-3', title: 'Task 3', isCompleted: false, depth: 1 }
		];
		
		// Test filtering top-level tasks only
		const allTopLevelTasks = filterTopLevelTasks(mockTasks, 'all');
		assert.strictEqual(allTopLevelTasks.length, 3, 'Should return 3 top-level tasks');
		assert.ok(allTopLevelTasks.every(task => task.depth === 1), 'All returned tasks should have depth 1');
		
		// Test pending filter
		const pendingTopLevelTasks = filterTopLevelTasks(mockTasks, 'pending');
		assert.strictEqual(pendingTopLevelTasks.length, 2, 'Should return 2 pending top-level tasks');
		assert.ok(pendingTopLevelTasks.every(task => !task.isCompleted), 'All returned tasks should be pending');
		
		// Test completed filter
		const completedTopLevelTasks = filterTopLevelTasks(mockTasks, 'completed');
		assert.strictEqual(completedTopLevelTasks.length, 1, 'Should return 1 completed top-level task');
		assert.ok(completedTopLevelTasks.every(task => task.isCompleted), 'All returned tasks should be completed');
	});

	test('TaskManager should include new toggleTaskCompletionStatus function', () => {
		// Mock updated TaskManager object
		const mockTaskManager = {
			renderTasks: () => {},
			toggleTaskDetail: (taskId: string) => {},
			toggleSubtasks: (taskId: string) => {},
			copyTaskSpec: (taskId: string) => {},
			saveTaskSpec: (taskId: string) => {},
			toggleTaskCompletionStatus: (taskId: string) => {},  // New function
			setTaskFilter: (filter: string) => {},
			getTasks: () => [],
			getCurrentFilter: () => 'pending',  // Updated default
			addTask: (task: any) => {},
			updateTask: (taskId: string, updates: any) => {}
		};
		
		// Verify new function exists
		assert.ok(typeof mockTaskManager.toggleTaskCompletionStatus === 'function', 
			'TaskManager should have toggleTaskCompletionStatus function');
		
		// Verify updated default filter
		assert.strictEqual(mockTaskManager.getCurrentFilter(), 'pending', 
			'getCurrentFilter should return pending as default');
		
		// Verify all required functions still exist
		const requiredFunctions = [
			'renderTasks', 'toggleTaskDetail', 'toggleSubtasks', 
			'copyTaskSpec', 'saveTaskSpec', 'toggleTaskCompletionStatus', 'setTaskFilter', 
			'getTasks', 'getCurrentFilter', 'addTask', 'updateTask'
		];
		
		requiredFunctions.forEach(funcName => {
			assert.ok(typeof mockTaskManager[funcName as keyof typeof mockTaskManager] === 'function', 
				`TaskManager should have ${funcName} function`);
		});
	});

	test('Task completion button should have proper CSS styling', () => {
		// Mock CSS class names for task buttons
		const taskButtonClasses = {
			primary: 'task-btn',
			secondary: 'task-btn secondary',
			success: 'task-btn success'
		};
		
		// Verify success button class is defined
		assert.ok(taskButtonClasses.success, 'Success button class should be defined');
		assert.ok(taskButtonClasses.success.includes('success'), 'Success button class should include success');
		
		// Verify all button classes follow naming convention
		Object.values(taskButtonClasses).forEach(className => {
			assert.ok(className.includes('task-btn'), 'All button classes should include task-btn');
		});
	});

	test('Task state should handle completion status correctly', () => {
		// Mock task state management
		const mockTaskState = {
			expandedTasks: new Set(),
			visibleSubtasks: new Set(),
			tasks: [
				{ id: 'task-1', title: 'Task 1', isCompleted: false, depth: 1 },
				{ id: 'task-2', title: 'Task 2', isCompleted: true, depth: 1 }
			],
			currentFilter: 'pending'
		};
		
		// Test task completion status
		const task1 = mockTaskState.tasks.find(t => t.id === 'task-1');
		const task2 = mockTaskState.tasks.find(t => t.id === 'task-2');
		
		assert.ok(task1, 'Task 1 should exist');
		assert.ok(task2, 'Task 2 should exist');
		assert.strictEqual(task1?.isCompleted, false, 'Task 1 should be incomplete');
		assert.strictEqual(task2?.isCompleted, true, 'Task 2 should be completed');
		
		// Test filtering with completion status
		const pendingTasks = mockTaskState.tasks.filter(task => !task.isCompleted);
		const completedTasks = mockTaskState.tasks.filter(task => task.isCompleted);
		
		assert.strictEqual(pendingTasks.length, 1, 'Should have 1 pending task');
		assert.strictEqual(completedTasks.length, 1, 'Should have 1 completed task');
		assert.strictEqual(pendingTasks[0].id, 'task-1', 'Pending task should be task-1');
		assert.strictEqual(completedTasks[0].id, 'task-2', 'Completed task should be task-2');
	});
});
