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
                ${spec.hasSubspecs ? `
                    <button class="spec-btn secondary" data-action="toggle-subspecs" data-spec-id="${spec.id}">
                        ${showSubspecs ? 'Hide Subspecs' : 'Show Subspecs'}
                    </button>
                ` : ''}
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
            toggleTaskDetail(specId);
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
            copyTaskSpec(specId);
        });
    });
    
    // Save spec changes
    document.querySelectorAll('[data-action="save-spec"]').forEach(button => {
        button.addEventListener('click', async function() {
            const specId = this.getAttribute('data-spec-id');
            await saveTaskSpec(specId);
        });
    });
    
    // Complete spec
    document.querySelectorAll('[data-action="complete-spec"]').forEach(button => {
        button.addEventListener('click', async function() {
            const specId = this.getAttribute('data-spec-id');
            await toggleTaskCompletionStatus(specId);
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
        const specCard = document.querySelector(`[data-spec-id="${specId}"]`);
        if (specCard) {
            const isExpanded = specState.expandedSpecs.has(specId);
            const showSubspecs = specState.visibleSubspecs.has(specId);
            
            // Update the spec card HTML
            const newHtml = renderTaskCard(spec);
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
        const specCard = document.querySelector(`[data-spec-id="${specId}"]`);
        if (specCard) {
            const newHtml = renderTaskCard(spec);
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
        await saveTaskWithPersistence(spec);
        
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
        await saveTaskWithPersistence(spec);
        
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
        errorDiv.style.color = '#dc3545';
        errorDiv.style.backgroundColor = '#f8d7da';
        errorDiv.style.border = '1px solid #f5c6cb';
        errorDiv.style.padding = '10px';
        errorDiv.style.margin = '10px 0';
        errorDiv.style.borderRadius = '4px';
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

// Export functions for potential external use
window.TaskManager = {
    renderSpecs: renderSpecs,
    toggleTaskDetail: toggleTaskDetail,
    toggleSubspecs: toggleSubspecs,
    copyTaskSpec: copyTaskSpec,
    saveTaskSpec: saveTaskSpec,
    toggleTaskCompletionStatus: toggleTaskCompletionStatus,
    setSpecFilter: setSpecFilter,
    getTasks: () => specState.specs,
    getCurrentFilter: () => specState.currentFilter,
    loadTasksFromPersistence: loadTasksFromPersistence,
    saveTaskWithPersistence: saveTaskWithPersistence,
    addTask: async (spec) => {
        try {
            const savedTask = await saveTaskWithPersistence(spec);
            renderSpecs();
            return savedTask;
        } catch (error) {
            console.error('Error adding spec:', error);
            showSpecError(`Failed to add spec: ${error.message}`);
            throw error;
        }
    },
    updateTask: async (specId, updates) => {
        try {
            const spec = specState.specs.find(s => s.id === specId);
            if (spec) {
                Object.assign(spec, updates);
                const savedTask = await saveTaskWithPersistence(spec);
                renderSpecs();
                return savedTask;
            }
        } catch (error) {
            console.error('Error updating spec:', error);
            showSpecError(`Failed to update spec: ${error.message}`);
            throw error;
        }
    }
};