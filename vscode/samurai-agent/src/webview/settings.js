// Settings Tab JavaScript - Handles LLM configuration and project details

// Available models for each provider
const OPENAI_MODELS = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k'
];

const GEMINI_MODELS = [
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
];

const CLAUDE_MODELS = [
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'claude-2.1'
];

// Settings state - now using the new persistence API
let settingsState = {
    globalSettings: {
        openaiApiKey: '',
        openaiModels: [],
        geminiApiKey: '',
        geminiModels: [],
        claudeApiKey: '',
        claudeModels: [],
        theme: 'default',
        autoSave: true
    },
    projectSettings: {
        projectDetailText: '',
        digestedMemory: '',
        llmProvider: 'openai',
        defaultModel: 'gpt-4',
        defaultMode: 'default'
    },
    isLoading: false
};

// Initialize settings functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSettingsTab();
});

async function initializeSettingsTab() {
    // Load settings using the new persistence API
    await loadSettingsFromPersistence();
    
    // Render settings when settings tab is shown
    const settingsTab = document.getElementById('setting-tab');
    if (settingsTab) {
        settingsTab.addEventListener('click', async function() {
            // Show loading state while fetching fresh data
            const settingsContent = document.getElementById('setting-content');
            if (settingsContent) {
                const hideLoading = window.WebviewApi?.ui?.showGlobalLoading(settingsContent, 'Loading settings...');
                try {
                    await loadSettingsFromPersistence();
                    setTimeout(renderSettings, 100); // Small delay to ensure tab content is visible
                } finally {
                    if (hideLoading) hideLoading();
                }
            }
        });
    }
    
    // Initial render if settings tab is already active
    const settingsContent = document.getElementById('setting-content');
    if (settingsContent && settingsContent.style.display !== 'none') {
        renderSettings();
    }
}

function renderSettings() {
    const settingsContent = document.getElementById('setting-content');
    if (!settingsContent) {
        return;
    }
    
    settingsContent.innerHTML = `
        <div class="settings-container">
            <div class="settings-header">
                <h3>Settings</h3>
                <button class="settings-save-all-btn" id="save-all-settings">Save All Settings</button>
            </div>
            
            <!-- LLM Provider Sections -->
            ${renderLLMProviderSection('OpenAI', OPENAI_MODELS, 'openai')}
            ${renderLLMProviderSection('Gemini', GEMINI_MODELS, 'gemini')}
            ${renderLLMProviderSection('Claude', CLAUDE_MODELS, 'claude')}
            
            <!-- Project Detail Section -->
            ${renderProjectDetailSection()}
        </div>
    `;
    
    // Attach event listeners
    attachSettingsEventListeners();
}

function renderLLMProviderSection(providerName, modelsArray, providerKey) {
    const apiKeyValue = settingsState.globalSettings[`${providerKey}ApiKey`] || '';
    const selectedModels = settingsState.globalSettings[`${providerKey}Models`] || [];
    
    const modelOptions = modelsArray.map(model => {
        const isSelected = selectedModels.includes(model) ? 'selected' : '';
        return `<option value="${model}" ${isSelected}>${model}</option>`;
    }).join('');
    
    return `
        <div class="llm-provider-section">
            <fieldset>
                <legend>${providerName} Configuration</legend>
                
                <div class="settings-form-group">
                    <label for="${providerKey}-api-key">API Key:</label>
                    <input type="text" 
                           id="${providerKey}-api-key" 
                           placeholder="Enter your ${providerName} API key..."
                           value="${apiKeyValue}">
                </div>
                
                <div class="settings-form-group">
                    <label for="${providerKey}-models">Available Models:</label>
                    <select id="${providerKey}-models" multiple>
                        ${modelOptions}
                    </select>
                </div>
                
                <div class="settings-form-group">
                    <button class="settings-save-btn" data-provider="${providerKey}">Save ${providerName} Settings</button>
                </div>
            </fieldset>
        </div>
    `;
}

function renderProjectDetailSection() {
    const projectDetailValue = settingsState.projectSettings.projectDetailText || '';
    const digestedMemoryValue = settingsState.projectSettings.digestedMemory || '';
    
    return `
        <div class="project-detail-section">
            <h4>Project Details</h4>
            
            <div class="settings-form-group">
                <label for="project-detail-text">Project Detailed Text:</label>
                <textarea id="project-detail-text" 
                          placeholder="Enter detailed information about your project...">${projectDetailValue}</textarea>
            </div>
            
            <div class="settings-form-group">
                <button class="settings-save-btn" data-section="project">Save Project Details</button>
            </div>
            
            <div class="digested-memory-section">
                <button id="show-digested-memory">See Digested Project Detail Memory</button>
                <div id="digested-memory-display" class="digested-memory-display" style="display: none;">
                    ${digestedMemoryValue}
                </div>
            </div>
        </div>
    `;
}

function attachSettingsEventListeners() {
    // API Key inputs - save on blur with loading feedback
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('blur', async function() {
            await saveGlobalSettingsWithFeedback();
        });
    });
    
    // Model selection dropdowns - save on change with loading feedback
    document.querySelectorAll('select[multiple]').forEach(select => {
        select.addEventListener('change', async function() {
            await saveGlobalSettingsWithFeedback();
        });
    });
    
    // Project detail textarea - save on input with loading feedback
    const projectDetailTextarea = document.getElementById('project-detail-text');
    if (projectDetailTextarea) {
        projectDetailTextarea.addEventListener('input', async function() {
            await saveProjectSettingsWithFeedback();
        });
    }
    
    // Show digested memory button
    const showDigestedMemoryBtn = document.getElementById('show-digested-memory');
    if (showDigestedMemoryBtn) {
        showDigestedMemoryBtn.addEventListener('click', function() {
            toggleDigestedMemory();
        });
    }
    
    // Save All Settings button
    const saveAllBtn = document.getElementById('save-all-settings');
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', async function() {
            const hideLoading = window.WebviewApi?.ui?.showLoading(this, 'Saving all settings...');
            try {
                await saveGlobalSettingsWithFeedback();
                await saveProjectSettingsWithFeedback();
                showSaveSuccess('All settings saved successfully!');
            } catch (error) {
                showSaveError(`Save failed: ${error.message}`);
            } finally {
                if (hideLoading) hideLoading();
            }
        });
    }
    
    // Individual Save buttons
    document.querySelectorAll('.settings-save-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const provider = this.getAttribute('data-provider');
            const section = this.getAttribute('data-section');
            
            const hideLoading = window.WebviewApi?.ui?.showLoading(this, 'Saving...');
            try {
                if (provider) {
                    await saveProviderSettings(provider);
                } else if (section === 'project') {
                    await saveProjectSettingsWithFeedback();
                }
            } catch (error) {
                showSaveError(`Save failed: ${error.message}`);
            } finally {
                if (hideLoading) hideLoading();
            }
        });
    });
}

// New persistence-based save functions
async function loadSettingsFromPersistence() {
    try {
        // Load global settings
        const globalSettings = await window.WebviewApi.persistence.loadGlobalSettings();
        if (globalSettings) {
            settingsState.globalSettings = { ...settingsState.globalSettings, ...globalSettings };
        }
        
        // Load project settings
        const projectSettings = await window.WebviewApi.persistence.loadProjectSettings();
        if (projectSettings) {
            settingsState.projectSettings = { ...settingsState.projectSettings, ...projectSettings };
        }
        
        console.log('Settings loaded from persistence:', settingsState);
    } catch (error) {
        console.error('Error loading settings from persistence:', error);
        showSaveError(`Failed to load settings: ${error.message}`);
    }
}

async function saveGlobalSettingsWithFeedback() {
    try {
        // Update state from UI
        updateGlobalSettingsFromUI();
        
        // Save using persistence API
        await window.WebviewApi.persistence.saveGlobalSettings(settingsState.globalSettings);
        
        showSaveSuccess('Global settings saved successfully!');
        console.log('Global settings saved:', settingsState.globalSettings);
    } catch (error) {
        console.error('Error saving global settings:', error);
        showSaveError(`Save failed: ${error.message}`);
        throw error;
    }
}

async function saveProjectSettingsWithFeedback() {
    try {
        // Update state from UI
        updateProjectSettingsFromUI();
        
        // Save using persistence API
        await window.WebviewApi.persistence.saveProjectSettings(settingsState.projectSettings);
        
        showSaveSuccess('Project settings saved successfully!');
        console.log('Project settings saved:', settingsState.projectSettings);
    } catch (error) {
        console.error('Error saving project settings:', error);
        showSaveError(`Save failed: ${error.message}`);
        throw error;
    }
}

function updateGlobalSettingsFromUI() {
    // Update API keys
    settingsState.globalSettings.openaiApiKey = document.getElementById('openai-api-key')?.value || '';
    settingsState.globalSettings.geminiApiKey = document.getElementById('gemini-api-key')?.value || '';
    settingsState.globalSettings.claudeApiKey = document.getElementById('claude-api-key')?.value || '';
    
    // Update selected models
    settingsState.globalSettings.openaiModels = Array.from(document.getElementById('openai-models')?.selectedOptions || [])
        .map(option => option.value);
    settingsState.globalSettings.geminiModels = Array.from(document.getElementById('gemini-models')?.selectedOptions || [])
        .map(option => option.value);
    settingsState.globalSettings.claudeModels = Array.from(document.getElementById('claude-models')?.selectedOptions || [])
        .map(option => option.value);
}

function updateProjectSettingsFromUI() {
    // Update project detail text
    settingsState.projectSettings.projectDetailText = document.getElementById('project-detail-text')?.value || '';
}

async function saveProviderSettings(providerKey) {
    // Update the specific provider settings in state
    const apiKeyInput = document.getElementById(`${providerKey}-api-key`);
    const modelsSelect = document.getElementById(`${providerKey}-models`);
    
    if (apiKeyInput) {
        settingsState.globalSettings[`${providerKey}ApiKey`] = apiKeyInput.value || '';
    }
    
    if (modelsSelect) {
        settingsState.globalSettings[`${providerKey}Models`] = Array.from(modelsSelect.selectedOptions || [])
            .map(option => option.value);
    }
    
    // Save using persistence API
    await window.WebviewApi.persistence.saveGlobalSettings(settingsState.globalSettings);
    
    showSaveSuccess(`${providerKey} settings saved successfully!`);
    console.log(`${providerKey} settings saved:`, {
        apiKey: settingsState.globalSettings[`${providerKey}ApiKey`],
        models: settingsState.globalSettings[`${providerKey}Models`]
    });
}

function showSaveSuccess(message) {
    // Create or update success message
    let successDiv = document.getElementById('settings-success-message');
    if (!successDiv) {
        successDiv = document.createElement('div');
        successDiv.id = 'settings-success-message';
        successDiv.className = 'settings-success-message';
        document.querySelector('.settings-container').appendChild(successDiv);
    }
    
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

function showSaveError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('settings-error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'settings-error-message';
        errorDiv.className = 'settings-error-message';
        errorDiv.style.color = '#dc3545';
        errorDiv.style.backgroundColor = '#f8d7da';
        errorDiv.style.border = '1px solid #f5c6cb';
        errorDiv.style.padding = '10px';
        errorDiv.style.margin = '10px 0';
        errorDiv.style.borderRadius = '4px';
        document.querySelector('.settings-container').appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function toggleDigestedMemory() {
    const display = document.getElementById('digested-memory-display');
    const button = document.getElementById('show-digested-memory');
    
    if (display && button) {
        if (display.style.display === 'none') {
            // Generate digested memory (placeholder implementation)
            generateDigestedMemory();
            display.style.display = 'block';
            button.textContent = 'Hide Digested Project Detail Memory';
        } else {
            display.style.display = 'none';
            button.textContent = 'See Digested Project Detail Memory';
        }
    }
}

function generateDigestedMemory() {
    const projectDetailText = settingsState.projectSettings.projectDetailText;
    const display = document.getElementById('digested-memory-display');
    
    if (!projectDetailText.trim()) {
        display.textContent = 'No project detail text available. Please enter project details above.';
        return;
    }
    
    // Placeholder implementation - in a real app, this would call an AI service
    const digestedMemory = `Digested Memory for Project:
    
Key Points:
- Project involves: ${projectDetailText.substring(0, 100)}...
- Main objectives identified
- Technical requirements noted
- Timeline considerations included

Summary: This project appears to be focused on ${projectDetailText.split(' ').slice(0, 10).join(' ')}...

Last updated: ${new Date().toLocaleString()}`;
    
    display.textContent = digestedMemory;
    settingsState.projectSettings.digestedMemory = digestedMemory;
    
    // Save the digested memory using the persistence API
    saveProjectSettingsWithFeedback().catch(error => {
        console.error('Error saving digested memory:', error);
    });
}

// Export functions for potential external use
window.SettingsManager = {
    renderSettings: renderSettings,
    loadSettingsFromPersistence: loadSettingsFromPersistence,
    saveGlobalSettingsWithFeedback: saveGlobalSettingsWithFeedback,
    saveProjectSettingsWithFeedback: saveProjectSettingsWithFeedback,
    getSettings: () => settingsState,
    updateGlobalSettings: async (newSettings) => {
        settingsState.globalSettings = { ...settingsState.globalSettings, ...newSettings };
        await saveGlobalSettingsWithFeedback();
        renderSettings();
    },
    updateProjectSettings: async (newSettings) => {
        settingsState.projectSettings = { ...settingsState.projectSettings, ...newSettings };
        await saveProjectSettingsWithFeedback();
        renderSettings();
    }
};
