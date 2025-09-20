// Task Tab JavaScript - Handles task rendering and interactions

// Task management state - now using persistence API
let taskState = {
    expandedTasks: new Set(),
    visibleSubtasks: new Set(),
    tasks: [], // Will be loaded from persistence
    currentFilter: 'pending', // 'all', 'pending', 'completed'
    isLoading: false
};

// Initialize task functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTaskTab();
});

async function initializeTaskTab() {
    // Load tasks from persistence
    await loadTasksFromPersistence();
    
    // Render tasks when task tab is shown
    const taskTab = document.getElementById('task-tab');
    if (taskTab) {
        taskTab.addEventListener('click', async function() {
            // Show loading state while fetching fresh data
            const taskContent = document.getElementById('task-content');
            if (taskContent) {
                const hideLoading = window.WebviewApi?.ui?.showGlobalLoading(taskContent, 'Loading tasks...');
                try {
                    await loadTasksFromPersistence();
                    setTimeout(renderTasks, 100); // Small delay to ensure tab content is visible
                } finally {
                    if (hideLoading) hideLoading();
                }
            }
        });
    }
    
    // Initial render if task tab is already active
    const taskContent = document.getElementById('task-content');
    if (taskContent && taskContent.style.display !== 'none') {
        renderTasks();
    }
}

// Load tasks from persistence API
async function loadTasksFromPersistence() {
    try {
        taskState.isLoading = true;
        const tasks = await window.WebviewApi.persistence.loadTasks();
        taskState.tasks = tasks || [];
        calculateHasSubtasks();
        console.log('Tasks loaded from persistence:', taskState.tasks);
    } catch (error) {
        console.error('Error loading tasks from persistence:', error);
        showTaskError(`Failed to load tasks: ${error.message}`);
        // Keep existing tasks if loading fails
    } finally {
        taskState.isLoading = false;
    }
}

// Save a task using persistence API
async function saveTaskWithPersistence(task) {
    try {
        const savedTask = await window.WebviewApi.persistence.saveTask(task);
        // Update the task in our local state
        const index = taskState.tasks.findIndex(t => t.id === task.id);
        if (index >= 0) {
            taskState.tasks[index] = savedTask;
        } else {
            taskState.tasks.push(savedTask);
        }
        calculateHasSubtasks();
        return savedTask;
    } catch (error) {
        console.error('Error saving task:', error);
        throw error;
    }
}

function calculateHasSubtasks() {
    // Reset hasSubtasks for all tasks
    taskState.tasks.forEach(task => {
        task.hasSubtasks = false;
    });
    
    // Calculate hasSubtasks based on parentTaskId relationships
    taskState.tasks.forEach(task => {
        if (task.parentTaskId) {
            const parentTask = taskState.tasks.find(t => t.id === task.parentTaskId);
            if (parentTask) {
                parentTask.hasSubtasks = true;
            }
        }
    });
}

function renderTasks() {
    const taskContent = document.getElementById('task-content');
    if (!taskContent) {
        return;
    }
    
    // Show loading state if tasks are being loaded
    if (taskState.isLoading) {
        taskContent.innerHTML = `
            <div class="task-container">
                <div class="task-header">
                    <h3>Task Management</h3>
                </div>
                <div class="task-loading">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <div class="loading-text">Loading tasks...</div>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    // Get top-level tasks (depth 1) and apply filter
    let topLevelTasks = taskState.tasks.filter(task => task.depth === 1);
    
    // Apply current filter
    if (taskState.currentFilter === 'pending') {
        topLevelTasks = topLevelTasks.filter(task => !task.isCompleted);
    } else if (taskState.currentFilter === 'completed') {
        topLevelTasks = topLevelTasks.filter(task => task.isCompleted);
    }
    
    // Calculate stats for all tasks (not filtered)
    const allTopLevelTasks = taskState.tasks.filter(task => task.depth === 1);
    const pendingCount = allTopLevelTasks.filter(task => !task.isCompleted).length;
    const completedCount = allTopLevelTasks.filter(task => task.isCompleted).length;
    
    if (topLevelTasks.length === 0) {
        const emptyMessage = taskState.currentFilter === 'all' ? 'No tasks available' :
                           taskState.currentFilter === 'pending' ? 'No pending tasks' :
                           'No completed tasks';
        taskContent.innerHTML = `
            <div class="task-container">
                <div class="task-header">
                    <h3>Task Management</h3>
                    <div class="task-stats">
                        <span>${allTopLevelTasks.length} tasks</span>
                    </div>
                </div>
                <div class="task-filter-tabs">
                    <button class="task-filter-tab ${taskState.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                        All (${allTopLevelTasks.length})
                    </button>
                    <button class="task-filter-tab ${taskState.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">
                        Pending (${pendingCount})
                    </button>
                    <button class="task-filter-tab ${taskState.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
                        Completed (${completedCount})
                    </button>
                </div>
                <div class="task-empty">
                    <h4>${emptyMessage}</h4>
                    <p>Create your first task to get started.</p>
                </div>
            </div>
        `;
        attachFilterEventListeners();
        return;
    }
    
    const taskListHtml = topLevelTasks.map(task => renderTaskCard(task)).join('');
    
    taskContent.innerHTML = `
        <div class="task-container">
            <div class="task-header">
                <h3>Task Management</h3>
                <div class="task-stats">
                    <span>${topLevelTasks.length} of ${allTopLevelTasks.length} tasks</span>
                </div>
            </div>
            <div class="task-filter-tabs">
                <button class="task-filter-tab ${taskState.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                    All (${allTopLevelTasks.length})
                </button>
                <button class="task-filter-tab ${taskState.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">
                    Pending (${pendingCount})
                </button>
                <button class="task-filter-tab ${taskState.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
                    Completed (${completedCount})
                </button>
            </div>
            <div class="task-list">
                ${taskListHtml}
            </div>
        </div>
    `;
    
    // Attach event listeners
    attachTaskEventListeners();
    attachFilterEventListeners();
}

function renderTaskCard(task) {
    const isExpanded = taskState.expandedTasks.has(task.id);
    const showSubtasks = taskState.visibleSubtasks.has(task.id);
    const statusClass = task.isCompleted ? 'completed' : 'pending';
    const statusText = task.isCompleted ? 'Completed' : 'Pending';
    
    const subtasksHtml = showSubtasks ? renderSubtasks(task.id) : '';
    
    return `
        <div class="task-card ${isExpanded ? 'expanded' : ''}" data-task-id="${task.id}">
            <div class="task-header-content">
                <h4 class="task-title">${task.title}</h4>
                <span class="task-status ${statusClass}">${statusText}</span>
            </div>
            
            <div class="task-actions">
                <button class="task-btn" data-action="toggle-detail" data-task-id="${task.id}">
                    ${isExpanded ? 'Hide Details' : 'Show Details'}
                </button>
                ${task.hasSubtasks ? `
                    <button class="task-btn secondary" data-action="toggle-subtasks" data-task-id="${task.id}">
                        ${showSubtasks ? 'Hide Subtasks' : 'Show Subtasks'}
                    </button>
                ` : ''}
            </div>
            
            <div class="task-detail ${isExpanded ? 'expanded' : ''}">
                <textarea class="task-spec" data-task-id="${task.id}" placeholder="Task specification...">${task.spec}</textarea>
                <div class="task-detail-actions">
                    <button class="task-btn" data-action="copy-spec" data-task-id="${task.id}">Copy Spec</button>
                    <button class="task-btn secondary" data-action="save-spec" data-task-id="${task.id}">Save Changes</button>
                    ${!task.isCompleted ? `<button class="task-btn success" data-action="complete-task" data-task-id="${task.id}">Completed</button>` : ''}
                </div>
            </div>
            
            ${subtasksHtml}
        </div>
    `;
}

function renderSubtasks(parentTaskId) {
    const subtasks = taskState.tasks.filter(task => task.parentTaskId === parentTaskId);
    
    if (subtasks.length === 0) {
        return '';
    }
    
    const subtaskCards = subtasks.map(subtask => renderSubtaskCard(subtask)).join('');
    
    return `
        <div class="subtask-container">
            <div class="subtask-list">
                ${subtaskCards}
            </div>
        </div>
    `;
}

function renderSubtaskCard(task) {
    const isExpanded = taskState.expandedTasks.has(task.id);
    const statusClass = task.isCompleted ? 'completed' : 'pending';
    const statusText = task.isCompleted ? 'Completed' : 'Pending';
    
    return `
        <div class="subtask-card" data-task-id="${task.id}">
            <div class="task-header-content">
                <h4 class="task-title">${task.title}</h4>
                <span class="task-status ${statusClass}">${statusText}</span>
            </div>
            
            <div class="task-actions">
                <button class="task-btn" data-action="toggle-detail" data-task-id="${task.id}">
                    ${isExpanded ? 'Hide Details' : 'Show Details'}
                </button>
            </div>
            
            <div class="task-detail ${isExpanded ? 'expanded' : ''}">
                <textarea class="task-spec" data-task-id="${task.id}" placeholder="Task specification...">${task.spec}</textarea>
                <div class="task-detail-actions">
                    <button class="task-btn" data-action="copy-spec" data-task-id="${task.id}">Copy Spec</button>
                    <button class="task-btn secondary" data-action="save-spec" data-task-id="${task.id}">Save Changes</button>
                    ${!task.isCompleted ? `<button class="task-btn success" data-action="complete-task" data-task-id="${task.id}">Completed</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function attachTaskEventListeners() {
    // Toggle task detail
    document.querySelectorAll('[data-action="toggle-detail"]').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            toggleTaskDetail(taskId);
        });
    });
    
    // Toggle subtasks
    document.querySelectorAll('[data-action="toggle-subtasks"]').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            toggleSubtasks(taskId);
        });
    });
    
    // Copy spec
    document.querySelectorAll('[data-action="copy-spec"]').forEach(button => {
        button.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            copyTaskSpec(taskId);
        });
    });
    
    // Save spec changes
    document.querySelectorAll('[data-action="save-spec"]').forEach(button => {
        button.addEventListener('click', async function() {
            const taskId = this.getAttribute('data-task-id');
            await saveTaskSpec(taskId);
        });
    });
    
    // Complete task
    document.querySelectorAll('[data-action="complete-task"]').forEach(button => {
        button.addEventListener('click', async function() {
            const taskId = this.getAttribute('data-task-id');
            await toggleTaskCompletionStatus(taskId);
        });
    });
    
    // Handle spec textarea changes
    document.querySelectorAll('.task-spec').forEach(textarea => {
        textarea.addEventListener('input', function() {
            const taskId = this.getAttribute('data-task-id');
            // Mark task as modified (could add visual indicator)
            this.style.borderColor = '#ffa500';
        });
    });
}

function attachFilterEventListeners() {
    // Filter tab clicks
    document.querySelectorAll('.task-filter-tab').forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            setTaskFilter(filter);
        });
    });
}

function setTaskFilter(filter) {
    taskState.currentFilter = filter;
    renderTasks();
}

function toggleTaskDetail(taskId) {
    if (taskState.expandedTasks.has(taskId)) {
        taskState.expandedTasks.delete(taskId);
    } else {
        taskState.expandedTasks.add(taskId);
    }
    
    // Re-render the specific task card
    const task = taskState.tasks.find(t => t.id === taskId);
    if (task) {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
            const isExpanded = taskState.expandedTasks.has(taskId);
            const showSubtasks = taskState.visibleSubtasks.has(taskId);
            
            // Update the task card HTML
            const newHtml = renderTaskCard(task);
            taskCard.outerHTML = newHtml;
            
            // Re-attach event listeners for this card
            attachTaskEventListeners();
        }
    }
}

function toggleSubtasks(taskId) {
    if (taskState.visibleSubtasks.has(taskId)) {
        taskState.visibleSubtasks.delete(taskId);
    } else {
        taskState.visibleSubtasks.add(taskId);
    }
    
    // Re-render the specific task card
    const task = taskState.tasks.find(t => t.id === taskId);
    if (task) {
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
            const newHtml = renderTaskCard(task);
            taskCard.outerHTML = newHtml;
            
            // Re-attach event listeners for this card
            attachTaskEventListeners();
        }
    }
}

function copyTaskSpec(taskId) {
    const task = taskState.tasks.find(t => t.id === taskId);
    if (task) {
        navigator.clipboard.writeText(task.spec).then(() => {
            // Show temporary success message
            const button = document.querySelector(`[data-action="copy-spec"][data-task-id="${taskId}"]`);
            if (button) {
                window.WebviewApi?.ui?.showSuccess(button, 'Copied!');
            }
        }).catch(err => {
            console.error('Failed to copy spec:', err);
            alert('Failed to copy spec to clipboard');
        });
    }
}

async function saveTaskSpec(taskId) {
    const textarea = document.querySelector(`.task-spec[data-task-id="${taskId}"]`);
    const button = document.querySelector(`[data-action="save-spec"][data-task-id="${taskId}"]`);
    
    if (!textarea || !button) return;
    
    const task = taskState.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const hideLoading = window.WebviewApi?.ui?.showLoading(button, 'Saving...');
    
    try {
        // Update the task spec
        task.spec = textarea.value;
        
        // Save using persistence API
        await saveTaskWithPersistence(task);
        
        // Show success feedback
        window.WebviewApi?.ui?.showSuccess(button, 'Saved!');
        textarea.style.borderColor = '#28a745';
        
        // Reset border color after a delay
        setTimeout(() => {
            textarea.style.borderColor = '';
        }, 2000);
        
    } catch (error) {
        console.error('Error saving task spec:', error);
        
        // Revert the spec change
        textarea.value = task.spec;
        textarea.style.borderColor = '#dc3545';
        
        window.WebviewApi?.ui?.showError(button, `Save failed: ${error.message}`);
        
        // Reset border color after a delay
        setTimeout(() => {
            textarea.style.borderColor = '';
        }, 3000);
    } finally {
        if (hideLoading) hideLoading();
    }
}

async function toggleTaskCompletionStatus(taskId) {
    const task = taskState.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const button = document.querySelector(`[data-action="complete-task"][data-task-id="${taskId}"]`);
    if (!button) return;
    
    const hideLoading = window.WebviewApi?.ui?.showLoading(button, 'Updating...');
    
    try {
        // Update the task completion status
        task.isCompleted = !task.isCompleted;
        
        // Save using persistence API
        await saveTaskWithPersistence(task);
        
        // Show success feedback
        window.WebviewApi?.ui?.showSuccess(button, task.isCompleted ? 'Completed!' : 'Marked as pending');
        
        // Re-render tasks to update the UI
        setTimeout(() => {
            renderTasks();
        }, 1000);
        
    } catch (error) {
        console.error('Error updating task completion status:', error);
        
        // Revert the completion status change
        task.isCompleted = !task.isCompleted;
        
        window.WebviewApi?.ui?.showError(button, `Update failed: ${error.message}`);
    } finally {
        if (hideLoading) hideLoading();
    }
}

function showTaskError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('task-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'task-error-message';
        errorDiv.className = 'task-error-message';
        errorDiv.style.color = '#dc3545';
        errorDiv.style.backgroundColor = '#f8d7da';
        errorDiv.style.border = '1px solid #f5c6cb';
        errorDiv.style.padding = '10px';
        errorDiv.style.margin = '10px 0';
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.display = 'none';
        document.querySelector('.task-container')?.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Export functions for potential external use
window.TaskManager = {
    renderTasks: renderTasks,
    toggleTaskDetail: toggleTaskDetail,
    toggleSubtasks: toggleSubtasks,
    copyTaskSpec: copyTaskSpec,
    saveTaskSpec: saveTaskSpec,
    toggleTaskCompletionStatus: toggleTaskCompletionStatus,
    setTaskFilter: setTaskFilter,
    getTasks: () => taskState.tasks,
    getCurrentFilter: () => taskState.currentFilter,
    loadTasksFromPersistence: loadTasksFromPersistence,
    saveTaskWithPersistence: saveTaskWithPersistence,
    addTask: async (task) => {
        try {
            const savedTask = await saveTaskWithPersistence(task);
            renderTasks();
            return savedTask;
        } catch (error) {
            console.error('Error adding task:', error);
            showTaskError(`Failed to add task: ${error.message}`);
            throw error;
        }
    },
    updateTask: async (taskId, updates) => {
        try {
            const task = taskState.tasks.find(t => t.id === taskId);
            if (task) {
                Object.assign(task, updates);
                const savedTask = await saveTaskWithPersistence(task);
                renderTasks();
                return savedTask;
            }
        } catch (error) {
            console.error('Error updating task:', error);
            showTaskError(`Failed to update task: ${error.message}`);
            throw error;
        }
    }
};