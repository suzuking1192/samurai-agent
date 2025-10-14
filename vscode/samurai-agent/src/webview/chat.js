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
        lastAssistantMessageTimestamp: 0,
        messagesLoaded: false, // Track if messages have been loaded
        lastRefreshTime: 0 // Track when we last refreshed to prevent rapid refreshes
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

    // Track monthly cost
    let monthlyTotalCost = 0;

    async function updateApiCostDisplay(newCost) {
        console.log('[COST DEBUG] updateApiCostDisplay called with cost:', {
            cost: newCost,
            costType: typeof newCost,
            currentMonthlyTotal: monthlyTotalCost,
            timestamp: new Date().toISOString()
        });
        
        // Query the extension for current monthly cost
        try {
            // Get monthly cost from extension's local storage (persistent across F5 resets)
            if (globalScope.WebviewApi?.postCommand) {
                try {
                    const monthlyStats = await globalScope.WebviewApi.postCommand('samurai-agent.getBackendMonthlyCost');
                    console.log('[COST DEBUG] Got monthly cost from extension:', monthlyStats);
                    
                    if (monthlyStats && typeof monthlyStats.total_cost === 'number') {
                        const previousCost = monthlyTotalCost;
                        monthlyTotalCost = monthlyStats.total_cost;
                        console.log('[COST DEBUG] Updated monthlyTotalCost from extension:', {
                            previous: previousCost,
                            current: monthlyTotalCost,
                            difference: monthlyTotalCost - previousCost,
                            extensionTotalCost: monthlyStats.total_cost,
                            extensionCallCount: monthlyStats.call_count
                        });
                    }
                } catch (extensionError) {
                    console.warn('[COST DEBUG] Extension monthly cost not available, falling back to extension storage:', extensionError);
                }
            }
            
            // Fallback to VS Code extension storage if backend is not available
            if (monthlyTotalCost === 0 && globalScope.WebviewApi?.cost?.getStatistics) {
                const stats = await globalScope.WebviewApi.cost.getStatistics();
                console.log('[COST DEBUG] Got cost statistics from extension storage:', {
                    stats,
                    totalRecords: stats?.totalRecords,
                    totalCost: stats?.totalCost,
                    currentMonthCost: stats?.currentMonthCost,
                    currentSessionCost: stats?.currentSessionCost,
                    oldestRecord: stats?.oldestRecord,
                    newestRecord: stats?.newestRecord
                });
                
                if (stats && typeof stats.currentMonthCost === 'number') {
                    const previousCost = monthlyTotalCost;
                    monthlyTotalCost = stats.currentMonthCost;
                    console.log('[COST DEBUG] Updated monthlyTotalCost from extension storage:', {
                        previous: previousCost,
                        current: monthlyTotalCost,
                        difference: monthlyTotalCost - previousCost,
                        currentMonthCost: stats.currentMonthCost,
                        totalCost: stats.totalCost
                    });
                } else {
                    console.warn('[COST DEBUG] No valid currentMonthCost in extension stats:', stats);
                }
            }
        } catch (error) {
            console.error('[COST DEBUG] Failed to get cost statistics:', error);
        }
        
        const costDisplay = safeGetDocumentElement('api-cost-display');
        console.log('[COST DEBUG] Cost display element:', {
            found: !!costDisplay,
            monthlyTotalCost
        });
        
        if (costDisplay) {
            const formattedCost = monthlyTotalCost < 0.01 
                ? `$${monthlyTotalCost.toFixed(4)}` 
                : `$${monthlyTotalCost.toFixed(2)}`;
            
            // Check if we're in development mode (cost is 0 but we expect some cost)
            const isDevelopmentMode = monthlyTotalCost === 0 && newCost === 0;
            const displayText = isDevelopmentMode 
                ? `API Cost: ${formattedCost} this month`
                : `API Cost: ${formattedCost} this month`;
                
            costDisplay.textContent = displayText;
            console.log('[COST DEBUG] Updated cost display to:', costDisplay.textContent);
        } else {
            console.warn('[COST DEBUG] Cost display element not found!');
        }
    }

    /**
     * Creates a confirmation question block with interactive buttons
     * @param {Object} confirmationQuestion - The confirmation question object with originalQuestionText
     * @returns {HTMLElement} The confirmation block element
     */
    function createConfirmationQuestionBlock(confirmationQuestion) {
        const blockContainer = document.createElement('div');
        blockContainer.className = 'samurai-confirmation-block';
        
        // Create question paragraph
        const questionParagraph = document.createElement('p');
        questionParagraph.className = 'samurai-confirmation-question';
        
        // Store the original question text in a data attribute (for later retrieval)
        questionParagraph.setAttribute('data-question', confirmationQuestion.originalQuestionText);
        
        // Render the question text with markdown
        const renderedQuestionHtml = renderInlineMarkdown(confirmationQuestion.originalQuestionText);
        questionParagraph.innerHTML = renderedQuestionHtml;
        
        blockContainer.appendChild(questionParagraph);
        
        // Create buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'samurai-confirmation-buttons';
        
        // Create Yes button
        const yesButton = document.createElement('button');
        yesButton.className = 'samurai-button-yes';
        yesButton.textContent = 'Yes';
        yesButton.addEventListener('click', () => {
            handleConfirmationButtonClick(questionParagraph, 'YES');
        });
        
        // Create No button
        const noButton = document.createElement('button');
        noButton.className = 'samurai-button-no';
        noButton.textContent = 'No';
        noButton.addEventListener('click', () => {
            handleConfirmationButtonClick(questionParagraph, 'NO');
        });
        
        // Create AI Recommendation button
        const aiRecommendationButton = document.createElement('button');
        aiRecommendationButton.className = 'samurai-button-ai-recommendation';
        aiRecommendationButton.textContent = 'Ask for AI recommendation';
        aiRecommendationButton.addEventListener('click', () => {
            handleConfirmationButtonClick(questionParagraph, 'AI_RECOMMENDATION');
        });
        
        buttonsContainer.appendChild(yesButton);
        buttonsContainer.appendChild(noButton);
        buttonsContainer.appendChild(aiRecommendationButton);
        
        blockContainer.appendChild(buttonsContainer);
        
        // Create separator
        const separator = document.createElement('hr');
        separator.className = 'samurai-button-separator';
        blockContainer.appendChild(separator);
        
        return blockContainer;
    }
    
    /**
     * Handles confirmation button clicks and populates the chat input
     * @param {HTMLElement} questionElement - The question paragraph element
     * @param {string} buttonType - The type of button clicked (YES, NO, AI_RECOMMENDATION)
     */
    function handleConfirmationButtonClick(questionElement, buttonType) {
        const questionText = questionElement.getAttribute('data-question');
        if (!questionText) {
            console.warn('Chat: No question text found in data-question attribute');
            return;
        }
        
        let messageText = '';
        
        switch (buttonType) {
            case 'YES':
                messageText = `I would like to answer "YES" to ${questionText}`;
                break;
            case 'NO':
                messageText = `I would like to answer "NO" to ${questionText}`;
                break;
            case 'AI_RECOMMENDATION':
                messageText = `Please provide an AI recommendation for: ${questionText}`;
                break;
            default:
                console.warn('Chat: Unknown button type:', buttonType);
                return;
        }
        
        // Populate the chat input field with conditional logic for empty vs non-empty input
        const chatInput = safeGetDocumentElement('chatInput');
        if (chatInput) {
            const currentValue = chatInput.value;
            
            if (currentValue.trim() === '') {
                // If input field is empty, set the value directly without a leading space
                chatInput.value = messageText;
            } else {
                // If input field is not empty, append with a single space separator
                chatInput.value = `${currentValue} ${messageText}`;
            }
            
            chatInput.focus();
            console.log('Chat: Updated chat input with:', chatInput.value);
        } else {
            console.error('Chat: chatInput element not found');
        }
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

        const hasRichAssistantContent =
            !!message.specClarificationData ||
            (Array.isArray(message.interactiveQuestions) && message.interactiveQuestions.length > 0) ||
            (Array.isArray(message.interactiveConfirmationQuestions) && message.interactiveConfirmationQuestions.length > 0);

        // Deduplicate consecutive identical assistant messages without special content
        // CRITICAL: Never skip messages with rich content (spec scores, interactive buttons, etc.)
        if (chatMessages.lastElementChild && !hasRichAssistantContent) {
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

        // Additional deduplication check for messages without rich content
        if (message.role === 'assistant' && !hasRichAssistantContent) {
            const now = Date.now();
            if (
                chatState.lastAssistantMessageContent === (message.content || '') &&
                now - chatState.lastAssistantMessageTimestamp < 1000
            ) {
                console.log('Chat: Skipping duplicate assistant message (within threshold)');
                return;
            }
        }

        if (message.role === 'assistant') {
            chatState.lastAssistantMessageContent = message.content || '';
            chatState.lastAssistantMessageTimestamp = Date.now();
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

        // Process content to replace confirmation questions with unique markers
        let processedContent = message.content || '';
        const confirmationReplacements = [];
        
        if (message.interactiveConfirmationQuestions && Array.isArray(message.interactiveConfirmationQuestions)) {
            message.interactiveConfirmationQuestions.forEach((confirmationQuestion, index) => {
                const marker = `[[CONFIRMATION_BLOCK_${index}]]`;
                confirmationReplacements.push({ marker, question: confirmationQuestion });
                // Replace the question text with marker
                processedContent = processedContent.replace(
                    confirmationQuestion.originalQuestionText,
                    marker
                );
            });
        }
        
        const contentHtml = renderMarkdown(processedContent);
        if (contentHtml) {
            messageElement.innerHTML = contentHtml;
        } else {
            messageElement.textContent = processedContent;
        }

        // Replace markers with interactive confirmation blocks
        if (confirmationReplacements.length > 0) {
            confirmationReplacements.forEach(({ marker, question }) => {
                const confirmationBlock = createConfirmationQuestionBlock(question);
                
                // Find all text nodes containing the marker
                const walker = document.createTreeWalker(
                    messageElement,
                    NodeFilter.SHOW_TEXT,
                    null
                );
                
                let nodesToReplace = [];
                let node;
                while (node = walker.nextNode()) {
                    if (node.textContent && node.textContent.includes(marker)) {
                        nodesToReplace.push(node);
                    }
                }
                
                // Replace each text node containing the marker
                nodesToReplace.forEach(textNode => {
                    const parent = textNode.parentNode;
                    if (parent) {
                        const parts = textNode.textContent.split(marker);
                        if (parts.length > 1) {
                            // Create text nodes for before and after
                            const beforeText = document.createTextNode(parts[0]);
                            const afterText = document.createTextNode(parts.slice(1).join(marker));
                            
                            // Insert in order: before, block, after
                            parent.insertBefore(beforeText, textNode);
                            parent.insertBefore(confirmationBlock, textNode);
                            if (parts.slice(1).join(marker)) {
                                parent.insertBefore(afterText, textNode);
                            }
                            parent.removeChild(textNode);
                        }
                    }
                });
            });
        }

        // Ensure links open safely
        messageElement.querySelectorAll('a').forEach((link) => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });
        
        chatMessages.appendChild(messageElement);

        console.log('Chat: Message element appended to chatMessages');
        messageElement.scrollIntoView({ block: 'start', behavior: 'smooth' });

        // Mark that we have messages loaded
        chatState.messagesLoaded = true;

        return messageElement;
    }

    function showProgressIndicator(update) {
        const chatContainer = safeGetDocumentElement('chatMessages');
        if (!chatContainer) {
            console.warn('Chat: chatMessages element not found for progress indicator');
            return;
        }

        let banner = document.getElementById('agent-progress-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'agent-progress-banner';
            banner.className = 'agent-progress-banner';
            
            // Find the last user message to insert the banner after it
            const messages = chatContainer.querySelectorAll('.chat-message');
            let lastUserMessage = null;
            
            // Find the last user message by iterating from the end
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].classList.contains('user-message')) {
                    lastUserMessage = messages[i];
                    break;
                }
            }
            
            try {
                if (lastUserMessage) {
                    // Insert the banner right after the last user message
                    lastUserMessage.parentNode.insertBefore(banner, lastUserMessage.nextSibling);
                } else {
                    // Fallback: append to the end if no user message found
                    chatContainer.appendChild(banner);
                }
            } catch (error) {
                console.error('Chat: Error inserting progress banner:', error);
                return;
            }
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
        
        // Scroll to bottom to show the progress message
        chatContainer.scrollTop = chatContainer.scrollHeight;

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
                await loadAndDisplayMessages(sessionId);
            }
        } catch (error) {
            console.error('Chat: Failed to initialize session', error);
        }
    }

    async function loadAndDisplayMessages(sessionId, retryCount = 0) {
        try {
            console.log(`Chat: Loading messages for session ${sessionId} (attempt ${retryCount + 1})`);
            const messages = await globalScope.WebviewApi.persistence.loadChatMessagesForSession(sessionId);
            
            if (Array.isArray(messages)) {
                console.log(`Chat: Loaded ${messages.length} messages from database`);
                
                // Clear existing messages before loading new ones
                const chatMessages = safeGetDocumentElement('chatMessages');
                if (chatMessages) {
                    chatMessages.innerHTML = '';
                }
                
                messages.forEach(displayMessage);
                
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                // If we have messages, we're done
                if (messages.length > 0) {
                    console.log('Chat: Messages loaded successfully');
                    chatState.messagesLoaded = true;
                    return;
                }
            }
            
            // If no messages found and this is the first attempt, retry after a short delay
            // This handles cases where the database write hasn't been flushed yet
            if (retryCount === 0) {
                console.log('Chat: No messages found on first attempt, retrying after delay...');
                setTimeout(() => {
                    void loadAndDisplayMessages(sessionId, 1);
                }, 1000); // Wait 1 second before retry
            } else {
                console.log('Chat: No messages found after retry, session may be empty');
            }
        } catch (error) {
            console.error('Chat: Failed to load messages:', error);
            
            // Retry once on error
            if (retryCount === 0) {
                console.log('Chat: Error loading messages, retrying after delay...');
                setTimeout(() => {
                    void loadAndDisplayMessages(sessionId, 1);
                }, 1000);
            }
        }
    }

    async function createAndPersistSession(title = 'New Conversation') {
        if (!globalScope?.WebviewApi || !chatState.projectSettings) {
            return null;
        }

        const modeSelect = safeGetDocumentElement('mode-select');
        const currentMode = modeSelect?.value || chatState.projectSettings.defaultMode || 'deep_bug_analysis';

        const request = {
            title,
            projectId: chatState.projectSettings.projectId,
            model: chatState.projectSettings.primaryLLMModel || undefined,
            mode: currentMode
        };

        const session = await globalScope.WebviewApi.persistence.createSession(request);
        if (session?.id) {
            chatState.projectSettings = {
                ...chatState.projectSettings,
                currentSessionId: session.id
            };
            chatState.currentSessionId = session.id;
            chatState.currentSession = session;
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

            // Update session mode from dropdown before sending message
            const modeSelect = safeGetDocumentElement('mode-select');
            const currentMode = modeSelect?.value || 'deep_bug_analysis';
            
            // Ensure metadata exists
            if (!currentSession.metadata) {
                currentSession.metadata = {};
            }
            
            // Update session metadata if mode has changed or is not set
            if (currentSession.metadata.mode !== currentMode) {
                console.log(`Chat: Updating session mode from ${currentSession.metadata.mode || 'not set'} to ${currentMode}`);
                currentSession.metadata = {
                    ...currentSession.metadata,
                    mode: currentMode
                };
                
                // Persist the mode update to the session
                try {
                    await globalScope.WebviewApi.persistence.updateSession(sessionId, {
                        metadata: currentSession.metadata
                    });
                    chatState.currentSession = currentSession;
                } catch (error) {
                    console.error('Chat: Failed to update session mode:', error);
                }
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

            // Use agent.execute for consistent execution path
            if (globalScope.WebviewApi?.agent?.execute) {
                try {
                    // The agent.execute will handle everything and broadcast the response
                    // The message listener will automatically display it
                    await globalScope.WebviewApi.agent.execute({
                        userMessage: userMessage,
                        session: currentSession,
                        message: messageText
                    });
                    
                    // Remove pending indicator - the actual response will be displayed by the message listener
                    if (chatMessagesElement && pendingIndicator.parentElement === chatMessagesElement) {
                        chatMessagesElement.removeChild(pendingIndicator);
                    }
                } catch (error) {
                    console.error('Chat: Failed to execute agent command', error);
                    
                    // Remove pending indicator
                    if (chatMessagesElement && pendingIndicator.parentElement === chatMessagesElement) {
                        chatMessagesElement.removeChild(pendingIndicator);
                    }
                    
                    // Display error message
                    displayMessage({
                        id: `error-${Date.now()}`,
                        sessionId: chatState.currentSessionId,
                        projectId: chatState.projectSettings.projectId,
                        type: globalScope?.MessageType?.ERROR || 'error',
                        role: 'assistant',
                        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        metadata: { error }
                    });
                }
                return;
            }
            
            // Fallback error if agent not available
            if (chatMessagesElement && pendingIndicator.parentElement === chatMessagesElement) {
                chatMessagesElement.removeChild(pendingIndicator);
            }
            displayMessage({
                id: `error-${Date.now()}`,
                sessionId: chatState.currentSessionId,
                projectId: chatState.projectSettings.projectId,
                type: globalScope?.MessageType?.ERROR || 'error',
                role: 'assistant',
                content: 'Agent not available. Please reload the extension.',
                metadata: {}
            });
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
        const interactiveConfirmationQuestions = rawResponse.interactiveConfirmationQuestions
            ?? metadata.interactiveConfirmationQuestions
            ?? rawResponse.payload?.interactiveConfirmationQuestions;

        // Extract and update API cost if available
        const cost = rawResponse.cost ?? metadata.cost ?? rawResponse.payload?.cost;
        console.log('[COST DEBUG] buildAssistantMessageFromAgentResponse - cost extraction:', {
            rawResponseCost: rawResponse.cost,
            metadataCost: metadata.cost,
            payloadCost: rawResponse.payload?.cost,
            finalCost: cost,
            costType: typeof cost,
            rawResponse: rawResponse
        });
        
        if (cost && typeof cost === 'number') {
            console.log('[COST DEBUG] Calling updateApiCostDisplay with cost:', cost);
            updateApiCostDisplay(cost);
        } else {
            console.log('[COST DEBUG] Not updating cost display - cost is:', cost, 'type:', typeof cost);
        }

        const sessionId = chatState.currentSessionId;
        const projectId = chatState.projectSettings?.projectId;

        const enrichedMetadata = {
            ...metadata,
            ...(specClarificationData ? { specClarificationData } : {}),
            ...(interactiveQuestions ? { interactiveQuestions } : {}),
            ...(interactiveConfirmationQuestions ? { interactiveConfirmationQuestions } : {}),
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
            interactiveQuestions,
            interactiveConfirmationQuestions
        };
    }

    async function persistAssistantMessage(message) {
        if (!message || !message.sessionId || !message.projectId) {
            console.warn('Chat: Cannot persist assistant message without session/project context');
            return;
        }

        if (message.metadata?.samuraiAgentResponse) {
            console.log('Chat: Skipping persistence for agent-managed response');
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
            interactiveQuestions: message.interactiveQuestions,
            interactiveConfirmationQuestions: message.interactiveConfirmationQuestions
        });
    }

    function renderAssistantResponse(messageElement, assistantMessage) {
        if (!assistantMessage) {
            return;
        }

        if (assistantMessage.specClarificationData) {
            const scoreValue = assistantMessage.specClarificationData.score;
            let scoreClass = 'score-red';
            if (scoreValue >= 90) {
                scoreClass = 'score-green';
            } else if (scoreValue >= 70) {
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
                        
                        // Display user message first
                        const userMsg = {
                            id: `user-${Date.now()}`,
                            sessionId: chatState.currentSessionId,
                            projectId: chatState.projectSettings?.projectId,
                            type: globalScope?.MessageType?.USER || 'user',
                            role: 'user',
                            content: question.messageToSend,
                            metadata: {}
                        };
                        displayMessage(userMsg);
                        
                        // Save user message to persistence
                        if (chatState.currentSessionId && chatState.projectSettings?.projectId) {
                            try {
                                await globalScope.WebviewApi.persistence.saveChatMessage({
                                    sessionId: chatState.currentSessionId,
                                    projectId: chatState.projectSettings.projectId,
                                    type: userMsg.type,
                                    content: userMsg.content,
                                    role: userMsg.role,
                                    metadata: userMsg.metadata
                                });
                                console.log('Chat: User message persisted successfully');
                            } catch (saveError) {
                                console.warn('Chat: Failed to save message to persistence:', saveError);
                            }
                        }
                        
                        // Add "Thinking..." indicator
                        const chatMessagesElement = safeGetDocumentElement('chatMessages');
                        const pendingIndicator = document.createElement('div');
                        pendingIndicator.className = 'assistant-message pending';
                        pendingIndicator.id = `pending-${Date.now()}`;
                        pendingIndicator.textContent = 'Thinking...';
                        
                        if (chatMessagesElement) {
                            chatMessagesElement.appendChild(pendingIndicator);
                            chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
                        }
                        
                        if (globalScope.WebviewApi?.agent?.execute) {
                            try {
                                // Call agent.execute - backend will persist and broadcast the response
                                await globalScope.WebviewApi.agent.execute({
                                    userMessage: userMsg,
                                    session: chatState.currentSession,
                                    message: question.messageToSend
                                });
                                // Remove pending indicator on success (it will be replaced by actual response)
                                if (pendingIndicator && pendingIndicator.parentNode) {
                                    pendingIndicator.remove();
                                }
                                return;
                            } catch (error) {
                                console.error('Chat: Failed to execute agent command', error);
                                // Remove pending indicator on error
                                if (pendingIndicator && pendingIndicator.parentNode) {
                                    pendingIndicator.remove();
                                }
                                // Display the error directly
                                displayMessage({
                                    id: `error-${Date.now()}`,
                                    sessionId: chatState.currentSessionId,
                                    projectId: chatState.projectSettings?.projectId,
                                    type: globalScope?.MessageType?.ERROR || 'error',
                                    role: 'assistant',
                                    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                    metadata: { error }
                                });
                                return;
                            }
                        } else {
                            await sendMessage(question.messageToSend);
                            return;
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
            
            // Initialize cost display with monthly cost
            updateApiCostDisplay(0);

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
                hint.innerHTML = '💡 Tip: Try these commands:<br>"please read the latest code" — Extract and analyze your code<br>"create specs" — Generate specifications<br>Press Enter to send • Shift + Enter for a new line';
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
                        chatState.messagesLoaded = false; // Reset the flag since we cleared messages
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
                            // Refresh cost display after project detail ingestion
                            updateApiCostDisplay(0);
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

            const modeSelect = safeGetDocumentElement('mode-select');
            if (modeSelect) {
                modeSelect.addEventListener('change', function onChange() {
                    handleModeChange(this.value);
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
                    console.log('Chat: Fallback - refreshing LLM model dropdown after timeout');
                    await refreshLLMModelDropdown();
                }
            }, 2000);

            // Additional fallback: Check if we need to refresh state periodically
            // This helps in case the visibility change handler doesn't fire
            setInterval(() => {
                if (chatState.projectSettings && (!chatState.availableModels || chatState.availableModels.length === 0)) {
                    console.log('Chat: Periodic check - refreshing LLM model dropdown');
                    void refreshLLMModelDropdown();
                }
            }, 10000); // Check every 10 seconds
        });
    }

    function handleInitialSettings(payload) {
        if (!payload) {
            return;
        }

        console.log('Chat: handleInitialSettings called with payload:', {
            hasGlobalSettings: !!payload.globalSettings,
            hasProjectSettings: !!payload.projectSettings,
            availableModelsCount: payload.availableModels?.length || 0,
            hasLLMModels: !!payload.llmModels
        });

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

        const defaultMode = chatState.projectSettings?.defaultMode;
        const modeSelect = safeGetDocumentElement('mode-select');
        if (defaultMode && modeSelect) {
            modeSelect.value = defaultMode;
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

    async function handleModeChange(selectedMode) {
        if (!selectedMode || !chatState.projectSettings || !globalScope?.WebviewApi) {
            return;
        }

        try {
            const updatedProjectSettings = {
                ...chatState.projectSettings,
                defaultMode: selectedMode
            };

            await globalScope.WebviewApi.persistence.saveProjectSettings(updatedProjectSettings);
            chatState.projectSettings = updatedProjectSettings;
            console.log('Mode changed to:', selectedMode);
        } catch (error) {
            console.error('Error saving mode selection:', error);
        }
    }

    async function refreshLLMModelDropdown() {
        if (!globalScope?.WebviewApi) {
            return;
        }

        try {
            // Load both global and project settings to ensure we have latest data
            const globalSettings = await globalScope.WebviewApi.persistence.loadGlobalSettings();
            const projectSettings = await globalScope.WebviewApi.persistence.loadProjectSettings();
            
            if (!globalSettings || !chatState.llmModels) {
                return;
            }

            chatState.globalSettings = globalSettings;
            
            // Update project settings if we got fresh data
            if (projectSettings) {
                chatState.projectSettings = projectSettings;
            }

            const availableModels = [];

            if (globalSettings.openaiApiKey?.trim()) {
                availableModels.push(...chatState.llmModels.openai);
            }

            // Always add free tier model since it uses hardcoded API key
            const freeTierModel = chatState.llmModels.google?.find(m => m.id === 'gemini-2.5-flash-free-tier');
            if (freeTierModel) {
                availableModels.push(freeTierModel);
            }

            // Add other Google models if user has Gemini API key
            if (globalSettings.geminiApiKey?.trim()) {
                const otherGoogleModels = chatState.llmModels.google?.filter(m => m.id !== 'gemini-2.5-flash-free-tier') || [];
                availableModels.push(...otherGoogleModels);
            }

            if (globalSettings.claudeApiKey?.trim()) {
                availableModels.push(...chatState.llmModels.anthropic);
            }

            chatState.availableModels = availableModels.sort((a, b) => {
                // First sort by provider
                if (a.provider !== b.provider) {
                    return a.provider.localeCompare(b.provider);
                }
                
                // Within same provider, put free tier model last
                const aIsFree = a.id === 'gemini-2.5-flash-free-tier';
                const bIsFree = b.id === 'gemini-2.5-flash-free-tier';
                
                if (aIsFree && !bIsFree) return 1;  // a (free tier) goes after b
                if (!aIsFree && bIsFree) return -1; // b (free tier) goes after a
                
                // Otherwise sort alphabetically by name
                return a.name.localeCompare(b.name);
            });

            populateLLMModelDropdown();

            const currentSelection = chatState.projectSettings?.primaryLLMModel;
            const llmModelSelect = safeGetDocumentElement('llm-model-select');
            
            if (currentSelection && !chatState.availableModels.some(model => model.id === currentSelection)) {
                // Current selection is no longer available, select first available model
                if (chatState.availableModels.length > 0) {
                    const newSelection = chatState.availableModels[0].id;
                    if (llmModelSelect) {
                        llmModelSelect.value = newSelection;
                    }
                    chatState.projectSettings = {
                        ...(chatState.projectSettings || {}),
                        primaryLLMModel: newSelection
                    };
                    await globalScope.WebviewApi.persistence.saveProjectSettings(chatState.projectSettings);
                }
            } else if (currentSelection && llmModelSelect) {
                // Current selection is still available, restore it in the dropdown
                llmModelSelect.value = currentSelection;
            } else if (!currentSelection && chatState.availableModels.length > 0 && llmModelSelect) {
                // No current selection, select first available model
                llmModelSelect.value = chatState.availableModels[0].id;
            }
        } catch (error) {
            console.error('Error refreshing LLM model dropdown:', error);
        }
    }

    function initializeMessageListener(chatMessagesElement) {
        const listeners = new Set();

        const dispatchNotification = async (type, payload) => {
            if (type === 'initialSettings' && payload) {
                console.log('Chat: Received initialSettings notification, re-initializing state');
                handleInitialSettings(payload);
                chatMessagesElement?.dispatchEvent(new CustomEvent('chat-initialized'));
                return;
            }

            if (type === 'globalSettingsUpdated') {
                console.log('Chat: Received globalSettingsUpdated notification, refreshing LLM models');
                await refreshLLMModelDropdown();
                chatMessagesElement?.dispatchEvent(new CustomEvent('chat-settings-updated'));
            }

            if (type === 'webviewRefresh') {
                console.log('Chat: Received webviewRefresh notification, refreshing webview state');
                // Call the refresh function if it's available
                if (globalScope.ChatManager?.refreshWebviewState) {
                    globalScope.ChatManager.refreshWebviewState();
                }
                chatMessagesElement?.dispatchEvent(new CustomEvent('webview-refreshed'));
            }
        };

        const onMessage = async message => {
            if (!message || typeof message !== 'object') {
                return;
            }

            if (message.type === 'success' && message.requestId) {
                const payload = message.payload || {};

                if (payload?.content && payload?.metadata?.samuraiAgentResponse) {
                    const assistantMessage = buildAssistantMessageFromAgentResponse({
                        message: payload.content,
                        metadata: payload.metadata,
                        specClarificationData: payload.metadata?.specClarificationData || payload.specClarificationData,
                        interactiveQuestions: payload.metadata?.interactiveQuestions || payload.interactiveQuestions,
                        interactiveConfirmationQuestions: payload.metadata?.interactiveConfirmationQuestions || payload.interactiveConfirmationQuestions,
                        cost: payload.metadata?.cost,
                        tokens: payload.metadata?.tokens
                    });

                    if (assistantMessage) {
                        const element = displayMessage(assistantMessage);
                        if (element) {
                            renderAssistantResponse(element, assistantMessage);
                        }
                        chatState.lastAssistantMessageContent = assistantMessage.content;
                        chatState.lastAssistantMessageTimestamp = Date.now();
                    }
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

            // Refresh cost display when cost-related operations complete
            if (message.type === 'success' && message.requestId && 
                (message.requestId.includes('projectDetail.ingest') || 
                 message.requestId.includes('samurai-agent.execute'))) {
                // Small delay to ensure cost records are saved
                setTimeout(() => {
                    updateApiCostDisplay(0);
                }, 500);
            }

            if (!message.requestId && message.type) {
                await dispatchNotification(message.type, message.payload);
            }
        };

        // Use WebviewApi.subscribe if available (modern approach)
        // Otherwise fall back to window message listener
        if (globalScope.WebviewApi?.subscribe) {
            const unsubscribe = globalScope.WebviewApi.subscribe(async message => {
                await onMessage(message);
            });
            listeners.add(unsubscribe);
        } else {
            globalScope.addEventListener('message', async event => {
                await onMessage(event.data);
            });
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

        // Function to refresh webview state when it becomes visible
        function refreshWebviewState() {
            const now = Date.now();
            
            // Prevent rapid successive refreshes (within 2 seconds)
            if (now - chatState.lastRefreshTime < 2000) {
                console.log('Chat: Skipping refresh - too soon since last refresh');
                return;
            }
            
            chatState.lastRefreshTime = now;
            console.log('Chat: refreshWebviewState called - refreshing all state');
            
            // Refresh LLM model dropdown
            void refreshLLMModelDropdown();
            
            // Only re-initialize chat session if we don't have messages loaded
            // This prevents clearing messages that were just saved
            if (chatState.projectSettings) {
                const chatMessages = safeGetDocumentElement('chatMessages');
                
                // More robust message detection - check for actual message elements
                const hasMessages = chatMessages && (
                    chatMessages.children.length > 0 || 
                    chatMessages.querySelectorAll('.chat-message').length > 0 ||
                    chatMessages.innerHTML.trim().length > 0
                );
                
                console.log('Chat: Message detection:', {
                    hasElement: !!chatMessages,
                    childrenCount: chatMessages ? chatMessages.children.length : 0,
                    messageElements: chatMessages ? chatMessages.querySelectorAll('.chat-message').length : 0,
                    innerHTMLLength: chatMessages ? chatMessages.innerHTML.trim().length : 0,
                    hasMessages: hasMessages,
                    messagesLoaded: chatState.messagesLoaded
                });
                
                // If we've already loaded messages and they're still there, don't reload
                if (chatState.messagesLoaded && hasMessages) {
                    console.log('Chat: Messages already loaded and present, skipping session initialization');
                    // Just ensure we have the current session ID
                    if (!chatState.currentSessionId && chatState.projectSettings.currentSessionId) {
                        chatState.currentSessionId = chatState.projectSettings.currentSessionId;
                    }
                } else if (!hasMessages) {
                    console.log('Chat: No messages found, initializing chat session');
                    void initializeChatSession();
                } else {
                    console.log('Chat: Messages present but not marked as loaded, ensuring session ID');
                    chatState.messagesLoaded = true;
                    if (!chatState.currentSessionId && chatState.projectSettings.currentSessionId) {
                        chatState.currentSessionId = chatState.projectSettings.currentSessionId;
                    }
                }
            }
            
            // Refresh cost display
            updateApiCostDisplay(0);
            
            console.log('Chat: Webview state refresh completed');
        }

        globalScope.ChatManager = {
            handleInitialSettings,
            populateLLMModelDropdown,
            handleLLMModelChange,
            refreshLLMModelDropdown,
            initializeMessageListener,
            displayMessage,
            MessageType,
            getChatState: () => chatState,
            refreshCostDisplay: () => updateApiCostDisplay(0),
            refreshWebviewState
        };
    }
})(typeof window !== 'undefined' ? window : undefined);

if (typeof module !== 'undefined') {
    const exportsForTests = require('./chat.js');
    module.exports = exportsForTests;
}
