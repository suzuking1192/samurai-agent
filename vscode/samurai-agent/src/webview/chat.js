// Samurai Agent Chat - JavaScript functionality
// This file handles chat interactions and LLM model selection
console.log('Chat: chat.js script loaded');

// Guard against missing WebviewApi
if (!window.WebviewApi) {
    console.warn('Chat: WebviewApi not ready yet; deferring init...');
    document.addEventListener('readystatechange', function onReady() {
        if (window.WebviewApi) {
            document.removeEventListener('readystatechange', onReady);
            console.log('Chat: WebviewApi now available, initializing...');
            // Initialize chat functionality
            initializeChat();
        }
    });
} else {
    console.log('Chat: WebviewApi available, initializing...');
    // Initialize chat functionality immediately
    initializeChat();
}

// Chat state
let chatState = {
    globalSettings: null,
    projectSettings: null,
    availableModels: [],
    llmModels: null
};

// Initialize chat functionality
function initializeChat() {
    console.log('Chat: Initializing chat functionality...');

document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const startNewConversationBtn = document.getElementById('start-new-conversation-btn');
    const llmModelSelect = document.getElementById('llm-model-select');
    
    // Listen for messages from the webview provider
    window.addEventListener('message', function(event) {
        const message = event.data;
        if (message.type === 'initialSettings') {
            handleInitialSettings(message.payload);
        } else if (message.type === 'globalSettingsUpdated') {
            // Refresh the dropdown when global settings are updated
            console.log('Chat: Received globalSettingsUpdated message');
            refreshLLMModelDropdown();
        }
    });
    
    // Basic input handling - placeholder for future functionality
    chatInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message) {
                // For now, just clear the input
                // Future: Send message to backend agent
                chatInput.value = '';
            }
        }
    });
    
    // Start New Conversation button functionality
    if (startNewConversationBtn) {
        startNewConversationBtn.addEventListener('click', function() {
            // Clear all chat messages
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            // Clear the chat input field
            if (chatInput) {
                chatInput.value = '';
                chatInput.focus();
            }
        });
    }
    
    // LLM Model dropdown change handler
    if (llmModelSelect) {
        llmModelSelect.addEventListener('change', function() {
            handleLLMModelChange(this.value);
        });
    }
    
    // Focus the input when the webview loads
    chatInput.focus();
    
    // Listen for tab changes to refresh the dropdown when switching to Chat tab
    const chatTab = document.getElementById('chat-tab');
    if (chatTab) {
        chatTab.addEventListener('click', async function() {
            // Refresh the dropdown when switching to Chat tab
            await refreshLLMModelDropdown();
        });
    }
    
    // Fallback: If no initial settings are received after 2 seconds, try to load them manually
    setTimeout(async () => {
        if (!chatState.availableModels || chatState.availableModels.length === 0) {
            await refreshLLMModelDropdown();
        }
    }, 2000);
});

/**
 * Handles initial settings received from the webview provider
 */
function handleInitialSettings(payload) {
    console.log('Chat: Received initial settings:', {
        hasGlobalSettings: !!payload.globalSettings,
        hasLLMModels: !!payload.llmModels,
        hasAvailableModels: !!payload.availableModels,
        llmModelsKeys: payload.llmModels ? Object.keys(payload.llmModels) : 'none'
    });
    
    chatState.globalSettings = payload.globalSettings;
    chatState.projectSettings = payload.projectSettings;
    chatState.availableModels = payload.availableModels;
    chatState.llmModels = payload.llmModels;
    
    // Populate the LLM Model dropdown
    populateLLMModelDropdown();
    
    // Set the selected model
    if (chatState.projectSettings.primaryLLMModel) {
        const llmModelSelect = document.getElementById('llm-model-select');
        if (llmModelSelect) {
            llmModelSelect.value = chatState.projectSettings.primaryLLMModel;
        }
    }
}

/**
 * Populates the LLM Model dropdown with available models
 */
function populateLLMModelDropdown() {
    const llmModelSelect = document.getElementById('llm-model-select');
    if (!llmModelSelect || !chatState.availableModels) {
        return;
    }
    
    // Clear existing options
    llmModelSelect.innerHTML = '';
    
    // Add available models
    chatState.availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        llmModelSelect.appendChild(option);
    });
    
    // If no models are available, show a placeholder
    if (chatState.availableModels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available - configure API keys in Settings';
        option.disabled = true;
        llmModelSelect.appendChild(option);
    }
}

/**
 * Handles LLM model selection change
 */
async function handleLLMModelChange(selectedModelId) {
    if (!selectedModelId || !chatState.projectSettings) {
        return;
    }
    
    try {
        // Update the project settings
        const updatedProjectSettings = {
            ...chatState.projectSettings,
            primaryLLMModel: selectedModelId
        };
        
        // Save the updated settings
        await window.WebviewApi.persistence.saveProjectSettings(updatedProjectSettings);
        
        // Update local state
        chatState.projectSettings = updatedProjectSettings;
        
        console.log('LLM model changed to:', selectedModelId);
    } catch (error) {
        console.error('Error saving LLM model selection:', error);
        // Optionally show an error message to the user
    }
}

/**
 * Refreshes the LLM model dropdown based on current global settings
 * This should be called when global settings are updated
 */
async function refreshLLMModelDropdown() {
    try {
        console.log('Chat: Starting refreshLLMModelDropdown');
        
        // Load fresh global settings
        const globalSettings = await window.WebviewApi.persistence.loadGlobalSettings();
        if (globalSettings) {
            chatState.globalSettings = globalSettings;
            
            console.log('Chat: Loaded global settings:', {
                geminiApiKey: globalSettings.geminiApiKey ? '***' : 'not set',
                hasLLMModels: !!chatState.llmModels
            });
            
            // Ensure we have LLM models data
            if (!chatState.llmModels) {
                console.log('Chat: No LLM models data available');
                return;
            }
            
            // Recalculate available models based on current API keys
            const availableModels = [];
            
            // Check OpenAI models
            if (globalSettings.openaiApiKey && globalSettings.openaiApiKey.trim()) {
                availableModels.push(...chatState.llmModels.openai);
            }
            
            // Check Google models
            if (globalSettings.geminiApiKey && globalSettings.geminiApiKey.trim()) {
                console.log('Chat: Adding Google models, count:', chatState.llmModels.google.length);
                availableModels.push(...chatState.llmModels.google);
            } else {
                console.log('Chat: Skipping Google models - no valid API key');
            }
            
            // Check Anthropic models
            if (globalSettings.claudeApiKey && globalSettings.claudeApiKey.trim()) {
                availableModels.push(...chatState.llmModels.anthropic);
            }
            
            // Sort alphabetically by provider, then by model name
            chatState.availableModels = availableModels.sort((a, b) => {
                const providerA = a.provider;
                const providerB = b.provider;
                if (providerA !== providerB) {
                    return providerA.localeCompare(providerB);
                }
                return a.name.localeCompare(b.name);
            });
            
            console.log('Chat: Final available models count:', availableModels.length);
            
            // Repopulate the dropdown
            populateLLMModelDropdown();
            
            // Update the selected model if the current selection is no longer available
            const currentSelection = chatState.projectSettings.primaryLLMModel;
            if (currentSelection && !chatState.availableModels.find(m => m.id === currentSelection)) {
                // Current selection is no longer available, select the first available model
                if (chatState.availableModels.length > 0) {
                    const newSelection = chatState.availableModels[0].id;
                    const llmModelSelect = document.getElementById('llm-model-select');
                    if (llmModelSelect) {
                        llmModelSelect.value = newSelection;
                    }
                    
                    // Update project settings
                    chatState.projectSettings.primaryLLMModel = newSelection;
                    await window.WebviewApi.persistence.saveProjectSettings(chatState.projectSettings);
                }
            }
        }
    } catch (error) {
        console.error('Error refreshing LLM model dropdown:', error);
    }
}

    // Export functions for potential external use
    window.ChatManager = {
        handleInitialSettings: handleInitialSettings,
        populateLLMModelDropdown: populateLLMModelDropdown,
        handleLLMModelChange: handleLLMModelChange,
        refreshLLMModelDropdown: refreshLLMModelDropdown,
        getChatState: () => chatState
    };
}
