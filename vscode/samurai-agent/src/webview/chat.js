// Samurai Agent Chat - JavaScript functionality
// This file handles chat interactions and LLM model selection
(function initChat(globalScope) {
    console.log('Chat: chat.js script loaded');

    // Chat state
    const chatState = {
        globalSettings: null,
        projectSettings: null,
        availableModels: [],
        llmModels: null,
        currentSessionId: null,
        currentSession: null,
        lastAssistantMessageContent: null,
        lastAssistantMessageTimestamp: 0
    };

    const MessageType = {
        USER: 'user',
        ASSISTANT: 'assistant',
        SYSTEM: 'system',
        ERROR: 'error'
    };

    function escapeHtml(str) {
        if (!str || typeof str !== 'string') {
            return '';
        }
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderInlineMarkdown(text) {
        if (!text) {
            return '';
        }

        let escaped = escapeHtml(text);

        // Links [text](url)
        escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
            const safeLabel = escapeHtml(label);
            const safeUrl = escapeHtml(url);
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
        });

        // Bold **text**
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic *text*
        escaped = escaped.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, (_match, prefix, value) => {
            return `${prefix}<em>${value}</em>`;
        });

        // Inline code `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        return escaped;
    }

    function renderMarkdown(text) {
        if (!text) {
            return '';
        }

        const codeBlockRegex = /```([\s\S]*?)```/g;
        let lastIndex = 0;
        let match;
        const segments = [];

        while ((match = codeBlockRegex.exec(text)) !== null) {
            const before = text.slice(lastIndex, match.index);
            if (before) {
                segments.push(renderMarkdownBlocks(before));
            }
            const codeContent = escapeHtml(match[1].trim());
            segments.push(`<pre><code>${codeContent}</code></pre>`);
            lastIndex = match.index + match[0].length;
        }

        const remaining = text.slice(lastIndex);
        if (remaining) {
            segments.push(renderMarkdownBlocks(remaining));
        }

        return segments.join('');
    }

    function renderMarkdownBlocks(text) {
        const lines = text.split(/\r?\n/);
        const parts = [];
        let inList = false;

        const closeList = () => {
            if (inList) {
                parts.push('</ul>');
                inList = false;
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('- ')) {
                if (!inList) {
                    parts.push('<ul>');
                    inList = true;
                }
                const itemContent = renderInlineMarkdown(trimmed.slice(2).trim());
                parts.push(`<li>${itemContent}</li>`);
                continue;
            }

            closeList();

            if (trimmed.length === 0) {
                parts.push('<br>');
                continue;
            }

            const paragraphContent = renderInlineMarkdown(line);
            parts.push(`<p>${paragraphContent}</p>`);
        }

        closeList();
        return parts.join('');
    }

    function safeGetDocumentElement(id) {
        return typeof document !== 'undefined' ? document.getElementById(id) : null;
    }

    function displayMessage(message) {
        console.log('Chat: displayMessage called with:', message);
        
        const chatMessages = safeGetDocumentElement('chatMessages');
        if (!chatMessages) {
            console.error('Chat: chatMessages element not found');
            return;
        }
        if (!message) {
            console.error('Chat: message is null or undefined');
            return;
        }

        // Deduplicate consecutive identical assistant messages
        if (chatMessages.lastElementChild) {
            const lastElement = chatMessages.lastElementChild;
            if (
                message.role === 'assistant' &&
                lastElement.dataset?.role === 'assistant' &&
                lastElement.dataset?.content === (message.content || '')
            ) {
                console.log('Chat: Skipping duplicate assistant message');
                return;
            }
        }

        if (message.role === 'assistant') {
            const now = Date.now();
            if (
                chatState.lastAssistantMessageContent === (message.content || '') &&
                now - chatState.lastAssistantMessageTimestamp < 1000
            ) {
                console.log('Chat: Skipping duplicate assistant message (within threshold)');
                return;
            }

            chatState.lastAssistantMessageContent = message.content || '';
            chatState.lastAssistantMessageTimestamp = now;
        }

        console.log('Chat: Creating message element for:', message.content);

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.dataset.role = message.role || '';
        messageElement.dataset.content = message.content || '';

        if (message.type === (MessageType.ASSISTANT || 'assistant') || message.role === 'assistant') {
            messageElement.classList.add('assistant-message');
        } else if (message.type === (MessageType.USER || 'user') || message.role === 'user') {
            messageElement.classList.add('user-message');
        } else {
            messageElement.classList.add('system-message');
        }

        const contentHtml = renderMarkdown(message.content || '');
        if (contentHtml) {
            messageElement.innerHTML = contentHtml;
        } else {
            messageElement.textContent = message.content || '';
        }

        // Ensure links open safely
        messageElement.querySelectorAll('a').forEach((link) => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
        
        // Render spec clarification score if present
        if (message.specClarificationData && typeof message.specClarificationData.score === 'number') {
            const scoreElement = document.createElement('div');
            scoreElement.className = 'spec-score-container';
            
            const scoreValue = message.specClarificationData.score;
            let scoreClass = 'score-red';
            if (scoreValue >= 80) {
                scoreClass = 'score-green';
            } else if (scoreValue >= 50) {
                scoreClass = 'score-yellow';
            }
            
            scoreElement.innerHTML = `<span class="spec-score ${scoreClass}">Spec Readiness Score: ${scoreValue}/100</span>`;
            messageElement.appendChild(scoreElement);
        }
        
        // Render interactive buttons if present
        if (message.interactiveQuestions && Array.isArray(message.interactiveQuestions)) {
            message.interactiveQuestions.forEach((question) => {
                if (question.type === 'button') {
                    const buttonElement = document.createElement('button');
                    buttonElement.className = 'interactive-question-button';
                    buttonElement.textContent = question.label;
                    buttonElement.addEventListener('click', async () => {
                        console.log('Chat: Interactive button clicked, sending message:', question.messageToSend);
                        if (globalScope.WebviewApi?.agent?.execute) {
                            try {
                                const result = await globalScope.WebviewApi.agent.execute({
                                    userMessage: {
                                        id: `user-${Date.now()}`,
                                        sessionId: chatState.currentSessionId,
                                        projectId: chatState.projectSettings?.projectId,
                                        type: globalScope?.MessageType?.USER || 'user',
                                        role: 'user',
                                        content: question.messageToSend,
                                        metadata: {}
                                    },
                                    session: chatState.currentSession,
                                    message: question.messageToSend
                                });

                                const assistantMessage = handleAgentExecuteResponse(result);
                                if (assistantMessage) {
                                    if (chatState.currentSessionId && chatState.projectSettings?.projectId) {
                                        await globalScope.WebviewApi.persistence.saveChatMessage({
                                            sessionId: chatState.currentSessionId,
                                            projectId: chatState.projectSettings.projectId,
                                            type: assistantMessage.type,
                                            content: assistantMessage.content,
                                            role: assistantMessage.role,
                                            metadata: assistantMessage.metadata,
                                            specClarificationData: assistantMessage.specClarificationData,
                                            interactiveQuestions: assistantMessage.interactiveQuestions
                                        });
                                    }
                                    displayMessage(assistantMessage);
                                }
                                return;
                            } catch (error) {
                                console.error('Chat: Failed to execute agent command', error);
                            }
                        }

                        sendMessage(question.messageToSend);
                    });
                    messageElement.appendChild(buttonElement);
                }
            });
        }
        
        chatMessages.appendChild(messageElement);

        console.log('Chat: Message element appended to chatMessages');
        messageElement.scrollIntoView({ block: 'start', behavior: 'smooth' });

        return messageElement;
    }

    function showProgressIndicator(update) {
        const chatContainer = safeGetDocumentElement('chatMessages');
        if (!chatContainer) {
            return;
        }

        let banner = document.getElementById('agent-progress-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'agent-progress-banner';
            banner.className = 'agent-progress-banner';
            chatContainer.parentElement?.insertBefore(banner, chatContainer);
        }

        const { stage, data } = update || {};
        let message = 'Working...';
        if (stage === 'analyzing') {
            message = 'Analyzing conversation...';
        } else if (stage === 'extracting-code') {
            message = 'Finding relevant code context...';
        } else if (stage === 'extraction-complete') {
            const files = (data?.files || []).map((file) => file.path).slice(0, 3);
            message = files.length
                ? `Code context ready: ${files.join(', ')}`
                : 'Code context ready.';
        } else if (stage === 'extraction-failed') {
            message = 'Code extraction failed; continuing without new context.';
        } else if (stage === 'rendering-response') {
            message = 'Generating response...';
        }

        banner.textContent = message;
        banner.style.display = 'block';

        if (stage === 'rendering-response' || stage === 'extraction-complete' || stage === 'extraction-failed') {
            setTimeout(() => {
                banner.style.display = 'none';
            }, 3000);
        }
    }

    async function initializeChatSession() {
        if (!globalScope?.WebviewApi || !chatState.projectSettings) {
            return;
        }

        const { projectSettings } = chatState;
        let sessionId = projectSettings.currentSessionId;

        try {
            if (sessionId) {
                const session = await globalScope.WebviewApi.persistence.loadSession(sessionId);
                if (!session) {
                    sessionId = await createAndPersistSession();
                }
            } else {
                sessionId = await createAndPersistSession();
            }

            chatState.currentSessionId = sessionId;

            if (sessionId) {
                const messages = await globalScope.WebviewApi.persistence.loadChatMessagesForSession(sessionId);
                if (Array.isArray(messages)) {
                    messages.forEach(displayMessage);
                }

                const chatMessages = safeGetDocumentElement('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }
        } catch (error) {
            console.error('Chat: Failed to initialize session', error);
        }
    }

    async function createAndPersistSession(title = 'New Conversation') {
        if (!globalScope?.WebviewApi || !chatState.projectSettings) {
            return null;
        }

        const request = {
            title,
            projectId: chatState.projectSettings.projectId,
            model: chatState.projectSettings.primaryLLMModel || undefined,
            mode: chatState.projectSettings.defaultMode || undefined
        };

        const session = await globalScope.WebviewApi.persistence.createSession(request);
        if (session?.id) {
            chatState.projectSettings = {
                ...chatState.projectSettings,
                currentSessionId: session.id
            };
            chatState.currentSessionId = session.id;
            await globalScope.WebviewApi.persistence.saveProjectSettings(chatState.projectSettings);
            return session.id;
        }

        return null;
    }

    async function sendMessage(messageText) {
        if (!messageText || !globalScope?.WebviewApi || !chatState.projectSettings) {
            return;
        }

        try {
            if (!chatState.currentSessionId) {
                await initializeChatSession();
            }

            const sessionId = chatState.currentSessionId;
            if (!sessionId) {
                throw new Error('Chat session is not initialized');
            }

            let currentSession = chatState.currentSession;
            if (!currentSession) {
                currentSession = await globalScope.WebviewApi.persistence.loadSession(sessionId);
                chatState.currentSession = currentSession;
            }

            const chatMessages = safeGetDocumentElement('chatMessages');
            const pendingIndicator = document.createElement('div');
            pendingIndicator.className = 'assistant-message pending';
            pendingIndicator.textContent = 'Thinking...';

            const userMessage = {
                id: `user-${Date.now()}`,
                sessionId,
                projectId: chatState.projectSettings.projectId,
                type: globalScope?.MessageType?.USER || 'user',
                role: 'user',
                content: messageText,
                metadata: {}
            };

            displayMessage(userMessage);

            if (chatState.currentSessionId && chatState.projectSettings?.projectId) {
                await globalScope.WebviewApi.persistence.saveChatMessage({
                    sessionId: chatState.currentSessionId,
                    projectId: chatState.projectSettings.projectId,
                    type: userMessage.type,
                    content: userMessage.content,
                    role: userMessage.role,
                    metadata: userMessage.metadata
                });
            }

            const chatMessagesElement = safeGetDocumentElement('chatMessages');
            if (chatMessagesElement) {
                chatMessagesElement.appendChild(pendingIndicator);
                chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
            }

            const llmRequest = {
                id: `llm-${Date.now()}`,
                provider: chatState.projectSettings.primaryLLMModel ? undefined : 'auto',
                model: chatState.projectSettings.primaryLLMModel || undefined,
                messages: [
                    { role: 'system', content: 'You are Samurai Agent.' },
                    { role: 'user', content: messageText }
                ],
                metadata: {}
            };

            const llmResponse = await globalScope.WebviewApi.llm.chat(llmRequest, 12000000);

            if (chatMessagesElement && pendingIndicator.parentElement === chatMessagesElement) {
                chatMessagesElement.removeChild(pendingIndicator);
            }

            console.log('Chat: Received LLM response:', llmResponse);
            
            const normalizedResponse = llmResponse?.payload ? llmResponse.payload : llmResponse;

            if (!normalizedResponse) {
                const errorContent = llmResponse?.error ? `Error: ${llmResponse.error}` : 'No response generated.';
                const fallbackMessage = buildAssistantMessageFromAgentResponse({ message: errorContent, metadata: { error: llmResponse?.error } });
                if (fallbackMessage) {
                    await persistAssistantMessage(fallbackMessage);
                    const fallbackElement = displayMessage(fallbackMessage);
                    renderAssistantResponse(fallbackElement, fallbackMessage);
                }
                return;
            }

            const assistantMessage = buildAssistantMessageFromAgentResponse(normalizedResponse);
            if (assistantMessage) {
                await persistAssistantMessage(assistantMessage);
                const messageElement = displayMessage(assistantMessage);
                renderAssistantResponse(messageElement, assistantMessage);
            }
        } catch (error) {
            console.error('Chat: Failed to send message', error);
            displayMessage({
                id: `error-${Date.now()}`,
                sessionId: chatState.currentSessionId,
                projectId: chatState.projectSettings.projectId,
                type: globalScope?.MessageType?.ERROR || 'error',
                role: 'assistant',
                content: `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`,
                metadata: { error }
            });
        }
    }

    function handleAgentExecuteResponse(result) {
        if (!result || typeof result !== 'object') {
            console.warn('Chat: Agent execute returned unexpected result', result);
            return null;
        }

        const { message, metadata } = result;
        const assistantMessage = buildAssistantMessageFromAgentResponse(message || 'No response', metadata || {});
        return assistantMessage;
    }

    function buildAssistantMessageFromAgentResponse(rawResponse) {
        if (!rawResponse || typeof rawResponse !== 'object') {
            return null;
        }

        const content = rawResponse.message ?? rawResponse.content ?? '';
        const metadata = rawResponse.metadata ?? {};
        const specClarificationData = rawResponse.specClarificationData
            ?? metadata.specClarificationData
            ?? rawResponse.payload?.specClarificationData;
        const interactiveQuestions = rawResponse.interactiveQuestions
            ?? metadata.interactiveQuestions
            ?? rawResponse.payload?.interactiveQuestions;

        const sessionId = chatState.currentSessionId;
        const projectId = chatState.projectSettings?.projectId;

        const enrichedMetadata = {
            ...metadata,
            ...(specClarificationData ? { specClarificationData } : {}),
            ...(interactiveQuestions ? { interactiveQuestions } : {}),
            samuraiAgentResponse: Boolean(metadata.samuraiAgentResponse || rawResponse.samuraiAgentResponse)
        };

        return {
            id: `assistant-${Date.now()}`,
            sessionId: sessionId || 'unknown-session',
            projectId: projectId || 'unknown-project',
            type: globalScope?.MessageType?.ASSISTANT || 'assistant',
            role: 'assistant',
            content,
            metadata: enrichedMetadata,
            specClarificationData,
            interactiveQuestions
        };
    }

    async function persistAssistantMessage(message) {
        if (!message || !message.sessionId || !message.projectId) {
            console.warn('Chat: Cannot persist assistant message without session/project context');
            return;
        }

        await globalScope.WebviewApi.persistence.saveChatMessage({
            sessionId: message.sessionId,
            projectId: message.projectId,
            type: message.type,
            content: message.content,
            role: message.role,
            metadata: message.metadata,
            specClarificationData: message.specClarificationData,
            interactiveQuestions: message.interactiveQuestions
        });
    }

    function renderAssistantResponse(messageElement, assistantMessage) {
        if (!assistantMessage) {
            return;
        }

        if (assistantMessage.specClarificationData) {
            const scoreValue = assistantMessage.specClarificationData.score;
            let scoreClass = 'score-red';
            if (scoreValue >= 80) {
                scoreClass = 'score-green';
            } else if (scoreValue >= 50) {
                scoreClass = 'score-yellow';
            }

            const scoreElement = document.createElement('div');
            scoreElement.className = 'spec-score-container';
            scoreElement.innerHTML = `<span class="spec-score ${scoreClass}">Spec Readiness Score: ${scoreValue}/100</span>`;
            messageElement.appendChild(scoreElement);
        }

        if (assistantMessage.interactiveQuestions && Array.isArray(assistantMessage.interactiveQuestions)) {
            assistantMessage.interactiveQuestions.forEach((question) => {
                if (question.type === 'button') {
                    const buttonElement = document.createElement('button');
                    buttonElement.className = 'interactive-question-button';
                    buttonElement.textContent = question.label;
                    buttonElement.addEventListener('click', async () => {
                        console.log('Chat: Interactive button clicked, sending message:', question.messageToSend);
                        let result;
                        if (globalScope.WebviewApi?.agent?.execute) {
                            try {
                                result = await globalScope.WebviewApi.agent.execute({
                                    userMessage: {
                                        id: `user-${Date.now()}`,
                                        sessionId: chatState.currentSessionId,
                                        projectId: chatState.projectSettings?.projectId,
                                        type: globalScope?.MessageType?.USER || 'user',
                                        role: 'user',
                                        content: question.messageToSend,
                                        metadata: {}
                                    },
                                    session: chatState.currentSession,
                                    message: question.messageToSend
                                });
                            } catch (error) {
                                console.error('Chat: Failed to execute agent command', error);
                                await sendMessage(question.messageToSend);
                                return;
                            }
                        } else {
                            await sendMessage(question.messageToSend);
                            return;
                        }

                        const assistantResponse = buildAssistantMessageFromAgentResponse(result);
                        if (assistantResponse) {
                            await persistAssistantMessage(assistantResponse);
                            displayMessage(assistantResponse);
                        }
                    });
                    messageElement.appendChild(buttonElement);
                }
            });
        }
    }

    function initializeChat() {
        console.log('Chat: Initializing chat functionality...');

        if (typeof document === 'undefined') {
            return;
        }

        document.addEventListener('DOMContentLoaded', () => {
            let chatInput = safeGetDocumentElement('chatInput');
            const chatMessages = safeGetDocumentElement('chatMessages');
            const startNewConversationBtn = safeGetDocumentElement('start-new-conversation-btn');
            const llmModelSelect = safeGetDocumentElement('llm-model-select');

            initializeMessageListener(chatMessages);

            if (chatInput && chatInput.tagName?.toLowerCase() === 'input') {
                const textArea = document.createElement('textarea');
                textArea.id = chatInput.id;
                textArea.className = chatInput.className || '';
                textArea.placeholder = chatInput.getAttribute('placeholder') || '';
                textArea.value = chatInput.value || '';
                textArea.rows = 3;
                textArea.style.resize = 'vertical';
                chatInput.replaceWith(textArea);
                chatInput = textArea;

                const hint = document.createElement('div');
                hint.className = 'chat-input-hint';
                hint.textContent = 'Press Enter to send • Shift + Enter for a new line';
                if (textArea.parentElement) {
                    textArea.parentElement.appendChild(hint);
                }

                injectChatInputStyles();
            }

            if (chatInput) {
                chatInput.addEventListener('keydown', event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        // Only prevent default and send on Enter without Shift
                        event.preventDefault();
                        const message = chatInput.value.trim();
                        if (message) {
                            chatInput.value = '';
                            void sendMessage(message);
                        }
                    }
                    // Shift+Enter: do nothing, let the browser insert a newline naturally
                });
                chatInput.focus();
            }

            if (startNewConversationBtn) {
                 startNewConversationBtn.addEventListener('click', async () => {
                    console.log('Chat: Start New Conversation button clicked');
                    if (!globalScope?.WebviewApi || !chatState.projectSettings) {
                        console.warn('Chat: Missing WebviewApi or projectSettings - cannot start new conversation');
                        return;
                    }

                    if (chatMessages) {
                        console.log('Chat: Clearing chat messages for new conversation');
                        chatMessages.innerHTML = '';
                    }
                    if (chatInput) {
                        chatInput.value = '';
                        console.log('Chat: Chat input cleared and focus requested');
                        chatInput.focus();
                    }

                    try {
                        console.log('Chat: Loading previous messages for context build', {
                            currentSessionId: chatState.currentSessionId,
                        });
                        // Load current chat messages before creating new session
                        let previousMessages = [];
                        if (chatState.currentSessionId) {
                            try {
                                previousMessages = await globalScope.WebviewApi.persistence.loadChatMessagesForSession(chatState.currentSessionId);
                                console.log('Chat: Loaded previous messages', {
                                    count: Array.isArray(previousMessages) ? previousMessages.length : 0,
                                });
                            } catch (error) {
                                console.warn('Chat: Could not load previous session messages', error);
                            }
                        }

                        // Create new session
                        console.log('Chat: Creating new session for conversation');
                        const newSessionId = await createAndPersistSession('New Conversation');
                        console.log('Chat: New session created', { newSessionId });
                        if (newSessionId) {
                            const messages = await globalScope.WebviewApi.persistence.loadChatMessagesForSession(newSessionId);
                            if (Array.isArray(messages)) {
                                console.log('Chat: Rendering messages from new session', {
                                    count: messages.length,
                                });
                                messages.forEach(displayMessage);
                            }
                        }

                        // Build conversation context from previous messages
                        let conversationContext = '';
                        if (Array.isArray(previousMessages) && previousMessages.length > 0) {
                            console.log('Chat: Building conversation context from previous messages');
                            conversationContext = previousMessages
                                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                                .join('\n\n');
                        }

                        // Get project details
                        const settingsState = globalScope?.SettingsManager?.getSettings?.();
                        let rawProjectDetailContent = settingsState?.projectSettings?.rawProjectDetailContent || chatState.projectSettings?.rawProjectDetailContent || '';
                        console.log('Chat: Retrieved project detail content', {
                            hasSettingsState: !!settingsState,
                            rawProjectDetailLength: rawProjectDetailContent?.length || 0,
                        });
                        
                        // If no explicit project detail, use a default description
                        if (!rawProjectDetailContent.trim()) {
                            console.log('Chat: No explicit project detail found. Using default context.');
                            rawProjectDetailContent = 'A software development project with an AI coding assistant.';
                        }

                        // Combine project details with conversation context
                        let ingestContent = rawProjectDetailContent;
                        if (conversationContext) {
                            console.log('Chat: Appending conversation context to project detail');
                            ingestContent = `${rawProjectDetailContent}\n\n## Previous Conversation Context:\n${conversationContext}`;
                        }

                        // Always ingest - either project details, conversation history, or both
                        console.log('Chat: Ingesting project context and conversation history');
                        globalScope.WebviewApi.projectDetail.ingest({
                            projectId: chatState.projectSettings.projectId,
                            rawText: ingestContent,
                            mode: 'merge'
                        }).then(() => {
                            console.log('Chat: Successfully ingested project context');
                        }).catch(error => {
                            console.error('Chat: Failed to merge project detail memory', error);
                        });
                    } catch (error) {
                        console.error('Chat: Failed to start new conversation', error);
                    }
                });
            }

            if (llmModelSelect) {
                llmModelSelect.addEventListener('change', function onChange() {
                    handleLLMModelChange(this.value);
                });
            }

            const chatTab = safeGetDocumentElement('chat-tab');
            if (chatTab) {
                chatTab.addEventListener('click', async () => {
                    await refreshLLMModelDropdown();
                });
            }

            setTimeout(async () => {
                if (!chatState.availableModels || chatState.availableModels.length === 0) {
                    await refreshLLMModelDropdown();
                }
            }, 2000);
        });
    }

    function handleInitialSettings(payload) {
        if (!payload) {
            return;
        }

        chatState.globalSettings = payload.globalSettings;
        chatState.projectSettings = payload.projectSettings;
        chatState.availableModels = payload.availableModels || [];
        chatState.llmModels = payload.llmModels;

        populateLLMModelDropdown();

        const primaryModel = chatState.projectSettings?.primaryLLMModel;
        const llmModelSelect = safeGetDocumentElement('llm-model-select');
        if (primaryModel && llmModelSelect) {
            llmModelSelect.value = primaryModel;
        }

        void initializeChatSession();
    }

    function populateLLMModelDropdown() {
        const llmModelSelect = safeGetDocumentElement('llm-model-select');
        if (!llmModelSelect || !Array.isArray(chatState.availableModels)) {
            return;
        }

        llmModelSelect.innerHTML = '';

        chatState.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            llmModelSelect.appendChild(option);
        });

        if (chatState.availableModels.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available - configure API keys in Settings';
            option.disabled = true;
            llmModelSelect.appendChild(option);
        }
    }

    async function handleLLMModelChange(selectedModelId) {
        if (!selectedModelId || !chatState.projectSettings || !globalScope?.WebviewApi) {
            return;
        }

        try {
            const updatedProjectSettings = {
                ...chatState.projectSettings,
                primaryLLMModel: selectedModelId
            };

            await globalScope.WebviewApi.persistence.saveProjectSettings(updatedProjectSettings);
            chatState.projectSettings = updatedProjectSettings;
            console.log('LLM model changed to:', selectedModelId);
        } catch (error) {
            console.error('Error saving LLM model selection:', error);
        }
    }

    async function refreshLLMModelDropdown() {
        if (!globalScope?.WebviewApi) {
            return;
        }

        try {
            const globalSettings = await globalScope.WebviewApi.persistence.loadGlobalSettings();
            if (!globalSettings || !chatState.llmModels) {
                return;
            }

            chatState.globalSettings = globalSettings;

            const availableModels = [];

            if (globalSettings.openaiApiKey?.trim()) {
                availableModels.push(...chatState.llmModels.openai);
            }

            if (globalSettings.geminiApiKey?.trim()) {
                availableModels.push(...chatState.llmModels.google);
            }

            if (globalSettings.claudeApiKey?.trim()) {
                availableModels.push(...chatState.llmModels.anthropic);
            }

            chatState.availableModels = availableModels.sort((a, b) => {
                if (a.provider !== b.provider) {
                    return a.provider.localeCompare(b.provider);
                }
                return a.name.localeCompare(b.name);
            });

            populateLLMModelDropdown();

            const currentSelection = chatState.projectSettings?.primaryLLMModel;
            if (currentSelection && !chatState.availableModels.some(model => model.id === currentSelection)) {
                if (chatState.availableModels.length > 0) {
                    const newSelection = chatState.availableModels[0].id;
                    const llmModelSelect = safeGetDocumentElement('llm-model-select');
                    if (llmModelSelect) {
                        llmModelSelect.value = newSelection;
                    }
                    chatState.projectSettings = {
                        ...(chatState.projectSettings || {}),
                        primaryLLMModel: newSelection
                    };
                    await globalScope.WebviewApi.persistence.saveProjectSettings(chatState.projectSettings);
                }
            }
        } catch (error) {
            console.error('Error refreshing LLM model dropdown:', error);
        }
    }

    function initializeMessageListener(chatMessagesElement) {
        const listeners = new Set();

        const dispatchNotification = async (type, payload) => {
            if (type === 'initialSettings' && payload) {
                handleInitialSettings(payload);
                chatMessagesElement?.dispatchEvent(new CustomEvent('chat-initialized'));
                return;
            }

            if (type === 'globalSettingsUpdated') {
                await refreshLLMModelDropdown();
                chatMessagesElement?.dispatchEvent(new CustomEvent('chat-settings-updated'));
            }
        };

        const onMessage = async message => {
            if (!message || typeof message !== 'object') {
                return;
            }

            if (message.type === 'success' && message.requestId) {
                const payload = message.payload || {};

                if (payload?.content && payload?.metadata?.samuraiAgentResponse) {
                    const assistantMessage = {
                        id: `assistant-${Date.now()}`,
                        sessionId: chatState.currentSessionId,
                        projectId: chatState.projectSettings?.projectId,
                        type: globalScope?.MessageType?.ASSISTANT || 'assistant',
                        role: 'assistant',
                        content: payload.content,
                        metadata: payload.metadata || {}
                    };

                    displayMessage(assistantMessage);
                    chatState.lastAssistantMessageContent = assistantMessage.content;
                    chatState.lastAssistantMessageTimestamp = Date.now();
                }

                return;
            }

            if (message.type === 'error' && message.requestId) {
                const errorMessage = {
                    id: `assistant-error-${Date.now()}`,
                    sessionId: chatState.currentSessionId,
                    projectId: chatState.projectSettings?.projectId,
                    type: globalScope?.MessageType?.ERROR || 'error',
                    role: 'assistant',
                    content: `Error: ${message.error || 'Unknown error from agent'}`,
                    metadata: { error: message.error }
                };

                displayMessage(errorMessage);
                chatState.lastAssistantMessageContent = errorMessage.content;
                chatState.lastAssistantMessageTimestamp = Date.now();
                return;
            }

            if (message.type === 'agentProgress') {
                showProgressIndicator(message.payload);
                return;
            }

            if (!message.requestId && message.type) {
                await dispatchNotification(message.type, message.payload);
            }
        };

        globalScope.addEventListener('message', async event => {
            await onMessage(event.data);
        });

        if (globalScope.WebviewApi?.subscribe) {
            const unsubscribe = globalScope.WebviewApi.subscribe(async message => {
                await onMessage(message);
            });
            listeners.add(unsubscribe);
        }

        return () => {
            listeners.forEach(unsubscribe => unsubscribe());
            listeners.clear();
        };
    }

    function injectChatInputStyles() {
        if (document.getElementById('chat-input-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'chat-input-style';
        style.textContent = `
            .chat-input-container {
                padding: 10px;
                background-color: var(--vscode-panel-background);
                border-top: 1px solid var(--vscode-panel-border);
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            #chatInput {
                width: 100%;
                padding: 12px;
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                box-sizing: border-box;
                resize: vertical;
                min-height: 60px;
            }

            .chat-input-hint {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                user-select: none;
            }
        `;

        document.head.appendChild(style);
    }

    // Bootstrapping
    if (globalScope) {
        if (!globalScope.WebviewApi) {
            console.warn('Chat: WebviewApi not ready yet; deferring init...');
            if (typeof document !== 'undefined') {
                document.addEventListener('readystatechange', function onReady() {
                    if (globalScope.WebviewApi) {
                        document.removeEventListener('readystatechange', onReady);
                        initializeChat();
                    }
                });
            }
        } else {
            initializeChat();
        }

        globalScope.ChatManager = {
            handleInitialSettings,
            populateLLMModelDropdown,
            handleLLMModelChange,
            refreshLLMModelDropdown,
            initializeMessageListener,
            displayMessage,
            MessageType,
            getChatState: () => chatState
        };
    }
})(typeof window !== 'undefined' ? window : undefined);

if (typeof module !== 'undefined') {
    const exportsForTests = require('./chat.js');
    module.exports = exportsForTests;
}
