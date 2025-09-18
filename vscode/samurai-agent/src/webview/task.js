// Task Tab JavaScript - Handles task rendering and interactions

// Placeholder task data
const placeholderTasks = [
    {
        id: 'task-1',
        title: 'Implement User Authentication System',
        spec: 'Create a comprehensive user authentication system with the following features:\n\n1. User registration with email verification\n2. Secure login with JWT tokens\n3. Password reset functionality\n4. Role-based access control (Admin, User, Guest)\n5. Session management\n6. Two-factor authentication (2FA) support\n7. OAuth integration (Google, GitHub)\n8. Account lockout after failed attempts\n9. Password strength validation\n10. Audit logging for security events\n\nTechnical Requirements:\n- Use bcrypt for password hashing\n- Implement rate limiting for login attempts\n- Store sessions in Redis\n- Use HTTPS for all authentication endpoints\n- Follow OWASP security guidelines',
        hasSubtasks: true,
        isCompleted: false,
        parentTaskId: null,
        depth: 0
    },
    {
        id: 'task-1-1',
        title: 'Set up authentication database schema',
        spec: 'Design and implement the database schema for user authentication:\n\nTables needed:\n- users (id, email, password_hash, created_at, updated_at, email_verified)\n- user_roles (user_id, role_id)\n- roles (id, name, permissions)\n- user_sessions (id, user_id, token, expires_at, created_at)\n- password_resets (id, user_id, token, expires_at, created_at)\n- login_attempts (id, email, ip_address, success, created_at)\n\nIndexes:\n- Unique index on users.email\n- Index on user_sessions.token\n- Index on password_resets.token\n- Index on login_attempts.email and created_at',
        hasSubtasks: false,
        isCompleted: false,
        parentTaskId: 'task-1',
        depth: 1
    },
    {
        id: 'task-1-2',
        title: 'Implement JWT token management',
        spec: 'Create JWT token management system:\n\nFeatures:\n- Generate access tokens (15 min expiry)\n- Generate refresh tokens (7 days expiry)\n- Token refresh endpoint\n- Token blacklisting for logout\n- Token validation middleware\n\nSecurity considerations:\n- Use strong secret keys\n- Implement token rotation\n- Store refresh tokens securely\n- Add token fingerprinting\n- Implement rate limiting on refresh endpoint',
        hasSubtasks: false,
        isCompleted: false,
        parentTaskId: 'task-1',
        depth: 1
    },
    {
        id: 'task-1-3',
        title: 'Create authentication API endpoints',
        spec: 'Implement REST API endpoints for authentication:\n\nEndpoints:\n- POST /auth/register - User registration\n- POST /auth/login - User login\n- POST /auth/logout - User logout\n- POST /auth/refresh - Token refresh\n- POST /auth/forgot-password - Password reset request\n- POST /auth/reset-password - Password reset confirmation\n- POST /auth/verify-email - Email verification\n- GET /auth/me - Get current user info\n\nRequest/Response formats:\n- Use JSON for all requests/responses\n- Include proper HTTP status codes\n- Implement request validation\n- Add rate limiting\n- Include CORS headers',
        hasSubtasks: false,
        isCompleted: false,
        parentTaskId: 'task-1',
        depth: 1
    },
    {
        id: 'task-2',
        title: 'Build Real-time Chat System',
        spec: 'Develop a real-time chat system with the following capabilities:\n\nCore Features:\n1. Real-time messaging using WebSockets\n2. Multiple chat rooms/channels\n3. Private direct messages\n4. Message history and persistence\n5. File and image sharing\n6. Emoji reactions and mentions\n7. Message search and filtering\n8. Online user status indicators\n9. Message threading and replies\n10. Chat moderation tools\n\nTechnical Implementation:\n- Use Socket.IO for WebSocket connections\n- Implement message queuing with Redis\n- Store messages in MongoDB with proper indexing\n- Add message encryption for sensitive chats\n- Implement rate limiting for message sending\n- Add message delivery receipts\n- Support for message editing and deletion\n- Implement chat room permissions and roles',
        hasSubtasks: true,
        isCompleted: false,
        parentTaskId: null,
        depth: 0
    },
    {
        id: 'task-2-1',
        title: 'Set up WebSocket server infrastructure',
        spec: 'Configure WebSocket server for real-time communication:\n\nSetup requirements:\n- Install and configure Socket.IO\n- Set up Redis adapter for scaling\n- Configure CORS for cross-origin requests\n- Implement connection authentication\n- Add connection rate limiting\n- Set up connection monitoring\n- Configure SSL/TLS for secure connections\n\nEvent handling:\n- Connection/disconnection events\n- Join/leave room events\n- Message broadcasting\n- Error handling and reconnection\n- Heartbeat/ping-pong for connection health',
        hasSubtasks: false,
        isCompleted: false,
        parentTaskId: 'task-2',
        depth: 1
    },
    {
        id: 'task-2-2',
        title: 'Design chat message data model',
        spec: 'Create data models for chat messages and rooms:\n\nMessage Schema:\n- id: unique message identifier\n- roomId: chat room identifier\n- userId: sender user ID\n- content: message text content\n- type: message type (text, image, file, system)\n- timestamp: creation timestamp\n- editedAt: last edit timestamp\n- replyTo: parent message ID for threading\n- reactions: emoji reactions object\n- metadata: additional message data\n\nRoom Schema:\n- id: unique room identifier\n- name: room display name\n- type: room type (public, private, direct)\n- members: array of member user IDs\n- permissions: room-specific permissions\n- settings: room configuration\n- createdAt: creation timestamp',
        hasSubtasks: false,
        isCompleted: false,
        parentTaskId: 'task-2',
        depth: 1
    },
    {
        id: 'task-2-3',
        title: 'Implement message persistence and retrieval',
        spec: 'Build message storage and retrieval system:\n\nDatabase operations:\n- Store messages with proper indexing\n- Implement message pagination\n- Add message search functionality\n- Handle message updates and deletions\n- Implement message archiving\n- Add message backup and recovery\n\nPerformance optimizations:\n- Use database indexes for fast queries\n- Implement message caching with Redis\n- Add database connection pooling\n- Optimize query performance\n- Implement lazy loading for message history\n- Add message compression for storage',
        hasSubtasks: false,
        isCompleted: false,
        parentTaskId: 'task-2',
        depth: 1
    },
    {
        id: 'task-3',
        title: 'Setup Development Environment',
        spec: 'Set up the complete development environment for the project:\n\n1. Install Node.js and npm\n2. Configure VS Code with recommended extensions\n3. Set up Git repository and branching strategy\n4. Configure ESLint and Prettier\n5. Set up testing framework (Jest/Mocha)\n6. Configure build tools (Webpack/Vite)\n7. Set up CI/CD pipeline\n8. Configure environment variables\n9. Set up database connections\n10. Configure logging and monitoring\n\nThis task should be completed before starting any development work.',
        hasSubtasks: true,
        isCompleted: true,
        parentTaskId: null,
        depth: 0
    },
    {
        id: 'task-3-1',
        title: 'Install and configure Node.js',
        spec: 'Install Node.js LTS version and configure npm:\n\n- Download and install Node.js LTS from official website\n- Verify installation with node --version and npm --version\n- Configure npm registry if needed\n- Set up npm scripts in package.json\n- Install global packages: nodemon, typescript, eslint\n- Configure .nvmrc file for Node version management',
        hasSubtasks: false,
        isCompleted: true,
        parentTaskId: 'task-3',
        depth: 1
    },
    {
        id: 'task-3-2',
        title: 'Configure VS Code workspace',
        spec: 'Set up VS Code with all necessary extensions and settings:\n\nExtensions to install:\n- ES7+ React/Redux/React-Native snippets\n- Prettier - Code formatter\n- ESLint\n- GitLens\n- Auto Rename Tag\n- Bracket Pair Colorizer\n- Path Intellisense\n\nSettings to configure:\n- Format on save\n- Auto-save enabled\n- Tab size: 2 spaces\n- Font family and size preferences\n- Theme selection',
        hasSubtasks: false,
        isCompleted: true,
        parentTaskId: 'task-3',
        depth: 1
    },
    {
        id: 'task-3-3',
        title: 'Set up Git repository',
        spec: 'Initialize Git repository and configure branching strategy:\n\n- Initialize git repository with git init\n- Create .gitignore file for Node.js projects\n- Set up remote repository (GitHub/GitLab)\n- Configure branch protection rules\n- Set up branching strategy (main, develop, feature branches)\n- Configure commit message conventions\n- Set up pre-commit hooks\n- Add initial commit with project structure',
        hasSubtasks: false,
        isCompleted: true,
        parentTaskId: 'task-3',
        depth: 1
    }
];

// Task management state
let taskState = {
    expandedTasks: new Set(),
    visibleSubtasks: new Set(),
    tasks: [...placeholderTasks],
    currentFilter: 'all' // 'all', 'pending', 'completed'
};

// Initialize task functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeTaskTab();
});

function initializeTaskTab() {
    // Calculate hasSubtasks property for all tasks
    calculateHasSubtasks();
    
    // Render tasks when task tab is shown
    const taskTab = document.getElementById('task-tab');
    if (taskTab) {
        taskTab.addEventListener('click', function() {
            setTimeout(renderTasks, 100); // Small delay to ensure tab content is visible
        });
    }
    
    // Initial render if task tab is already active
    const taskContent = document.getElementById('task-content');
    if (taskContent && taskContent.style.display !== 'none') {
        renderTasks();
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
    if (!taskContent) return;
    
    // Get top-level tasks (depth 0) and apply filter
    let topLevelTasks = taskState.tasks.filter(task => task.depth === 0);
    
    // Apply current filter
    if (taskState.currentFilter === 'pending') {
        topLevelTasks = topLevelTasks.filter(task => !task.isCompleted);
    } else if (taskState.currentFilter === 'completed') {
        topLevelTasks = topLevelTasks.filter(task => task.isCompleted);
    }
    
    // Calculate stats for all tasks (not filtered)
    const allTopLevelTasks = taskState.tasks.filter(task => task.depth === 0);
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
        button.addEventListener('click', function() {
            const taskId = this.getAttribute('data-task-id');
            saveTaskSpec(taskId);
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
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy spec:', err);
            alert('Failed to copy spec to clipboard');
        });
    }
}

function saveTaskSpec(taskId) {
    const textarea = document.querySelector(`.task-spec[data-task-id="${taskId}"]`);
    if (textarea) {
        const task = taskState.tasks.find(t => t.id === taskId);
        if (task) {
            task.spec = textarea.value;
            
            // Show success message
            const button = document.querySelector(`[data-action="save-spec"][data-task-id="${taskId}"]`);
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Saved!';
                button.style.backgroundColor = '#28a745';
                textarea.style.borderColor = '#28a745';
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.backgroundColor = '';
                    textarea.style.borderColor = '';
                }, 2000);
            }
        }
    }
}

// Export functions for potential external use
window.TaskManager = {
    renderTasks: renderTasks,
    toggleTaskDetail: toggleTaskDetail,
    toggleSubtasks: toggleSubtasks,
    copyTaskSpec: copyTaskSpec,
    saveTaskSpec: saveTaskSpec,
    setTaskFilter: setTaskFilter,
    getTasks: () => taskState.tasks,
    getCurrentFilter: () => taskState.currentFilter,
    addTask: (task) => {
        taskState.tasks.push(task);
        calculateHasSubtasks();
        renderTasks();
    },
    updateTask: (taskId, updates) => {
        const task = taskState.tasks.find(t => t.id === taskId);
        if (task) {
            Object.assign(task, updates);
            calculateHasSubtasks();
            renderTasks();
        }
    }
};
