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

        const script = require('../chat.js');
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

        require('../chat.js');

        const handler = require('../chat.js').__getMessageHandler?.();
        await handler({ type: 'globalSettingsUpdated' });

        expect(window.ChatManager.refreshLLMModelDropdown).toHaveBeenCalled();
    });
});

