// Spec Tab JavaScript - Handles spec rendering and interactions

// Spec management state - now using persistence API
let specState = {
    expandedSpecs: new Set(),
    visibleSubspecs: new Set(),
    specs: [], // Will be loaded from persistence
    currentFilter: 'pending', // 'all', 'pending', 'completed'
    isLoading: false
};

// Initialize spec functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSpecTab();
});

async function initializeSpecTab() {
    // Load specs from persistence
    await loadSpecsFromPersistence();
    
    // Render specs when spec tab is shown
    const specTab = document.getElementById('spec-tab');
    if (specTab) {
        specTab.addEventListener('click', async function() {
            // Show loading state while fetching fresh data
            const specContent = document.getElementById('spec-content');
            if (specContent) {
                const hideLoading = window.WebviewApi?.ui?.showGlobalLoading(specContent, 'Loading specs...');
                try {
                    await loadSpecsFromPersistence();
                    setTimeout(renderSpecs, 100); // Small delay to ensure tab content is visible
                } finally {
                    if (hideLoading) hideLoading();
                }
            }
        });
    }
    
    // Initial render if spec tab is already active
    const specContent = document.getElementById('spec-content');
    if (specContent && specContent.style.display !== 'none') {
        renderSpecs();
    }
}

// Load specs from persistence API
async function loadSpecsFromPersistence() {
    try {
        specState.isLoading = true;
        const specs = await window.WebviewApi.persistence.loadSpecs();
        specState.specs = specs || [];
        calculateHasSubspecs();
        console.log('Specs loaded from persistence:', specState.specs);
    } catch (error) {
        console.error('Error loading specs from persistence:', error);
        showSpecError(`Failed to load specs: ${error.message}`);
        // Keep existing specs if loading fails
    } finally {
        specState.isLoading = false;
    }
}

// Save a spec using persistence API
async function saveSpecWithPersistence(spec) {
    try {
        const savedSpec = await window.WebviewApi.persistence.saveSpec(spec);
        // Update the spec in our local state
        const index = specState.specs.findIndex(s => s.id === spec.id);
        if (index >= 0) {
            specState.specs[index] = savedSpec;
        } else {
            specState.specs.push(savedSpec);
        }
        calculateHasSubspecs();
        return savedSpec;
    } catch (error) {
        console.error('Error saving spec:', error);
        throw error;
    }
}

function calculateHasSubspecs() {
    // Reset hasSubspecs for all specs
    specState.specs.forEach(spec => {
        spec.hasSubspecs = false;
    });
    
    // Calculate hasSubspecs based on parentSpecId relationships
    specState.specs.forEach(spec => {
        if (spec.parentSpecId) {
            const parentSpec = specState.specs.find(s => s.id === spec.parentSpecId);
            if (parentSpec) {
                parentSpec.hasSubspecs = true;
            }
        }
    });
}

function renderSpecs() {
    const specContent = document.getElementById('spec-content');
    if (!specContent) {
        return;
    }
    
    // Show loading state if specs are being loaded
    if (specState.isLoading) {
        specContent.innerHTML = `
            <div class="spec-container">
                <div class="spec-header">
                    <h3>Task Management</h3>
                </div>
                <div class="spec-loading">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <div class="loading-text">Loading specs...</div>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    // Get top-level specs (depth 1) and apply filter
    let topLevelSpecs = specState.specs.filter(spec => spec.depth === 1);
    
    // Apply current filter
    if (specState.currentFilter === 'pending') {
        topLevelSpecs = topLevelSpecs.filter(spec => !spec.isCompleted);
    } else if (specState.currentFilter === 'completed') {
        topLevelSpecs = topLevelSpecs.filter(spec => spec.isCompleted);
    }
    
    // Calculate stats for all specs (not filtered)
    const allTopLevelSpecs = specState.specs.filter(spec => spec.depth === 1);
    const pendingCount = allTopLevelSpecs.filter(spec => !spec.isCompleted).length;
    const completedCount = allTopLevelSpecs.filter(spec => spec.isCompleted).length;
    
    if (topLevelSpecs.length === 0) {
        const emptyMessage = specState.currentFilter === 'all' ? 'No specs available' :
                           specState.currentFilter === 'pending' ? 'No pending specs' :
                           'No completed specs';
        specContent.innerHTML = `
            <div class="spec-container">
                <div class="spec-header">
                    <h3>Task Management</h3>
                    <div class="spec-stats">
                        <span>${allTopLevelSpecs.length} specs</span>
                    </div>
                </div>
                <div class="spec-filter-tabs">
                    <button class="spec-filter-tab ${specState.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                        All (${allTopLevelSpecs.length})
                    </button>
                    <button class="spec-filter-tab ${specState.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">
                        Pending (${pendingCount})
                    </button>
                    <button class="spec-filter-tab ${specState.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
                        Completed (${completedCount})
                    </button>
                </div>
                <div class="spec-empty">
                    <h4>${emptyMessage}</h4>
                    <p>Create your first spec to get started.</p>
                </div>
            </div>
        `;
        attachFilterEventListeners();
        return;
    }
    
    const specListHtml = topLevelSpecs.map(spec => renderSpecCard(spec)).join('');
    
    specContent.innerHTML = `
        <div class="spec-container">
            <div class="spec-header">
                <h3>Spec Management</h3>
                <div class="spec-stats">
                    <span>${topLevelSpecs.length} of ${allTopLevelSpecs.length} specs</span>
                </div>
            </div>
            <div class="spec-filter-tabs">
                <button class="spec-filter-tab ${specState.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                    All (${allTopLevelSpecs.length})
                </button>
                <button class="spec-filter-tab ${specState.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">
                    Pending (${pendingCount})
                </button>
                <button class="spec-filter-tab ${specState.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
                    Completed (${completedCount})
                </button>
            </div>
            <div class="spec-list">
                ${specListHtml}
            </div>
        </div>
    `;
    
    // Attach event listeners
    attachSpecEventListeners();
    attachFilterEventListeners();
}

function renderSpecCard(spec) {
    const isExpanded = specState.expandedSpecs.has(spec.id);
    const showSubspecs = specState.visibleSubspecs.has(spec.id);
    const statusClass = spec.isCompleted ? 'completed' : 'pending';
    const statusText = spec.isCompleted ? 'Completed' : 'Pending';
    
    const subspecsHtml = showSubspecs ? renderSubspecs(spec.id) : '';
    
    return `
        <div class="spec-card ${isExpanded ? 'expanded' : ''}" data-spec-id="${spec.id}">
            <div class="spec-header-content">
                <h4 class="spec-title">${spec.title}</h4>
                <span class="spec-status ${statusClass}">${statusText}</span>
            </div>
            
            <div class="spec-actions">
                <button class="spec-btn" data-action="toggle-detail" data-spec-id="${spec.id}">
                    ${isExpanded ? 'Hide Details' : 'Show Details'}
                </button>
                <button class="spec-btn" data-action="copy-all-spec" data-spec-id="${spec.id}">
                    Copy All Spec
                </button>
                ${spec.hasSubspecs ? `
                    <button class="spec-btn secondary" data-action="toggle-subspecs" data-spec-id="${spec.id}">
                        ${showSubspecs ? 'Hide Subspecs' : 'Show Subspecs'}
                    </button>
                ` : ''}
                <button class="spec-btn code-review-btn" data-action="code-review" data-spec-id="${spec.id}">
                    Code Review
                </button>
            </div>
            
            <div class="spec-detail ${isExpanded ? 'expanded' : ''}">
                <textarea class="spec-spec" data-spec-id="${spec.id}" placeholder="Task specification...">${spec.spec}</textarea>
                <div class="spec-detail-actions">
                    <button class="spec-btn" data-action="copy-spec" data-spec-id="${spec.id}">Copy Spec</button>
                    <button class="spec-btn secondary" data-action="save-spec" data-spec-id="${spec.id}">Save Changes</button>
                    ${!spec.isCompleted ? `<button class="spec-btn success" data-action="complete-spec" data-spec-id="${spec.id}">Completed</button>` : ''}
                </div>
            </div>
            
            ${subspecsHtml}
        </div>
    `;
}

function renderSubspecs(parentSpecId) {
    const subspecs = specState.specs.filter(spec => spec.parentSpecId === parentSpecId);
    
    if (subspecs.length === 0) {
        return '';
    }
    
    const subspecCards = subspecs.map(subspec => renderSubspecCard(subspec)).join('');
    
    return `
        <div class="subspec-container">
            <div class="subspec-list">
                ${subspecCards}
            </div>
        </div>
    `;
}

function renderSubspecCard(spec) {
    const isExpanded = specState.expandedSpecs.has(spec.id);
    const statusClass = spec.isCompleted ? 'completed' : 'pending';
    const statusText = spec.isCompleted ? 'Completed' : 'Pending';
    
    return `
        <div class="subspec-card" data-spec-id="${spec.id}">
            <div class="spec-header-content">
                <h4 class="spec-title">${spec.title}</h4>
                <span class="spec-status ${statusClass}">${statusText}</span>
            </div>
            
            <div class="spec-actions">
                <button class="spec-btn" data-action="toggle-detail" data-spec-id="${spec.id}">
                    ${isExpanded ? 'Hide Details' : 'Show Details'}
                </button>
                <button class="spec-btn code-review-btn" data-action="code-review" data-spec-id="${spec.id}">
                    Code Review
                </button>
            </div>
            
            <div class="spec-detail ${isExpanded ? 'expanded' : ''}">
                <textarea class="spec-spec" data-spec-id="${spec.id}" placeholder="Task specification...">${spec.spec}</textarea>
                <div class="spec-detail-actions">
                    <button class="spec-btn" data-action="copy-spec" data-spec-id="${spec.id}">Copy Spec</button>
                    <button class="spec-btn secondary" data-action="save-spec" data-spec-id="${spec.id}">Save Changes</button>
                    ${!spec.isCompleted ? `<button class="spec-btn success" data-action="complete-spec" data-spec-id="${spec.id}">Completed</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function attachSpecEventListeners() {
    // Toggle spec detail
    document.querySelectorAll('[data-action="toggle-detail"]').forEach(button => {
        button.addEventListener('click', function() {
            const specId = this.getAttribute('data-spec-id');
            toggleSpecDetail(specId);
        });
    });
    
    // Toggle subspecs
    document.querySelectorAll('[data-action="toggle-subspecs"]').forEach(button => {
        button.addEventListener('click', function() {
            const specId = this.getAttribute('data-spec-id');
            toggleSubspecs(specId);
        });
    });
    
    // Copy spec
    document.querySelectorAll('[data-action="copy-spec"]').forEach(button => {
        button.addEventListener('click', function() {
            const specId = this.getAttribute('data-spec-id');
            copySpec(specId);
        });
    });
    
    // Copy all spec and descendants
    document.querySelectorAll('[data-action="copy-all-spec"]').forEach(button => {
        button.addEventListener('click', async function() {
            const specId = this.getAttribute('data-spec-id');
            await copyAllSpecAndDescendants(specId);
        });
    });
    
    // Save spec changes
    document.querySelectorAll('[data-action="save-spec"]').forEach(button => {
        button.addEventListener('click', async function() {
            const specId = this.getAttribute('data-spec-id');
            await saveSpec(specId);
        });
    });
    
    // Complete spec
    document.querySelectorAll('[data-action="complete-spec"]').forEach(button => {
        button.addEventListener('click', async function() {
            const specId = this.getAttribute('data-spec-id');
            await toggleSpecCompletionStatus(specId);
        });
    });
    
    // Code review
    document.querySelectorAll('[data-action="code-review"]').forEach(button => {
        button.addEventListener('click', async function() {
            const specId = this.getAttribute('data-spec-id');
            await handleCodeReviewClick(specId);
        });
    });
    
    // Handle spec textarea changes
    document.querySelectorAll('.spec-spec').forEach(textarea => {
        textarea.addEventListener('input', function() {
            const specId = this.getAttribute('data-spec-id');
            // Mark spec as modified (could add visual indicator)
            this.style.borderColor = '#ffa500';
        });
    });
}

function attachFilterEventListeners() {
    // Filter tab clicks
    document.querySelectorAll('.spec-filter-tab').forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            setSpecFilter(filter);
        });
    });
}

function setSpecFilter(filter) {
    specState.currentFilter = filter;
    renderSpecs();
}

function toggleSpecDetail(specId) {
    if (specState.expandedSpecs.has(specId)) {
        specState.expandedSpecs.delete(specId);
    } else {
        specState.expandedSpecs.add(specId);
    }
    
    // Re-render the specific spec card
    const spec = specState.specs.find(s => s.id === specId);
    if (spec) {
        // Check if it's a top-level spec or subspec
        const specCard = document.querySelector(`.spec-card[data-spec-id="${specId}"], .subspec-card[data-spec-id="${specId}"]`);
        if (specCard) {
            const isExpanded = specState.expandedSpecs.has(specId);
            const showSubspecs = specState.visibleSubspecs.has(specId);
            
            // Update the spec card HTML
            const newHtml = spec.parentSpecId ? renderSubspecCard(spec) : renderSpecCard(spec);
            specCard.outerHTML = newHtml;
            
            // Re-attach event listeners for this card
            attachSpecEventListeners();
        }
    }
}

function toggleSubspecs(specId) {
    if (specState.visibleSubspecs.has(specId)) {
        specState.visibleSubspecs.delete(specId);
    } else {
        specState.visibleSubspecs.add(specId);
    }
    
    // Re-render the specific spec card
    const spec = specState.specs.find(s => s.id === specId);
    if (spec) {
        const specCard = document.querySelector(`.spec-card[data-spec-id="${specId}"]`);
        if (specCard) {
            const newHtml = renderSpecCard(spec);
            specCard.outerHTML = newHtml;
            
            // Re-attach event listeners for this card
            attachSpecEventListeners();
        }
    }
}

function copySpec(specId) {
    const spec = specState.specs.find(s => s.id === specId);
    if (spec) {
        navigator.clipboard.writeText(spec.spec).then(() => {
            // Show temporary success message
            const button = document.querySelector(`[data-action="copy-spec"][data-spec-id="${specId}"]`);
            if (button) {
                window.WebviewApi?.ui?.showSuccess(button, 'Copied!');
            }
        }).catch(err => {
            console.error('Failed to copy spec:', err);
            alert('Failed to copy spec to clipboard');
        });
    }
}

async function copyAllSpecAndDescendants(specId) {
    try {
        // Load spec and all descendants
        const specs = await loadSpecAndDescendants(specId);
        
        if (!specs || specs.length === 0) {
            console.error('No specs found for specId:', specId);
            return;
        }
        
        // Format specs hierarchically in markdown
        const formattedContent = formatSpecsHierarchically(specs, specId);
        
        // Copy to clipboard
        await navigator.clipboard.writeText(formattedContent);
        
        // Show success message
        const button = document.querySelector(`[data-action="copy-all-spec"][data-spec-id="${specId}"]`);
        if (button) {
            window.WebviewApi?.ui?.showSuccess(button, 'Copied All Specs!');
        }
    } catch (err) {
        console.error('Failed to copy all specs:', err);
        alert('Failed to copy all specs to clipboard');
    }
}

function formatSpecsHierarchically(specs, rootSpecId) {
    // Build a map of specs by id for easy lookup
    const specMap = new Map(specs.map(spec => [spec.id, spec]));
    
    // Build children map
    const childrenMap = new Map();
    specs.forEach(spec => {
        if (spec.parentSpecId) {
            if (!childrenMap.has(spec.parentSpecId)) {
                childrenMap.set(spec.parentSpecId, []);
            }
            childrenMap.get(spec.parentSpecId).push(spec);
        }
    });
    
    // Recursive function to format specs depth-first
    function formatSpecRecursively(specId, depth) {
        const spec = specMap.get(specId);
        if (!spec) return '';
        
        // Create markdown heading based on depth
        const heading = '#'.repeat(depth);
        let result = `${heading} ${spec.title}\n${spec.spec}\n\n`;
        
        // Recursively format children
        const children = childrenMap.get(specId) || [];
        children.forEach(child => {
            result += formatSpecRecursively(child.id, depth + 1);
        });
        
        return result;
    }
    
    // Start with root spec at depth 1
    return formatSpecRecursively(rootSpecId, 1);
}

async function saveSpec(specId) {
    const textarea = document.querySelector(`.spec-spec[data-spec-id="${specId}"]`);
    const button = document.querySelector(`[data-action="save-spec"][data-spec-id="${specId}"]`);
    
    if (!textarea || !button) return;
    
    const spec = specState.specs.find(s => s.id === specId);
    if (!spec) return;
    
    const hideLoading = window.WebviewApi?.ui?.showLoading(button, 'Saving...');
    
    try {
        // Update the spec spec
        spec.spec = textarea.value;
        
        // Save using persistence API
        await saveSpecWithPersistence(spec);
        
        // Show success feedback
        window.WebviewApi?.ui?.showSuccess(button, 'Saved!');
        textarea.style.borderColor = '#28a745';
        
        // Reset border color after a delay
        setTimeout(() => {
            textarea.style.borderColor = '';
        }, 2000);
        
    } catch (error) {
        console.error('Error saving spec spec:', error);
        
        // Revert the spec change
        textarea.value = spec.spec;
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

async function toggleSpecCompletionStatus(specId) {
    const spec = specState.specs.find(s => s.id === specId);
    if (!spec) return;
    
    const button = document.querySelector(`[data-action="complete-spec"][data-spec-id="${specId}"]`);
    if (!button) return;
    
    const hideLoading = window.WebviewApi?.ui?.showLoading(button, 'Updating...');
    
    try {
        // Update the spec completion status
        spec.isCompleted = !spec.isCompleted;
        
        // Save using persistence API
        await saveSpecWithPersistence(spec);
        
        // Show success feedback
        window.WebviewApi?.ui?.showSuccess(button, spec.isCompleted ? 'Completed!' : 'Marked as pending');
        
        // Re-render specs to update the UI
        setTimeout(() => {
            renderSpecs();
        }, 1000);
        
    } catch (error) {
        console.error('Error updating spec completion status:', error);
        
        // Revert the completion status change
        spec.isCompleted = !spec.isCompleted;
        
        window.WebviewApi?.ui?.showError(button, `Update failed: ${error.message}`);
    } finally {
        if (hideLoading) hideLoading();
    }
}

function showSpecError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('spec-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'spec-error-message';
        errorDiv.className = 'spec-error-message';
        errorDiv.style.display = 'none';
        document.querySelector('.spec-container')?.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// ============ Code Review Functionality ============

/**
 * Handles the Code Review button click
 */
async function handleCodeReviewClick(specId) {
    try {
        // Load the spec and all its descendants
        const specsToReview = await loadSpecAndDescendants(specId);
        
        if (!specsToReview || specsToReview.length === 0) {
            showSpecError('No specs found for code review');
            return;
        }
        
        // Show confirmation modal
        showCodeReviewConfirmationModal(specsToReview);
    } catch (error) {
        console.error('Error initiating code review:', error);
        showSpecError(`Failed to initiate code review: ${error.message}`);
    }
}

/**
 * Loads a spec and all its descendants recursively
 */
async function loadSpecAndDescendants(specId) {
    const result = [];
    const visited = new Set();
    
    // Find the root spec
    const rootSpec = specState.specs.find(s => s.id === specId);
    if (!rootSpec) {
        return result;
    }
    
    // Add root spec
    result.push(rootSpec);
    visited.add(specId);
    
    // Recursively find all descendants using BFS
    const queue = [specId];
    
    while (queue.length > 0) {
        const currentId = queue.shift();
        
        // Find all children of current spec
        const children = specState.specs.filter(s => s.parentSpecId === currentId);
        
        for (const child of children) {
            if (!visited.has(child.id)) {
                result.push(child);
                visited.add(child.id);
                queue.push(child.id);
            }
        }
    }
    
    return result;
}

/**
 * Shows the code review confirmation modal
 */
function showCodeReviewConfirmationModal(specsToReview) {
    // Remove any existing modal
    const existingModal = document.getElementById('code-review-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Build spec list HTML
    const specListHtml = specsToReview.map(spec => {
        const indent = spec.depth > 1 ? `style="padding-left: ${(spec.depth - 1) * 20}px;"` : '';
        return `<li ${indent}>${spec.title}</li>`;
    }).join('');
    
    // Create modal HTML
    const modalHtml = `
        <div id="code-review-modal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Confirm Code Review</h3>
                    <button class="modal-close" data-action="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <p>The following specifications will be included in the code review:</p>
                    <ul class="spec-review-list">
                        ${specListHtml}
                    </ul>
                    <p class="modal-note">Total: ${specsToReview.length} specification${specsToReview.length > 1 ? 's' : ''}</p>
                </div>
                <div class="modal-footer">
                    <button class="spec-btn secondary" data-action="cancel-review">Cancel</button>
                    <button class="spec-btn code-review-confirm-btn" data-action="confirm-review">Confirm Code Review</button>
                </div>
            </div>
        </div>
    `;
    
    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Attach event listeners
    const modal = document.getElementById('code-review-modal');
    
    // Close modal on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCodeReviewModal();
        }
    });
    
    // Close button
    modal.querySelector('[data-action="close-modal"]').addEventListener('click', closeCodeReviewModal);
    
    // Cancel button
    modal.querySelector('[data-action="cancel-review"]').addEventListener('click', closeCodeReviewModal);
    
    // Confirm button
    modal.querySelector('[data-action="confirm-review"]').addEventListener('click', async function() {
        closeCodeReviewModal();
        await sendCodeReviewMessage(specsToReview);
    });
}

/**
 * Closes the code review modal
 */
function closeCodeReviewModal() {
    const modal = document.getElementById('code-review-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Sends the code review message to chat and switches tabs
 */
async function sendCodeReviewMessage(specsToReview) {
    try {
        // Build the formatted message
        let messageContent = "Attention required: Please read the latest code and then please conduct a thorough code review.  Verify the latest codebase against the following specifications to ensure accurate and complete implementation:\n\n";
        
        // Add each spec to the message
        specsToReview.forEach((spec, index) => {
            messageContent += `**${spec.title}**\n\n`;
            messageContent += "```\n";
            messageContent += spec.spec || '(No specification content)';
            messageContent += "\n```\n\n";
        });
        
        // Get current session from project settings
        const projectSettings = await window.WebviewApi.persistence.loadProjectSettings();
        if (!projectSettings || !projectSettings.currentSessionId) {
            showSpecError('No active session found. Please start a chat session first.');
            return;
        }
        
        // Load the current session
        const currentSession = await window.WebviewApi.persistence.loadSession(projectSettings.currentSessionId);
        if (!currentSession) {
            showSpecError('Failed to load current session.');
            return;
        }
        
        // Switch to chat tab first
        if (window.WebviewApi?.ui?.switchTab) {
            window.WebviewApi.ui.switchTab('chat');
        } else {
            // Fallback: manually trigger tab click
            const chatTab = document.getElementById('chat-tab');
            if (chatTab) {
                chatTab.click();
            }
        }
        
        // Small delay to ensure tab switch and chat UI are ready
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Create user message object (same as chat.js does)
        const userMessage = {
            id: `user-${Date.now()}`,
            sessionId: currentSession.id,
            projectId: projectSettings.projectId,
            type: 'user',
            role: 'user',
            content: messageContent,
            metadata: {}
        };
        
        // Display the user message immediately in chat
        if (window.ChatManager && typeof window.ChatManager.displayMessage === 'function') {
            window.ChatManager.displayMessage(userMessage);
        }
        
        // Save the message to persistence
        try {
            await window.WebviewApi.persistence.saveChatMessage({
                sessionId: currentSession.id,
                projectId: projectSettings.projectId,
                type: userMessage.type,
                content: userMessage.content,
                role: userMessage.role,
                metadata: userMessage.metadata
            });
        } catch (saveError) {
            console.warn('Failed to save message to persistence:', saveError);
            // Continue anyway - the message is displayed
        }
        
        // Add "Thinking..." indicator
        const chatMessagesElement = document.getElementById('chatMessages');
        const pendingIndicator = document.createElement('div');
        pendingIndicator.className = 'assistant-message pending';
        pendingIndicator.id = 'code-review-pending';
        pendingIndicator.textContent = 'Analyzing code against specifications...';
        
        if (chatMessagesElement) {
            chatMessagesElement.appendChild(pendingIndicator);
            chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
        }
        
        // Send to agent for processing (with userMessage object for proper tracking)
        if (window.WebviewApi?.agent?.execute) {
            try {
                await window.WebviewApi.agent.execute({
                    userMessage: userMessage,
                    session: currentSession,
                    message: messageContent
                });
                
                // Remove pending indicator
                const indicator = document.getElementById('code-review-pending');
                if (indicator && indicator.parentElement) {
                    indicator.parentElement.removeChild(indicator);
                }
            } catch (executeError) {
                console.error('Agent execution error:', executeError);
                
                // Remove pending indicator
                const indicator = document.getElementById('code-review-pending');
                if (indicator && indicator.parentElement) {
                    indicator.parentElement.removeChild(indicator);
                }
                
                // Show error in chat
                if (window.ChatManager && typeof window.ChatManager.displayMessage === 'function') {
                    window.ChatManager.displayMessage({
                        id: `error-${Date.now()}`,
                        sessionId: currentSession.id,
                        projectId: projectSettings.projectId,
                        type: 'error',
                        role: 'assistant',
                        content: `Error: ${executeError.message || 'Failed to execute code review'}`,
                        metadata: { error: executeError }
                    });
                }
            }
        } else {
            console.error('WebviewApi.agent.execute is not available');
            
            // Remove pending indicator
            const indicator = document.getElementById('code-review-pending');
            if (indicator && indicator.parentElement) {
                indicator.parentElement.removeChild(indicator);
            }
            
            showSpecError('Failed to send code review message: Agent API not available');
            return;
        }
        
    } catch (error) {
        console.error('Error sending code review message:', error);
        showSpecError(`Failed to send code review message: ${error.message}`);
    }
}

// ============ End Code Review Functionality ============

// Export functions for potential external use
window.SpecManager = {
    renderSpecs: renderSpecs,
    toggleSpecDetail: toggleSpecDetail,
    toggleSubspecs: toggleSubspecs,
    copySpec: copySpec,
    copyAllSpecAndDescendants: copyAllSpecAndDescendants,
    saveSpec: saveSpec,
    toggleSpecCompletionStatus: toggleSpecCompletionStatus,
    setSpecFilter: setSpecFilter,
    getSpecs: () => specState.specs,
    getCurrentFilter: () => specState.currentFilter,
    loadSpecsFromPersistence: loadSpecsFromPersistence,
    saveSpecWithPersistence: saveSpecWithPersistence,
    handleCodeReviewClick: handleCodeReviewClick,
    addSpec: async (spec) => {
        try {
            const savedSpec = await saveSpecWithPersistence(spec);
            renderSpecs();
            return savedSpec;
        } catch (error) {
            console.error('Error adding spec:', error);
            showSpecError(`Failed to add spec: ${error.message}`);
            throw error;
        }
    },
    updateSpec: async (specId, updates) => {
        try {
            const spec = specState.specs.find(s => s.id === specId);
            if (spec) {
                Object.assign(spec, updates);
                const savedSpec = await saveSpecWithPersistence(spec);
                renderSpecs();
                return savedSpec;
            }
        } catch (error) {
            console.error('Error updating spec:', error);
            showSpecError(`Failed to update spec: ${error.message}`);
            throw error;
        }
    }
};