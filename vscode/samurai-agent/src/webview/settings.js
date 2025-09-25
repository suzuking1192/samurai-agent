// Settings Tab JavaScript - Handles LLM configuration and project details
console.log('Settings: settings.js script loaded');

// Guard against missing WebviewApi
if (!window.WebviewApi) {
    console.warn('Settings: WebviewApi not ready yet; deferring init...');
    document.addEventListener('readystatechange', function onReady() {
        if (window.WebviewApi) {
            document.removeEventListener('readystatechange', onReady);
            console.log('Settings: WebviewApi now available, initializing...');
            // Initialize settings functionality
            initializeSettings();
        }
    });
} else {
    console.log('Settings: WebviewApi available, initializing...');
    // Initialize settings functionality immediately
    initializeSettings();
}

// Initialize settings functionality
function initializeSettings() {
    console.log('Settings: Initializing settings functionality...');

// Import LLM models from constants (this will be available via the webview API)
let LLM_MODELS = {
    openai: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT-4 model with vision capabilities' },
        { id: 'gpt-5', name: 'GPT-5', description: 'Next-generation GPT model (placeholder for future release)' }
    ],
    google: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient Gemini model for quick responses' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini model for complex tasks' }
    ],
    anthropic: [
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced Claude model with strong reasoning capabilities' },
        { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Most capable Claude model for complex reasoning tasks' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and cost-effective Claude model' }
    ]
};

// Settings state - now using the new persistence API
let settingsState = {
    globalSettings: {
        openaiApiKey: '',
        geminiApiKey: '',
        claudeApiKey: ''
    },
    projectSettings: {
        projectDetailText: '',
        digestedMemory: '',
        primaryLLMModel: null
    },
    isLoading: false
};

// Initialize settings functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Settings: DOMContentLoaded event fired');
    initializeSettingsTab();
});

async function initializeSettingsTab() {
    console.log('Settings: initializeSettingsTab called');
    
    // Load settings using the new persistence API
    await loadSettingsFromPersistence();
    
    // Render settings when settings tab is shown
    const settingsTab = document.getElementById('setting-tab');
    console.log('Settings: Settings tab element found:', !!settingsTab);
    
    if (settingsTab) {
        settingsTab.addEventListener('click', async function() {
            console.log('Settings: Settings tab clicked');
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
    console.log('Settings: Settings content element found:', !!settingsContent);
    console.log('Settings: Settings content display:', settingsContent ? settingsContent.style.display : 'not found');
    
    if (settingsContent && settingsContent.style.display !== 'none') {
        console.log('Settings: Rendering settings initially');
        renderSettings();
    }
}

function renderSettings() {
    console.log('Settings: renderSettings called');
    
    const settingsContent = document.getElementById('setting-content');
    if (!settingsContent) {
        console.log('Settings: Settings content element not found');
        return;
    }
    
    console.log('Settings: Rendering settings HTML');
    
    settingsContent.innerHTML = `
        <div class="settings-container">
            <div class="settings-header">
                <h3>Settings</h3>
                <button class="settings-save-all-btn" id="save-all-settings">Save All Settings</button>
            </div>
            
            <!-- LLM Provider Sections -->
            ${renderLLMProviderSection('OpenAI', LLM_MODELS.openai, 'openai')}
            ${renderLLMProviderSection('Gemini', LLM_MODELS.google, 'gemini')}
            ${renderLLMProviderSection('Claude', LLM_MODELS.anthropic, 'claude')}
            
            <!-- Project Detail Section -->
            ${renderProjectDetailSection()}
        </div>
    `;
    
    // Attach event listeners
    console.log('Settings: About to attach event listeners');
    attachSettingsEventListeners();
}

function renderLLMProviderSection(providerName, modelsArray, providerKey) {
    const apiKeyValue = settingsState.globalSettings[`${providerKey}ApiKey`] || '';
    
    const modelList = modelsArray.map(model => {
        return `<li class="model-item">
                    <span class="model-name">${model.name}</span>
                    <span class="model-description">${model.description}</span>
                </li>`;
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
                    <label>Available Models:</label>
                    <ul class="model-list">
                        ${modelList}
                    </ul>
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
    console.log('Settings: attachSettingsEventListeners called');
    
    // API Key inputs - save on blur with loading feedback
    const textInputs = document.querySelectorAll('input[type="text"]');
    console.log('Settings: Found text inputs:', textInputs.length);
    
    textInputs.forEach(input => {
        input.addEventListener('blur', async function() {
            await saveGlobalSettingsWithFeedback();
        });
    });
    
    // Model lists are now non-interactive, so no event listeners needed
    
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
    const saveButtons = document.querySelectorAll('.settings-save-btn');
    console.log('Settings: Found save buttons:', saveButtons.length);
    
    saveButtons.forEach(button => {
        button.addEventListener('click', async function() {
            console.log('Settings: Save button clicked');
            const provider = this.getAttribute('data-provider');
            const section = this.getAttribute('data-section');
            
            console.log('Settings: Button attributes:', { provider, section });
            
            const hideLoading = window.WebviewApi?.ui?.showLoading(this, 'Saving...');
            try {
                if (provider) {
                    console.log('Settings: Calling saveProviderSettings for:', provider);
                    await saveProviderSettings(provider);
                } else if (section === 'project') {
                    console.log('Settings: Calling saveProjectSettingsWithFeedback');
                    await saveProjectSettingsWithFeedback();
                }
            } catch (error) {
                console.error('Settings: Save error:', error);
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
        
        // Note: globalSettingsUpdated message will be sent by the webview provider
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
    // Update API keys only (models are now defined in constants)
    settingsState.globalSettings.openaiApiKey = document.getElementById('openai-api-key')?.value || '';
    settingsState.globalSettings.geminiApiKey = document.getElementById('gemini-api-key')?.value || '';
    settingsState.globalSettings.claudeApiKey = document.getElementById('claude-api-key')?.value || '';
}

function updateProjectSettingsFromUI() {
    // Update project detail text
    settingsState.projectSettings.projectDetailText = document.getElementById('project-detail-text')?.value || '';
}

async function saveProviderSettings(providerKey) {
    console.log('Settings: saveProviderSettings called for:', providerKey);
    
    // Update the specific provider API key in state
    const apiKeyInput = document.getElementById(`${providerKey}-api-key`);
    
    if (apiKeyInput) {
        settingsState.globalSettings[`${providerKey}ApiKey`] = apiKeyInput.value || '';
        console.log('Settings: Updated API key for:', providerKey, 'value:', apiKeyInput.value ? '***' : 'empty');
    } else {
        console.log('Settings: API key input not found for:', providerKey);
    }
    
    console.log('Settings: About to save global settings');
    console.log('Settings: WebviewApi available:', !!window.WebviewApi);
    console.log('Settings: WebviewApi.persistence available:', !!window.WebviewApi?.persistence);
    
    // Save using persistence API
    await window.WebviewApi.persistence.saveGlobalSettings(settingsState.globalSettings);
    
    showSaveSuccess(`${providerKey} settings saved successfully!`);
    console.log(`${providerKey} settings saved:`, {
        apiKey: settingsState.globalSettings[`${providerKey}ApiKey`]
    });
    
    // Note: globalSettingsUpdated message will be sent by the webview provider
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
}
