const { JSDOM } = require('jsdom');

describe('Chat Webview', () => {
    let dom;
    let window;
    let document;
    let dropdown;
    let dispatchedEvents;

    beforeEach(() => {
        dom = new JSDOM(`
            <div>
                <div id="chatMessages"></div>
                <select id="llm-model-select"></select>
            </div>
        `, { runScripts: 'outside-only' });

        ({ window } = dom);
        ({ document } = window);

        dispatchedEvents = [];
        document.getElementById('chatMessages').addEventListener('chat-settings-updated', () => {
            dispatchedEvents.push('chat-settings-updated');
        });

        dropdown = document.getElementById('llm-model-select');

        global.window = window;
        global.document = document;

        window.WebviewApi = {
            persistence: {
                loadGlobalSettings: jest.fn().mockResolvedValue({
                    openaiApiKey: 'test-openai-key',
                    geminiApiKey: 'test-gemini-key'
                })
            },
            subscribe: jest.fn().mockImplementation(callback => {
                window.__subscriber = callback;
                return () => {};
            })
        };

        window.CustomEvent = dom.window.CustomEvent;

        const script = require('../../src/webview/chat.js');
        script.__setWindow?.(window);
    });

    afterEach(() => {
        jest.resetModules();
        delete global.window;
        delete global.document;
    });

    it('refreshes dropdown when globalSettingsUpdated message received', async () => {
        window.ChatManager = {
            refreshLLMModelDropdown: jest.fn().mockResolvedValue(undefined),
            handleInitialSettings: jest.fn()
        };

        require('../../src/webview/chat.js');

        const handler = require('../../src/webview/chat.js').__getMessageHandler?.();
        await handler({ type: 'globalSettingsUpdated' });

        expect(window.ChatManager.refreshLLMModelDropdown).toHaveBeenCalled();
    });
});

describe('Progress Indicator Positioning', () => {
    let dom;
    let window;
    let document;
    let chatMessages;

    beforeEach(() => {
        // Create a more complete DOM structure for testing
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="chatMessages"></div>
            </body>
            </html>
        `, { runScripts: 'outside-only' });

        ({ window } = dom);
        ({ document } = window);
        chatMessages = document.getElementById('chatMessages');

        global.window = window;
        global.document = document;

        // Set up WebviewApi mock
        window.WebviewApi = {
            persistence: {
                loadGlobalSettings: jest.fn().mockResolvedValue({
                    openaiApiKey: 'test-key',
                    geminiApiKey: 'test-key'
                }),
                loadProjectSettings: jest.fn().mockResolvedValue({
                    projectId: 'test-project',
                    primaryLLMModel: 'test-model'
                })
            },
            subscribe: jest.fn().mockImplementation(callback => {
                window.__subscriber = callback;
                return () => {};
            })
        };

        window.CustomEvent = dom.window.CustomEvent;

        // Load the chat.js module to get access to functions
        delete require.cache[require.resolve('../../src/webview/chat.js')];
        require('../../src/webview/chat.js');
    });

    afterEach(() => {
        jest.resetModules();
        delete global.window;
        delete global.document;
    });

    /**
     * Helper function to create a user message element
     */
    function createUserMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message user-message';
        messageEl.textContent = content;
        return messageEl;
    }

    /**
     * Helper function to create an assistant message element
     */
    function createAssistantMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message assistant-message';
        messageEl.textContent = content;
        return messageEl;
    }

    /**
     * Helper function to create a pending "Thinking..." indicator
     */
    function createPendingIndicator() {
        const pendingEl = document.createElement('div');
        pendingEl.className = 'assistant-message pending';
        pendingEl.textContent = 'Thinking...';
        return pendingEl;
    }

    /**
     * Helper function to trigger showProgressIndicator via window event
     */
    function triggerProgressUpdate(stage, data = null) {
        if (window.__subscriber) {
            window.__subscriber({
                type: 'agentProgress',
                payload: { stage, data }
            });
        }
    }

    /**
     * Helper to get banner position relative to a reference element
     */
    function getBannerPositionRelativeTo(banner, referenceElement) {
        const allElements = Array.from(chatMessages.children);
        const bannerIndex = allElements.indexOf(banner);
        const refIndex = allElements.indexOf(referenceElement);
        return bannerIndex - refIndex;
    }

    it('should position progress banner after the latest user message on first call', () => {
        // Setup: Add multiple user messages
        const firstUserMsg = createUserMessage('First message');
        const secondUserMsg = createUserMessage('Second message');
        const thirdUserMsg = createUserMessage('Third message');
        
        chatMessages.appendChild(firstUserMsg);
        chatMessages.appendChild(createAssistantMessage('Response 1'));
        chatMessages.appendChild(secondUserMsg);
        chatMessages.appendChild(createAssistantMessage('Response 2'));
        chatMessages.appendChild(thirdUserMsg);

        // Trigger progress update
        triggerProgressUpdate('extracting-code');

        // Assert: Banner should be after the third (latest) user message
        const banner = document.getElementById('agent-progress-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toBe('Finding relevant code context...');
        
        const positionRelativeToLatest = getBannerPositionRelativeTo(banner, thirdUserMsg);
        expect(positionRelativeToLatest).toBe(1); // Should be immediately after
    });

    it('should reposition progress banner after latest user message on subsequent calls', () => {
        // Setup: Add first user message and trigger progress
        const firstUserMsg = createUserMessage('First message');
        chatMessages.appendChild(firstUserMsg);
        triggerProgressUpdate('analyzing');

        const banner = document.getElementById('agent-progress-banner');
        expect(banner).not.toBeNull();
        
        // Verify initial position (after first message)
        let positionRelativeToFirst = getBannerPositionRelativeTo(banner, firstUserMsg);
        expect(positionRelativeToFirst).toBe(1);

        // Now add second user message
        const secondUserMsg = createUserMessage('Second message');
        chatMessages.appendChild(secondUserMsg);

        // Trigger another progress update
        triggerProgressUpdate('extracting-code');

        // Assert: Same banner should now be after second message
        const sameBanner = document.getElementById('agent-progress-banner');
        expect(sameBanner).toBe(banner); // Should be the same element
        
        const positionRelativeToSecond = getBannerPositionRelativeTo(banner, secondUserMsg);
        expect(positionRelativeToSecond).toBe(1); // Should be immediately after second message
        
        // Should NOT be after first message anymore
        const positionRelativeToFirstNow = getBannerPositionRelativeTo(banner, firstUserMsg);
        expect(positionRelativeToFirstNow).toBeGreaterThan(1);
    });

    it('should prioritize positioning after "Thinking..." indicator over user message', () => {
        // Setup: Add user message and pending indicator
        const userMsg = createUserMessage('User message');
        const pendingIndicator = createPendingIndicator();
        
        chatMessages.appendChild(userMsg);
        chatMessages.appendChild(pendingIndicator);

        // Trigger progress update
        triggerProgressUpdate('extracting-code');

        // Assert: Banner should be after pending indicator, not user message
        const banner = document.getElementById('agent-progress-banner');
        expect(banner).not.toBeNull();
        
        const positionRelativeToPending = getBannerPositionRelativeTo(banner, pendingIndicator);
        expect(positionRelativeToPending).toBe(1); // Should be immediately after pending indicator
    });

    it('should update banner text content on each progress update', () => {
        // Setup
        const userMsg = createUserMessage('Test message');
        chatMessages.appendChild(userMsg);

        // First update
        triggerProgressUpdate('analyzing');
        let banner = document.getElementById('agent-progress-banner');
        expect(banner.textContent).toBe('Analyzing conversation...');

        // Second update
        triggerProgressUpdate('extracting-code');
        banner = document.getElementById('agent-progress-banner');
        expect(banner.textContent).toBe('Finding relevant code context...');

        // Third update with data
        triggerProgressUpdate('extraction-complete', {
            files: [
                { path: 'file1.js' },
                { path: 'file2.js' },
                { path: 'file3.js' }
            ]
        });
        banner = document.getElementById('agent-progress-banner');
        expect(banner.textContent).toBe('Code context ready: file1.js, file2.js, file3.js');
    });

    it('should remove banner from DOM after completion stages', (done) => {
        // Setup
        const userMsg = createUserMessage('Test message');
        chatMessages.appendChild(userMsg);

        // Trigger completion stage
        triggerProgressUpdate('rendering-response');

        const banner = document.getElementById('agent-progress-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toBe('Generating response...');

        // Wait for timeout (3000ms + buffer)
        setTimeout(() => {
            const bannerAfterTimeout = document.getElementById('agent-progress-banner');
            expect(bannerAfterTimeout).toBeNull(); // Should be removed from DOM
            done();
        }, 3100);
    });

    it('should handle missing chatMessages container gracefully', () => {
        // Remove chatMessages element
        chatMessages.remove();

        // Should not throw error
        expect(() => {
            triggerProgressUpdate('analyzing');
        }).not.toThrow();

        // Banner should not be created
        const banner = document.getElementById('agent-progress-banner');
        expect(banner).toBeNull();
    });

    it('should fallback to appending when no user message exists', () => {
        // Setup: Empty chat or only assistant messages
        chatMessages.appendChild(createAssistantMessage('Assistant message'));

        // Trigger progress update
        triggerProgressUpdate('analyzing');

        // Assert: Banner should be appended to end
        const banner = document.getElementById('agent-progress-banner');
        expect(banner).not.toBeNull();
        expect(chatMessages.lastChild).toBe(banner);
    });

    it('should handle multiple rapid progress updates correctly', () => {
        // Setup
        const userMsg = createUserMessage('Test message');
        chatMessages.appendChild(userMsg);

        // Trigger multiple rapid updates
        triggerProgressUpdate('analyzing');
        triggerProgressUpdate('extracting-code');
        triggerProgressUpdate('extraction-complete');

        // Should only have ONE banner element
        const banners = chatMessages.querySelectorAll('#agent-progress-banner');
        expect(banners.length).toBe(1);

        // Banner should have latest message
        const banner = document.getElementById('agent-progress-banner');
        expect(banner.textContent).toBe('Code context ready.');
    });
});

