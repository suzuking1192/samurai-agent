const { JSDOM } = require('jsdom');

describe('Show Current Spec Button', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Create a complete DOM structure for testing
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="agent-panel-container">
                    <select id="mode-select">
                        <option value="deep_bug_analysis">Deep Bug Analysis</option>
                        <option value="spec_planning">Spec Planning</option>
                    </select>
                    <button id="show-current-spec-btn" style="display: none;">Show Current Spec</button>
                    <div id="chatMessages"></div>
                    <input type="text" id="pin-file-input" />
                    <div id="file-autocomplete"></div>
                    <div id="api-cost-display"></div>
                    
                    <!-- Modal -->
                    <div id="spec-artifact-modal" class="spec-artifact-modal-overlay" style="display: none;">
                        <div class="spec-artifact-modal">
                            <div id="spec-artifact-mermaid"></div>
                            <div id="spec-artifact-text"></div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `, { runScripts: 'outside-only' });

        ({ window } = dom);
        ({ document } = window);

        global.window = window;
        global.document = document;

        // Mock WebviewApi
        window.WebviewApi = {
            persistence: {
                loadSession: jest.fn(),
                saveProjectSettings: jest.fn(),
                loadGlobalSettings: jest.fn().mockResolvedValue({
                    openaiApiKey: '',
                    geminiApiKey: '',
                    claudeApiKey: ''
                }),
                loadProjectSettings: jest.fn().mockResolvedValue({
                    projectId: 'test-project',
                    defaultMode: 'spec_planning'
                })
            },
            subscribe: jest.fn().mockImplementation(callback => {
                window.__subscriber = callback;
                return () => {};
            })
        };

        window.CustomEvent = dom.window.CustomEvent;

        // Trigger DOMContentLoaded to initialize chat.js
        const event = new window.Event('DOMContentLoaded');
        
        // Load chat.js and get the exported functions
        delete require.cache[require.resolve('../../src/webview/chat.js')];
        require('../../src/webview/chat.js');
        
        // Trigger the DOMContentLoaded event
        document.dispatchEvent(event);
    });

    afterEach(() => {
        jest.resetModules();
        delete global.window;
        delete global.document;
    });

    describe('updateShowCurrentSpecButton', () => {
        it('should hide button when not in spec_planning mode', () => {
            const button = document.getElementById('show-current-spec-btn');
            const modeSelect = document.getElementById('mode-select');
            
            modeSelect.value = 'deep_bug_analysis';
            
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            
            expect(button.style.display).toBe('none');
        });

        it('should show button when in spec_planning mode', () => {
            const button = document.getElementById('show-current-spec-btn');
            const modeSelect = document.getElementById('mode-select');
            
            modeSelect.value = 'spec_planning';
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    currentArtifact: {
                        mermaidData: '',
                        textSpec: '',
                        timestamp: Date.now(),
                        generationStatus: 'not_started'
                    }
                };
            }
            
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            
            expect(button.style.display).toBe('inline-block');
        });

        it('should never disable the button', () => {
            const button = document.getElementById('show-current-spec-btn');
            const modeSelect = document.getElementById('mode-select');
            
            modeSelect.value = 'spec_planning';
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = null;
            }
            
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            
            expect(button.disabled).toBe(false);
        });

        it('should update button text to show "Generating..." when artifact is being generated', () => {
            const button = document.getElementById('show-current-spec-btn');
            const modeSelect = document.getElementById('mode-select');
            
            modeSelect.value = 'spec_planning';
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    currentArtifact: {
                        mermaidData: '',
                        textSpec: '',
                        timestamp: Date.now(),
                        generationStatus: 'generating'
                    }
                };
            }
            
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            
            expect(button.textContent).toBe('Show Current Spec (Generating...)');
        });

        it('should update button text to "Show Current Spec" when not generating', () => {
            const button = document.getElementById('show-current-spec-btn');
            const modeSelect = document.getElementById('mode-select');
            
            modeSelect.value = 'spec_planning';
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    currentArtifact: {
                        mermaidData: 'graph TD',
                        textSpec: 'Test spec',
                        timestamp: Date.now(),
                        generationStatus: 'completed'
                    }
                };
            }
            
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            
            expect(button.textContent).toBe('Show Current Spec');
        });
    });

    describe('renderArtifactModal', () => {
        it('should render "not created" state correctly', () => {
            const modal = document.getElementById('spec-artifact-modal');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            const textContainer = document.getElementById('spec-artifact-text');
            
            if (window.ArtifactManager?.renderArtifactModal) {
                window.ArtifactManager.renderArtifactModal(null, null, 'not_started');
            }
            
            expect(modal.style.display).toBe('flex');
            expect(mermaidContainer.innerHTML).toContain('Spec Not Created Yet');
            expect(textContainer.innerHTML).toContain('Start a conversation in spec planning mode');
        });

        it('should render "generating" state correctly', () => {
            const modal = document.getElementById('spec-artifact-modal');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            const textContainer = document.getElementById('spec-artifact-text');
            
            if (window.ArtifactManager?.renderArtifactModal) {
                window.ArtifactManager.renderArtifactModal(null, null, 'generating');
            }
            
            expect(modal.style.display).toBe('flex');
            expect(mermaidContainer.innerHTML).toContain('Spec is Being Generated');
            expect(mermaidContainer.innerHTML).toContain('⏳');
            expect(textContainer.innerHTML).toContain('specification will be available shortly');
        });

        it('should render "failed" state correctly', () => {
            const modal = document.getElementById('spec-artifact-modal');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            const textContainer = document.getElementById('spec-artifact-text');
            
            if (window.ArtifactManager?.renderArtifactModal) {
                window.ArtifactManager.renderArtifactModal(null, null, 'failed');
            }
            
            expect(modal.style.display).toBe('flex');
            expect(mermaidContainer.innerHTML).toContain('Spec Generation Failed');
            expect(mermaidContainer.innerHTML).toContain('❌');
            expect(textContainer.innerHTML).toContain('continuing the conversation');
        });

        it('should render "completed" state with actual artifact data', () => {
            const modal = document.getElementById('spec-artifact-modal');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            const textContainer = document.getElementById('spec-artifact-text');
            
            // Mock mermaid library
            window.mermaid = {
                init: jest.fn()
            };
            
            const mermaidData = 'graph TD\n  A[Start] --> B[End]';
            const textSpec = '# Test Spec\n\nThis is a test specification.';
            
            if (window.ArtifactManager?.renderArtifactModal) {
                window.ArtifactManager.renderArtifactModal(mermaidData, textSpec, 'completed');
            }
            
            expect(modal.style.display).toBe('flex');
            expect(mermaidContainer.innerHTML).toContain('mermaid');
            expect(textContainer.innerHTML).toContain('Test Spec');
        });
    });

    describe('handleShowCurrentSpecClick', () => {
        it('should show "not created" modal when artifact does not exist', async () => {
            const modal = document.getElementById('spec-artifact-modal');
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = null;
            }
            
            if (window.ArtifactManager?.handleShowCurrentSpecClick) {
                await window.ArtifactManager.handleShowCurrentSpecClick();
            }
            
            expect(modal.style.display).toBe('flex');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            expect(mermaidContainer.innerHTML).toContain('Spec Not Created Yet');
        });

        it('should show "generating" modal when artifact is being generated', async () => {
            const modal = document.getElementById('spec-artifact-modal');
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    currentArtifact: {
                        mermaidData: '',
                        textSpec: '',
                        timestamp: Date.now(),
                        generationStatus: 'generating'
                    }
                };
            }
            
            if (window.ArtifactManager?.handleShowCurrentSpecClick) {
                await window.ArtifactManager.handleShowCurrentSpecClick();
            }
            
            expect(modal.style.display).toBe('flex');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            expect(mermaidContainer.innerHTML).toContain('Spec is Being Generated');
        });

        it('should show "failed" modal when artifact generation failed', async () => {
            const modal = document.getElementById('spec-artifact-modal');
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    currentArtifact: {
                        mermaidData: '',
                        textSpec: '',
                        timestamp: Date.now(),
                        generationStatus: 'failed'
                    }
                };
            }
            
            if (window.ArtifactManager?.handleShowCurrentSpecClick) {
                await window.ArtifactManager.handleShowCurrentSpecClick();
            }
            
            expect(modal.style.display).toBe('flex');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            expect(mermaidContainer.innerHTML).toContain('Spec Generation Failed');
        });

        it('should show actual artifact when generation is completed', async () => {
            const modal = document.getElementById('spec-artifact-modal');
            
            // Mock mermaid library
            window.mermaid = {
                init: jest.fn()
            };
            
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    currentArtifact: {
                        mermaidData: 'graph TD\n  A[Start] --> B[End]',
                        textSpec: '# Test Spec\n\nThis is a test.',
                        timestamp: Date.now(),
                        generationStatus: 'completed'
                    }
                };
            }
            
            if (window.ArtifactManager?.handleShowCurrentSpecClick) {
                await window.ArtifactManager.handleShowCurrentSpecClick();
            }
            
            expect(modal.style.display).toBe('flex');
            const mermaidContainer = document.getElementById('spec-artifact-mermaid');
            const textContainer = document.getElementById('spec-artifact-text');
            expect(mermaidContainer.innerHTML).toContain('mermaid');
            expect(textContainer.innerHTML).toContain('Test Spec');
        });
    });

    describe('Integration with message handling', () => {
        it('should update button when artifactGenerated message is received', async () => {
            const button = document.getElementById('show-current-spec-btn');
            const modeSelect = document.getElementById('mode-select');
            modeSelect.value = 'spec_planning';
            
            const chatState = window.ChatManager?.getChatState();
            if (chatState) {
                chatState.currentSession = {
                    id: 'test-session',
                    currentArtifact: {
                        mermaidData: '',
                        textSpec: '',
                        timestamp: Date.now(),
                        generationStatus: 'generating'
                    }
                };
            }
            
            // Initial state - generating
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            expect(button.textContent).toContain('Generating');
            
            // Simulate artifact generation completion
            if (chatState && chatState.currentSession && chatState.currentSession.currentArtifact) {
                chatState.currentSession.currentArtifact.generationStatus = 'completed';
                chatState.currentSession.currentArtifact.mermaidData = 'graph TD';
                chatState.currentSession.currentArtifact.textSpec = 'Test spec';
            }
            
            if (window.ArtifactManager?.updateShowCurrentSpecButton) {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }
            
            // Button should now show normal text
            expect(button.textContent).toBe('Show Current Spec');
        });
    });
});

describe('Show Current Spec Button - Edge Cases', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="agent-panel-container">
                    <select id="mode-select">
                        <option value="spec_planning">Spec Planning</option>
                    </select>
                    <button id="show-current-spec-btn">Show Current Spec</button>
                    <input type="text" id="pin-file-input" />
                    <div id="file-autocomplete"></div>
                    <div id="api-cost-display"></div>
                    <div id="spec-artifact-modal" style="display: none;">
                        <div id="spec-artifact-mermaid"></div>
                        <div id="spec-artifact-text"></div>
                    </div>
                    <div id="chatMessages"></div>
                </div>
            </body>
            </html>
        `, { runScripts: 'outside-only' });

        ({ window } = dom);
        ({ document } = window);

        global.window = window;
        global.document = document;

        // Mock WebviewApi
        window.WebviewApi = {
            persistence: {
                loadSession: jest.fn(),
                saveProjectSettings: jest.fn(),
                loadGlobalSettings: jest.fn().mockResolvedValue({
                    openaiApiKey: '',
                    geminiApiKey: '',
                    claudeApiKey: ''
                }),
                loadProjectSettings: jest.fn().mockResolvedValue({
                    projectId: 'test-project',
                    defaultMode: 'spec_planning'
                })
            },
            subscribe: jest.fn().mockImplementation(callback => {
                window.__subscriber = callback;
                return () => {};
            })
        };

        window.CustomEvent = dom.window.CustomEvent;
    });

    afterEach(() => {
        jest.resetModules();
        delete global.window;
        delete global.document;
    });

    it('should handle missing DOM elements gracefully', () => {
        // Remove the button
        const button = document.getElementById('show-current-spec-btn');
        button.remove();
        
        // Load chat.js
        delete require.cache[require.resolve('../../src/webview/chat.js')];
        require('../../src/webview/chat.js');
        
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);
        
        // This should not throw an error
        if (window.ArtifactManager?.updateShowCurrentSpecButton) {
            expect(() => {
                window.ArtifactManager.updateShowCurrentSpecButton();
            }).not.toThrow();
        }
    });

    it('should handle artifact without generationStatus field', async () => {
        const modeSelect = document.getElementById('mode-select');
        modeSelect.value = 'spec_planning';
        
        delete require.cache[require.resolve('../../src/webview/chat.js')];
        require('../../src/webview/chat.js');
        
        const event = new window.Event('DOMContentLoaded');
        document.dispatchEvent(event);
        
        const chatState = window.ChatManager?.getChatState();
        if (chatState) {
            chatState.currentSession = {
                currentArtifact: {
                    mermaidData: 'graph TD',
                    textSpec: 'Test',
                    timestamp: Date.now()
                    // No generationStatus field
                }
            };
        }
        
        // Should treat as not_started and not throw
        if (window.ArtifactManager?.handleShowCurrentSpecClick) {
            await expect(window.ArtifactManager.handleShowCurrentSpecClick()).resolves.not.toThrow();
        }
    });
});

