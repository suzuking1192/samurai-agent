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

// Settings state
let settingsState = {
    openaiApiKey: '',
    openaiModels: [],
    geminiApiKey: '',
    geminiModels: [],
    claudeApiKey: '',
    claudeModels: [],
    projectDetailText: '',
    digestedMemory: ''
};

// Initialize settings functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSettingsTab();
});

function initializeSettingsTab() {
    // Load settings from localStorage
    loadSettingsFromLocalStorage();
    
    // Render settings when settings tab is shown
    const settingsTab = document.getElementById('setting-tab');
    if (settingsTab) {
        settingsTab.addEventListener('click', function() {
            setTimeout(renderSettings, 100); // Small delay to ensure tab content is visible
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
    const apiKeyValue = settingsState[`${providerKey}ApiKey`] || '';
    const selectedModels = settingsState[`${providerKey}Models`] || [];
    
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
    const projectDetailValue = settingsState.projectDetailText || '';
    const digestedMemoryValue = settingsState.digestedMemory || '';
    
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
    // API Key inputs - save on blur
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('blur', function() {
            saveSettingsToLocalStorage();
        });
    });
    
    // Model selection dropdowns - save on change
    document.querySelectorAll('select[multiple]').forEach(select => {
        select.addEventListener('change', function() {
            saveSettingsToLocalStorage();
        });
    });
    
    // Project detail textarea - save on input
    const projectDetailTextarea = document.getElementById('project-detail-text');
    if (projectDetailTextarea) {
        projectDetailTextarea.addEventListener('input', function() {
            saveSettingsToLocalStorage();
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
        saveAllBtn.addEventListener('click', function() {
            saveSettingsToLocalStorage();
            showSaveSuccess('All settings saved successfully!');
        });
    }
    
    // Individual Save buttons
    document.querySelectorAll('.settings-save-btn').forEach(button => {
        button.addEventListener('click', function() {
            const provider = this.getAttribute('data-provider');
            const section = this.getAttribute('data-section');
            
            if (provider) {
                saveProviderSettings(provider);
            } else if (section === 'project') {
                saveProjectSettings();
            }
        });
    });
}

function saveProviderSettings(providerKey) {
    // Save specific provider settings
    const apiKeyInput = document.getElementById(`${providerKey}-api-key`);
    const modelsSelect = document.getElementById(`${providerKey}-models`);
    
    if (apiKeyInput) {
        settingsState[`${providerKey}ApiKey`] = apiKeyInput.value || '';
    }
    
    if (modelsSelect) {
        settingsState[`${providerKey}Models`] = Array.from(modelsSelect.selectedOptions || [])
            .map(option => option.value);
    }
    
    // Save to localStorage
    localStorage.setItem('samuraiAgentSettings', JSON.stringify(settingsState));
    
    // Show success feedback
    showSaveSuccess(`${providerKey} settings saved successfully!`);
    
    console.log(`${providerKey} settings saved:`, {
        apiKey: settingsState[`${providerKey}ApiKey`],
        models: settingsState[`${providerKey}Models`]
    });
}

function saveProjectSettings() {
    // Save project detail text
    const projectDetailTextarea = document.getElementById('project-detail-text');
    if (projectDetailTextarea) {
        settingsState.projectDetailText = projectDetailTextarea.value || '';
    }
    
    // Save to localStorage
    localStorage.setItem('samuraiAgentSettings', JSON.stringify(settingsState));
    
    // Show success feedback
    showSaveSuccess('Project details saved successfully!');
    
    console.log('Project settings saved:', {
        projectDetailText: settingsState.projectDetailText
    });
}

function saveSettingsToLocalStorage() {
    // Save API keys
    settingsState.openaiApiKey = document.getElementById('openai-api-key')?.value || '';
    settingsState.geminiApiKey = document.getElementById('gemini-api-key')?.value || '';
    settingsState.claudeApiKey = document.getElementById('claude-api-key')?.value || '';
    
    // Save selected models
    settingsState.openaiModels = Array.from(document.getElementById('openai-models')?.selectedOptions || [])
        .map(option => option.value);
    settingsState.geminiModels = Array.from(document.getElementById('gemini-models')?.selectedOptions || [])
        .map(option => option.value);
    settingsState.claudeModels = Array.from(document.getElementById('claude-models')?.selectedOptions || [])
        .map(option => option.value);
    
    // Save project detail text
    settingsState.projectDetailText = document.getElementById('project-detail-text')?.value || '';
    
    // Save to localStorage
    localStorage.setItem('samuraiAgentSettings', JSON.stringify(settingsState));
    
    console.log('Settings saved to localStorage:', settingsState);
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

function loadSettingsFromLocalStorage() {
    try {
        const savedSettings = localStorage.getItem('samuraiAgentSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            settingsState = { ...settingsState, ...parsedSettings };
            console.log('Settings loaded from localStorage:', settingsState);
        }
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
    }
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
    const projectDetailText = settingsState.projectDetailText;
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
    settingsState.digestedMemory = digestedMemory;
    saveSettingsToLocalStorage();
}

// Export functions for potential external use
window.SettingsManager = {
    renderSettings: renderSettings,
    saveSettingsToLocalStorage: saveSettingsToLocalStorage,
    loadSettingsFromLocalStorage: loadSettingsFromLocalStorage,
    getSettings: () => settingsState,
    updateSettings: (newSettings) => {
        settingsState = { ...settingsState, ...newSettings };
        saveSettingsToLocalStorage();
        renderSettings();
    }
};
