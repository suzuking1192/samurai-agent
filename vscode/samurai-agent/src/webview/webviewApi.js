/**
 * Webview API utility for standardized message passing
 * Provides a clean interface for communicating with the extension host
 */

// Wrap everything in an IIFE to ensure proper initialization
(function() {
    'use strict';
    
    // Detect VS Code messaging API
    const vscodeApi = typeof window !== 'undefined' && window.acquireVsCodeApi
        ? window.acquireVsCodeApi()
        : undefined;

    // Message passing state
    const messageState = {
        pendingRequests: new Map(), // requestId -> { resolve, reject, timeout }
        requestCounter: 0
    };

/**
 * Generates a unique request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${++messageState.requestCounter}`;
}

/**
 * Sends a command to the extension host and returns a Promise
 * @param {string} command - The command to execute
 * @param {any} payload - Optional payload data
 * @param {number} timeout - Request timeout in milliseconds (default: 10000)
 * @returns {Promise<any>} Promise that resolves with the response
 */
function postCommand(command, payload = null, timeout = 1000000) {
    return new Promise((resolve, reject) => {
        const requestId = generateRequestId();
        
        // Store the promise handlers
        const timeoutId = setTimeout(() => {
            messageState.pendingRequests.delete(requestId);
            reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
        
        messageState.pendingRequests.set(requestId, {
            resolve: (response) => {
                clearTimeout(timeoutId);
                messageState.pendingRequests.delete(requestId);
                resolve(response);
            },
            reject: (error) => {
                clearTimeout(timeoutId);
                messageState.pendingRequests.delete(requestId);
                reject(error);
            },
            timeout: timeoutId
        });
        
        // Send message to extension host
        const message = {
            command,
            requestId,
            payload
        };

        try {
            if (vscodeApi && typeof vscodeApi.postMessage === 'function') {
                vscodeApi.postMessage(message);
            } else {
                window.parent.postMessage(message, '*');
            }
        } catch (error) {
            messageState.pendingRequests.delete(requestId);
            clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * Handles incoming messages from the extension host
 * This function should be called by the extension host when messages are received
 */
function handleMessage(message) {
    const { type, requestId, payload, error } = message;
    
    if (!requestId) {
        console.warn('Received message without requestId:', message);
        return;
    }
    
    const pendingRequest = messageState.pendingRequests.get(requestId);
    if (!pendingRequest) {
        console.warn('Received response for unknown requestId:', requestId);
        return;
    }
    
    if (type === 'error' || error) {
        pendingRequest.reject(new Error(error || 'Unknown error occurred'));
    } else {
        pendingRequest.resolve(payload);
    }
}

/**
 * Convenience methods for common persistence operations
 */
const persistenceApi = {
    // Spec operations
    loadSpecs: () => postCommand('loadSpecs'),
    saveSpec: (spec) => postCommand('saveSpec', spec),
    deleteSpec: (specId) => postCommand('deleteSpec', { specId }),
    
    // Memory operations
    loadMemories: () => postCommand('loadMemories'),
    saveMemory: (memory) => postCommand('saveMemory', memory),
    deleteMemory: (memoryId) => postCommand('deleteMemory', { memoryId }),
    
    // Session operations
    createSession: (request) => postCommand('createSession', request),
    loadSession: (sessionId) => postCommand('loadSession', { sessionId }),
    updateSession: (sessionId, updates) => postCommand('updateSession', { sessionId, updates }),
    
    // Chat message operations
    loadChatMessagesForSession: (sessionId) => postCommand('loadChatMessagesForSession', { sessionId }),
    saveChatMessage: (message) => postCommand('saveChatMessage', message),
    
    // Settings operations
    loadProjectSettings: () => postCommand('loadProjectSettings'),
    saveProjectSettings: (settings) => postCommand('saveProjectSettings', settings),
    loadGlobalSettings: () => postCommand('loadGlobalSettings'),
    saveGlobalSettings: (settings) => postCommand('saveGlobalSettings', settings)
};

/**
 * Project detail memory operations
 */
const projectDetailApi = {
    ingest: ({ projectId, rawText, mode, timeout = 1000 * 60 * 5 }) => postCommand('projectDetail.ingest', { projectId, rawText, mode }, timeout)
};

/**
 * UI feedback utilities
 */
const uiFeedback = {
    /**
     * Shows a loading indicator for a specific element
     */
    showLoading: (element, text = 'Loading...') => {
        if (!element) {return;}
        
        const originalContent = element.innerHTML;
        element.innerHTML = `<span class="loading-indicator">${text}</span>`;
        element.disabled = true;
        
        return () => {
            element.innerHTML = originalContent;
            element.disabled = false;
        };
    },
    
    /**
     * Shows a temporary success message
     */
    showSuccess: (element, message = 'Success!', duration = 2000) => {
        if (!element) {return;}
        
        const originalText = element.textContent;
        const originalBg = element.style.backgroundColor;
        
        element.textContent = message;
        element.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
            element.textContent = originalText;
            element.style.backgroundColor = originalBg;
        }, duration);
    },
    
    /**
     * Shows a temporary error message
     */
    showError: (element, message = 'Error!', duration = 3000) => {
        if (!element) {return;}
        
        const originalText = element.textContent;
        const originalBg = element.style.backgroundColor;
        
        element.textContent = message;
        element.style.backgroundColor = '#dc3545';
        
        setTimeout(() => {
            element.textContent = originalText;
            element.style.backgroundColor = originalBg;
        }, duration);
    },
    
    /**
     * Creates a global loading overlay
     */
    showGlobalLoading: (container, message = 'Loading...') => {
        if (!container) {return;}
        
        const overlay = document.createElement('div');
        overlay.className = 'global-loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        
        container.appendChild(overlay);
        
        return () => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };
    },
    
    /**
     * Switches to a specific tab
     */
    switchTab: (tabName) => {
        const tabElement = document.getElementById(`${tabName}-tab`);
        if (tabElement) {
            tabElement.click();
        }
    }
};

    const agentApi = {
        execute: ({ userMessage, session, message }) => {
            // Provide backward compatibility: if userMessage is not supplied, construct from message
            const payload = {};

            if (userMessage) {
                payload.userMessage = userMessage;
            } else if (message) {
                payload.userMessage = {
                    id: `user-${Date.now()}`,
                    sessionId: session?.id || null,
                    projectId: session?.metadata?.projectId || session?.projectId || 'default',
                    type: 'user',
                    role: 'user',
                    content: message,
                    metadata: {}
                };
            }

            if (session) {
                payload.session = session;
            }

            return postCommand('samurai-agent.execute', payload);
        }
    };

    // Listen for messages from extension host
    window.addEventListener('message', (event) => {
        const message = event.data;
        handleMessage(message);
        notifySubscribers(message);
    });

    if (vscodeApi && typeof vscodeApi.onMessage === 'function') {
        vscodeApi.onMessage((message) => {
            handleMessage(message);
            notifySubscribers(message);
        });
    }

    const subscribers = new Set();

    function notifySubscribers(message) {
        subscribers.forEach(callback => {
            try {
                callback(message);
            } catch (error) {
                console.error('WebviewApi subscriber error:', error);
            }
        });
    }

    function subscribe(callback) {
        if (typeof callback === 'function') {
            subscribers.add(callback);
            return () => subscribers.delete(callback);
        }
        return () => {};
    }

    // Export the API
    const costApi = {
        getStatistics: () => postCommand('samurai-agent.getCostStatistics')
    };

    window.WebviewApi = {
        postCommand,
        subscribe,
        persistence: persistenceApi,
        agent: agentApi,
        projectDetail: projectDetailApi,
        ui: uiFeedback,
        cost: costApi,
        chat: {
            loadChatHistoryForCurrentSession: (sessionId) =>
                postCommand('chat.loadHistoryForCurrentSession', { sessionId })
        }
    };

    // Make it globally available for backward compatibility
    window.postCommand = postCommand;
    
    console.log('WebviewApi: API initialized and available');
})();