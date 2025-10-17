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
        lastRefreshTime: 0, // Track when we last refreshed to prevent rapid refreshes
        pinnedFilePaths: [] // Array of absolute file paths for pinned files
    };

    const MessageType = {
        USER: 'user',
        ASSISTANT: 'assistant',
        SYSTEM: 'system',
        ERROR: 'error'
    };

    // Beta testing constants
    const VALID_BETA_CODE = 'BETA-SA-2025-7K9M';
    const BETA_MONTHLY_LIMIT = 3.00;

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

        // New: Call renderAssistantResponse for assistant messages to add spec score and interactive buttons
        // This ensures these elements are added to messageElement when it's initially constructed,
        // covering both new messages and messages loaded from history.
        if (message.role === 'assistant' && 
            (message.specClarificationData || 
             (Array.isArray(message.interactiveQuestions) && message.interactiveQuestions.length > 0))) {
            renderAssistantResponse(messageElement, message);
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
        }
        
        // ALWAYS reposition banner (moved outside the if block)
        // First, remove from current parent if already in DOM
        if (banner.parentNode) {
            banner.parentNode.removeChild(banner);
        }
        
        // Find the best insertion point
        // Priority 1: After "Thinking..." indicator (most current context)
        let insertionPoint = null;
        const pendingIndicator = chatContainer.querySelector('.assistant-message.pending');
        
        if (pendingIndicator) {
            insertionPoint = pendingIndicator;
        } else {
            // Priority 2: After last user message
            const messages = chatContainer.querySelectorAll('.chat-message');
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].classList.contains('user-message')) {
                    insertionPoint = messages[i];
                    break;
                }
            }
        }
        
        try {
            if (insertionPoint) {
                // Insert the banner right after the insertion point
                insertionPoint.parentNode.insertBefore(banner, insertionPoint.nextSibling);
            } else {
                // Fallback: append to the end if no insertion point found
                chatContainer.appendChild(banner);
            }
        } catch (error) {
            console.error('Chat: Error inserting progress banner:', error);
            return;
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
                // Properly remove from DOM instead of just hiding
                if (banner && banner.parentNode) {
                    banner.parentNode.removeChild(banner);
                }
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
                } else {
                    chatState.currentSession = session;
                }
            } else {
                sessionId = await createAndPersistSession();
            }

            chatState.currentSessionId = sessionId;

            if (sessionId) {
                await loadAndDisplayMessages(sessionId);
                // Update button state after loading session
                updateShowCurrentSpecButton();
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
                    
                    // Update Show Current Spec button visibility based on mode
                    updateShowCurrentSpecButton();
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
                        message: messageText,
                        pinnedFilePaths: chatState.pinnedFilePaths
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

    // ============ Pinned File Management Functions ============
    
    function initializePinFileInput() {
        const pinInput = safeGetDocumentElement('pin-file-input');
        const autocompleteDropdown = safeGetDocumentElement('file-autocomplete');
        
        if (!pinInput || !autocompleteDropdown) {
            console.warn('Chat: Pin file input or autocomplete dropdown not found');
            return;
        }
        
        pinInput.addEventListener('input', async (event) => {
            const value = event.target.value;
            
            // Check if user typed @
            if (value.startsWith('@')) {
                const searchTerm = value.substring(1).toLowerCase();
                
                try {
                    // Request open files from extension
                    const openFiles = await globalScope.WebviewApi.postCommand('getOpenFiles');
                    
                    if (!openFiles || !Array.isArray(openFiles)) {
                        console.warn('Chat: No open files returned');
                        hideAutocomplete();
                        return;
                    }
                    
                    // Filter files based on search term
                    const filteredFiles = openFiles.filter(filePath => {
                        const fileName = filePath.split('/').pop().toLowerCase();
                        return fileName.includes(searchTerm);
                    });
                    
                    // Display autocomplete suggestions
                    displayAutocomplete(filteredFiles, searchTerm);
                } catch (error) {
                    console.error('Chat: Error getting open files:', error);
                    hideAutocomplete();
                }
            } else {
                hideAutocomplete();
            }
        });
        
        // Hide autocomplete when clicking outside
        document.addEventListener('click', (event) => {
            if (!pinInput.contains(event.target) && !autocompleteDropdown.contains(event.target)) {
                hideAutocomplete();
            }
        });
    }

    function displayAutocomplete(files, searchTerm) {
        const dropdown = safeGetDocumentElement('file-autocomplete');
        if (!dropdown) return;
        
        if (files.length === 0) {
            hideAutocomplete();
            return;
        }
        
        dropdown.innerHTML = '';
        files.slice(0, 10).forEach(filePath => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            
            const fileName = filePath.split('/').pop();
            const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
            
            item.innerHTML = `
                <span class="file-name">${escapeHtml(fileName)}</span>
                <span class="file-path">${escapeHtml(fileDir)}</span>
            `;
            
            item.addEventListener('click', () => addPinnedFile(filePath));
            dropdown.appendChild(item);
        });
        
        dropdown.style.display = 'block';
    }

    function hideAutocomplete() {
        const dropdown = safeGetDocumentElement('file-autocomplete');
        if (dropdown) dropdown.style.display = 'none';
    }

    function addPinnedFile(filePath) {
        // Enforce 5-file limit
        if (chatState.pinnedFilePaths.length >= 5) {
            console.warn('Chat: Maximum 5 files can be pinned');
            // TODO: Could show a toast notification here
            return;
        }
        
        // Avoid duplicates
        if (chatState.pinnedFilePaths.includes(filePath)) {
            console.warn('Chat: File already pinned:', filePath);
            return;
        }
        
        chatState.pinnedFilePaths.push(filePath);
        console.log('Chat: Pinned file:', filePath);
        renderPinnedFiles();
        
        // Clear input
        const pinInput = safeGetDocumentElement('pin-file-input');
        if (pinInput) pinInput.value = '';
        hideAutocomplete();
    }

    function removePinnedFile(filePath) {
        const index = chatState.pinnedFilePaths.indexOf(filePath);
        if (index > -1) {
            chatState.pinnedFilePaths.splice(index, 1);
            console.log('Chat: Unpinned file:', filePath);
            renderPinnedFiles();
        }
    }

    function renderPinnedFiles() {
        const container = safeGetDocumentElement('pinned-files-list');
        const countDisplay = safeGetDocumentElement('pinned-files-count');
        
        if (!container) {
            console.warn('Chat: Pinned files list container not found');
            return;
        }
        
        container.innerHTML = '';
        
        chatState.pinnedFilePaths.forEach(filePath => {
            const chip = document.createElement('div');
            chip.className = 'pinned-file-chip';
            
            const fileName = filePath.split('/').pop();
            chip.innerHTML = `
                <span class="chip-name">${escapeHtml(fileName)}</span>
                <button class="chip-remove" data-path="${escapeHtml(filePath)}">&times;</button>
            `;
            
            const removeButton = chip.querySelector('.chip-remove');
            if (removeButton) {
                removeButton.addEventListener('click', (e) => {
                    const path = e.target.getAttribute('data-path');
                    if (path) removePinnedFile(path);
                });
            }
            
            container.appendChild(chip);
        });
        
        // Update count display
        if (countDisplay) {
            countDisplay.textContent = `${chatState.pinnedFilePaths.length}/5`;
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
            
            // Initialize pinned file input
            initializePinFileInput();
            
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

        // Update Show Current Spec button visibility based on mode
        updateShowCurrentSpecButton();

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
            
            // Update button visibility based on new mode
            updateShowCurrentSpecButton();
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

            // Beta model logic
            const isBetaCodeEntered = globalSettings.betaCode?.trim() === VALID_BETA_CODE;
            let betaLimitReached = false;
            
            console.log('[Beta Debug] Beta code check:', {
                betaCode: globalSettings.betaCode,
                trimmed: globalSettings.betaCode?.trim(),
                expectedCode: VALID_BETA_CODE,
                isValid: isBetaCodeEntered
            });
            
            if (isBetaCodeEntered) {
                try {
                    const betaMonthlyCost = await globalScope.WebviewApi.postCommand('samurai-agent.getMonthlyCostForBetaUsers');
                    console.log('[Beta Debug] Monthly cost:', betaMonthlyCost, 'Limit:', BETA_MONTHLY_LIMIT);
                    if (typeof betaMonthlyCost === 'number' && betaMonthlyCost >= BETA_MONTHLY_LIMIT) {
                        betaLimitReached = true;
                    }
                } catch (error) {
                    console.error('Error getting beta monthly cost:', error);
                }
            }

            // Add beta testing model if code valid AND limit not reached
            if (isBetaCodeEntered && !betaLimitReached) {
                const betaModel = chatState.llmModels.google?.find(m => m.id === 'gemini-2.5-flash-beta');
                console.log('[Beta Debug] Beta model search:', {
                    googleModels: chatState.llmModels.google?.map(m => m.id),
                    betaModelFound: !!betaModel,
                    betaModel
                });
                if (betaModel) {
                    availableModels.push(betaModel);
                }
            }

            // Always add free tier model since it uses hardcoded API key
            const freeTierModel = chatState.llmModels.google?.find(m => m.id === 'gemini-2.5-flash-free-tier');
            if (freeTierModel) {
                availableModels.push(freeTierModel);
            }

            // Add other Google models if user has Gemini API key (exclude free tier and beta)
            if (globalSettings.geminiApiKey?.trim()) {
                const otherGoogleModels = chatState.llmModels.google?.filter(
                    m => m.id !== 'gemini-2.5-flash-free-tier' && m.id !== 'gemini-2.5-flash-beta'
                ) || [];
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
                
                // Within Google provider, order: beta, paid models, free tier
                const aIsBeta = a.id === 'gemini-2.5-flash-beta';
                const bIsBeta = b.id === 'gemini-2.5-flash-beta';
                const aIsFree = a.id === 'gemini-2.5-flash-free-tier';
                const bIsFree = b.id === 'gemini-2.5-flash-free-tier';
                
                if (aIsBeta && !bIsBeta) return -1; // Beta model comes first
                if (!aIsBeta && bIsBeta) return 1;
                if (aIsFree && !bIsFree) return 1;  // Free tier goes last
                if (!aIsFree && bIsFree) return -1;
                
                // Otherwise sort alphabetically by name
                return a.name.localeCompare(b.name);
            });

            populateLLMModelDropdown();

            // Handle beta limit warning message
            const llmModelSelect = safeGetDocumentElement('llm-model-select');
            const chatInputArea = safeGetDocumentElement('chat-input-area');
            let betaLimitMessageElement = document.getElementById('beta-limit-message');
            
            if (isBetaCodeEntered && betaLimitReached) {
                // Show beta limit warning
                if (!betaLimitMessageElement && chatInputArea) {
                    betaLimitMessageElement = document.createElement('div');
                    betaLimitMessageElement.id = 'beta-limit-message';
                    betaLimitMessageElement.className = 'beta-limit-warning';
                    betaLimitMessageElement.textContent = 'Beta test limit ($3/month) reached. Please use the free tier or add your own API key.';
                    
                    if (llmModelSelect && llmModelSelect.parentNode) {
                        llmModelSelect.parentNode.insertBefore(betaLimitMessageElement, llmModelSelect);
                    }
                }
                
                // If current selection is beta model, switch to free tier
                if (llmModelSelect?.value === 'gemini-2.5-flash-beta' && chatState.availableModels.length > 0) {
                    const freeTier = chatState.availableModels.find(m => m.id === 'gemini-2.5-flash-free-tier');
                    if (freeTier) {
                        llmModelSelect.value = freeTier.id;
                        chatState.projectSettings = {
                            ...(chatState.projectSettings || {}),
                            primaryLLMModel: freeTier.id
                        };
                        await globalScope.WebviewApi.persistence.saveProjectSettings(chatState.projectSettings);
                    }
                }
            } else {
                // Hide/remove beta limit message if it exists
                if (betaLimitMessageElement) {
                    betaLimitMessageElement.remove();
                }
            }

            const currentSelection = chatState.projectSettings?.primaryLLMModel;
            
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
                console.log('Chat: Received globalSettingsUpdated notification, updating LLM models');
                
                // If backend provided updated availableModels, use them directly
                if (payload?.availableModels) {
                    console.log('Chat: Using availableModels from backend:', {
                        modelCount: payload.availableModels.length,
                        modelIds: payload.availableModels.map(m => m.id)
                    });
                    
                    // Update chat state with new settings and models
                    if (payload.globalSettings) {
                        chatState.globalSettings = payload.globalSettings;
                    }
                    chatState.availableModels = payload.availableModels;
                    
                    // Repopulate dropdown
                    populateLLMModelDropdown();
                    
                    // Ensure current selection is still valid
                    const llmModelSelect = safeGetDocumentElement('llm-model-select');
                    const currentSelection = chatState.projectSettings?.primaryLLMModel;
                    
                    if (currentSelection && !chatState.availableModels.some(model => model.id === currentSelection)) {
                        // Current selection is no longer available, select first available model
                        if (chatState.availableModels.length > 0 && llmModelSelect) {
                            const newSelection = chatState.availableModels[0].id;
                            llmModelSelect.value = newSelection;
                            chatState.projectSettings = {
                                ...(chatState.projectSettings || {}),
                                primaryLLMModel: newSelection
                            };
                            if (globalScope?.WebviewApi) {
                                await globalScope.WebviewApi.persistence.saveProjectSettings(chatState.projectSettings);
                            }
                        }
                    } else if (currentSelection && llmModelSelect) {
                        // Restore current selection
                        llmModelSelect.value = currentSelection;
                    }
                } else {
                    // Fallback to refreshing if backend didn't provide availableModels
                    await refreshLLMModelDropdown();
                }
                
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
                        // displayMessage now handles rendering of spec scores and interactive buttons internally
                        displayMessage(assistantMessage);
                        chatState.lastAssistantMessageContent = assistantMessage.content;
                        chatState.lastAssistantMessageTimestamp = Date.now();
                    }
                    
                    // Reload session to get updated artifact status
                    if (chatState.currentSessionId && globalScope?.WebviewApi?.persistence?.loadSession) {
                        try {
                            const updatedSession = await globalScope.WebviewApi.persistence.loadSession(chatState.currentSessionId);
                            if (updatedSession) {
                                chatState.currentSession = updatedSession;
                                updateShowCurrentSpecButton();
                            }
                        } catch (error) {
                            console.error('Failed to reload session after agent response:', error);
                        }
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

            // Handle artifact generation completion
            if (message.command === 'artifactGenerated' && message.payload) {
                // Update session state with new artifact
                if (chatState.currentSession) {
                    chatState.currentSession.currentArtifact = message.payload;
                    // Refresh the button to reflect the new state
                    updateShowCurrentSpecButton();
                }
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

            // Handle notifications (messages without requestId that are not responses)
            // Special case: globalSettingsUpdated should always be processed even if it has requestId
            if (message.type === 'globalSettingsUpdated' && message.payload) {
                console.log('[Chat] Received globalSettingsUpdated, processing...', {
                    hasRequestId: !!message.requestId,
                    payloadKeys: Object.keys(message.payload),
                    availableModelsCount: message.payload.availableModels?.length
                });
                await dispatchNotification(message.type, message.payload);
            } else if (!message.requestId && message.type) {
                console.log('[Chat] Dispatching notification:', message.type);
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

    // ============ Spec Artifact Functionality ============

    function updateShowCurrentSpecButton() {
        const button = safeGetDocumentElement('show-current-spec-btn');
        const modeSelect = safeGetDocumentElement('mode-select');
        
        if (!button || !modeSelect) return;
        
        const isSpecPlanningMode = modeSelect.value === 'spec_planning';
        
        // Show button only in spec planning mode
        button.style.display = isSpecPlanningMode ? 'inline-block' : 'none';
        
        // Button is always enabled
        button.disabled = false;
        
        // Update button text based on generation status
        const generationStatus = chatState.currentSession?.currentArtifact?.generationStatus;
        if (generationStatus === 'generating') {
            button.textContent = 'Show Current Spec (Generating...)';
        } else {
            button.textContent = 'Show Current Spec';
        }
    }

    async function handleShowCurrentSpecClick() {
        const artifact = chatState.currentSession?.currentArtifact;
        const generationStatus = artifact?.generationStatus;
        
        // Backward compatibility: if artifact has data but no generationStatus, treat as completed
        const hasArtifactData = artifact?.mermaidData || artifact?.textSpec;
        
        // Handle different states
        if (!artifact || (!hasArtifactData && (!generationStatus || generationStatus === 'not_started'))) {
            // Spec not created yet
            renderArtifactModal(null, null, 'not_started');
            return;
        }
        
        if (generationStatus === 'generating') {
            // Spec is being generated
            renderArtifactModal(null, null, 'generating');
            return;
        }
        
        if (generationStatus === 'failed') {
            // Spec generation failed
            renderArtifactModal(null, null, 'failed');
            return;
        }
        
        // Spec is completed (or has data from before the fix)
        const { mermaidData, textSpec } = artifact;
        renderArtifactModal(mermaidData, textSpec, 'completed');
    }

    /**
     * Validates and repairs Mermaid syntax
     */
    function repairMermaidSyntax(mermaidCode) {
        if (!mermaidCode || typeof mermaidCode !== 'string') {
            return {
                repaired: 'graph TD\n    A[Invalid Diagram] --> B[Please regenerate]',
                wasRepaired: true,
                errors: ['Input was empty or invalid']
            };
        }
        
        let repaired = mermaidCode;
        let changesApplied = 0;
        const errors = [];
        
        // Remove markdown code fences if present
        if (repaired.includes('```mermaid') || repaired.includes('```')) {
            repaired = repaired.replace(/^```mermaid\n?/i, '').replace(/\n?```$/i, '');
            changesApplied++;
        }
        
        // Fix escaped newlines
        if (repaired.includes('\\n')) {
            repaired = repaired.replace(/\\n/g, '\n');
            changesApplied++;
        }
        
        // Remove trailing semicolons from connections and node definitions
        if (repaired.includes(';')) {
            repaired = repaired.split('\n').map(line => {
                // Remove semicolons at end of lines (common mistake)
                return line.replace(/;(\s*)$/g, '$1');
            }).join('\n');
            changesApplied++;
            errors.push('Removed trailing semicolons');
        }
        
        // Collapse multiple consecutive empty lines
        if (repaired.includes('\n\n\n')) {
            repaired = repaired.replace(/\n{3,}/g, '\n\n');
            changesApplied++;
            errors.push('Collapsed multiple empty lines');
        }
        
        // Fix linkStyle with spaces in property values (stroke-dasharray: 5 5 -> stroke-dasharray:5,5)
        if (repaired.includes('linkStyle')) {
            const originalRepaired = repaired;
            // Fix spaces after colons in style properties
            repaired = repaired.replace(/(\w+):\s+/g, '$1:');
            // Fix stroke-dasharray with spaces (5 5 -> 5,5)
            repaired = repaired.replace(/stroke-dasharray:(\d+)\s+(\d+)/g, 'stroke-dasharray:$1,$2');
            if (repaired !== originalRepaired) {
                changesApplied++;
                errors.push('Fixed linkStyle syntax');
            }
        }
        
        // Fix colons in node labels (replace with space or remove)
        // Mermaid doesn't allow colons in node labels without escaping
        const labelColonRegex = /(\[|\()([^\]\)]*?):([^\]\)]*?)(\]|\))/g;
        if (labelColonRegex.test(repaired)) {
            repaired = repaired.replace(/(\[|\()([^\]\)]*?):([^\]\)]*?)(\]|\))/g, '$1$2 $3$4');
            changesApplied++;
            errors.push('Fixed colons in node labels');
        }
        
        // Remove trailing incomplete style definitions
        const lines = repaired.split('\n');
        const lastNonEmptyLine = lines.filter(line => line.trim().length > 0).pop();
        if (lastNonEmptyLine && lastNonEmptyLine.trim().startsWith('style ')) {
            // Check if style definition is incomplete (no fill: or stroke:)
            if (!lastNonEmptyLine.includes('fill:') && !lastNonEmptyLine.includes('stroke:')) {
                repaired = lines.filter(line => line !== lastNonEmptyLine).join('\n');
                changesApplied++;
                errors.push('Removed incomplete style definition');
            }
        }
        
        // Ensure it starts with a valid diagram type
        const trimmed = repaired.trim();
        if (!trimmed.startsWith('graph') && !trimmed.startsWith('flowchart') && 
            !trimmed.startsWith('sequenceDiagram') && !trimmed.startsWith('classDiagram')) {
            if (trimmed.includes('-->') || trimmed.includes('---')) {
                repaired = `graph TD\n${trimmed}`;
                changesApplied++;
            }
        }
        
        console.log('[Mermaid Validator] Repair completed:', {
            wasRepaired: changesApplied > 0,
            changesApplied,
            errors
        });
        
        return {
            repaired,
            wasRepaired: changesApplied > 0,
            errors
        };
    }
    
    /**
     * Converts markdown to HTML
     */
    function renderMarkdown(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '<p>No specification available</p>';
        }
        
        let html = markdown;
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
        
        // Inline code
        html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
        
        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>');
        
        // Lists (bullet points starting with * or -)
        html = html.replace(/^\s*[\*\-]\s+(.*)$/gim, '<li>$1</li>');
        
        // Wrap consecutive <li> items in <ul>
        html = html.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');
        
        // Numbered lists
        html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/gim, function(match) {
            // Check if already wrapped in ul
            if (match.includes('<ul>')) {
                return match;
            }
            return '<ol>' + match + '</ol>';
        });
        
        // Blockquotes
        html = html.replace(/^\> (.*)$/gim, '<blockquote>$1</blockquote>');
        
        // Line breaks (double newline = paragraph)
        html = html.replace(/\n\n/gim, '</p><p>');
        
        // Wrap in paragraph if not already in a block element
        if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<ol') && !html.startsWith('<p')) {
            html = '<p>' + html + '</p>';
        }
        
        return html;
    }

    function renderArtifactModal(mermaidData, textSpec, state = 'completed') {
        const modal = safeGetDocumentElement('spec-artifact-modal');
        const mermaidContainer = safeGetDocumentElement('spec-artifact-mermaid');
        const textContainer = safeGetDocumentElement('spec-artifact-text');
        
        if (!modal || !mermaidContainer || !textContainer) return;
        
        // Clear previous content
        mermaidContainer.innerHTML = '';
        textContainer.innerHTML = '';
        
        // Handle different states
        if (state === 'not_started') {
            mermaidContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground);">
                    <p style="font-size: 16px; margin-bottom: 12px;">📋 Spec Not Created Yet</p>
                    <p style="font-size: 13px;">The spec artifact will be generated automatically during spec clarification.</p>
                </div>
            `;
            textContainer.innerHTML = `
                <p style="color: var(--vscode-descriptionForeground);">
                    Start a conversation in spec planning mode to generate your specification artifact.
                </p>
            `;
            modal.style.display = 'flex';
            return;
        }
        
        if (state === 'generating') {
            mermaidContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground);">
                    <div style="font-size: 40px; margin-bottom: 12px;">⏳</div>
                    <p style="font-size: 16px; margin-bottom: 12px;">Spec is Being Generated...</p>
                    <p style="font-size: 13px;">Please wait while the AI generates your specification artifact.</p>
                </div>
            `;
            textContainer.innerHTML = `
                <p style="color: var(--vscode-descriptionForeground);">
                    The specification will be available shortly. This process may take a few moments.
                </p>
            `;
            modal.style.display = 'flex';
            return;
        }
        
        if (state === 'failed') {
            mermaidContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--vscode-errorForeground);">
                    <p style="font-size: 16px; margin-bottom: 12px;">❌ Spec Generation Failed</p>
                    <p style="font-size: 13px;">There was an error generating the specification artifact.</p>
                </div>
            `;
            textContainer.innerHTML = `
                <p style="color: var(--vscode-errorForeground);">
                    Please try continuing the conversation or check the console for error details.
                </p>
            `;
            modal.style.display = 'flex';
            return;
        }
        
        // State is 'completed' - render the actual artifact
        // Validate and repair Mermaid diagram
        if (typeof mermaid !== 'undefined' && mermaidData) {
            const repairResult = repairMermaidSyntax(mermaidData);
            const diagramToRender = repairResult.repaired;
            
            if (repairResult.wasRepaired) {
                console.log('[Artifact Modal] Mermaid syntax was repaired:', repairResult.errors);
            }
            
            mermaidContainer.innerHTML = `<div class="mermaid">${diagramToRender}</div>`;
            
            try {
                mermaid.init(undefined, mermaidContainer.querySelector('.mermaid'));
                
                // Show repair notice if applicable
                if (repairResult.wasRepaired && repairResult.errors.length > 0) {
                    const notice = document.createElement('p');
                    notice.style.cssText = 'color: var(--vscode-editorWarning-foreground); font-size: 11px; margin-top: 8px;';
                    notice.textContent = `⚠️ Diagram syntax was automatically repaired (${repairResult.errors.length} issue${repairResult.errors.length > 1 ? 's' : ''} fixed)`;
                    mermaidContainer.appendChild(notice);
                }
            } catch (error) {
                console.error('Mermaid rendering error:', error);
                mermaidContainer.innerHTML = `
                    <p style="color: var(--vscode-errorForeground);">Failed to render diagram</p>
                    <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;">
                        ${error.message || 'Unknown syntax error'}
                    </p>
                `;
            }
        } else {
            mermaidContainer.innerHTML = '<p>No diagram available</p>';
        }
        
        // Render text spec with markdown
        if (textSpec) {
            const htmlContent = renderMarkdown(textSpec);
            textContainer.innerHTML = htmlContent;
        } else {
            textContainer.innerHTML = '<p>No specification text available</p>';
        }
        
        // Show modal
        modal.style.display = 'flex';
    }

    function closeArtifactModal() {
        const modal = safeGetDocumentElement('spec-artifact-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Initialize artifact button handlers
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', function() {
            const showButton = safeGetDocumentElement('show-current-spec-btn');
            const closeButton = safeGetDocumentElement('spec-artifact-close');
            const modal = safeGetDocumentElement('spec-artifact-modal');
            
            if (showButton) {
                showButton.addEventListener('click', handleShowCurrentSpecClick);
            }
            
            if (closeButton) {
                closeButton.addEventListener('click', closeArtifactModal);
            }
            
            if (modal) {
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        closeArtifactModal();
                    }
                });
            }
        });
    }

    // Export artifact manager
    if (globalScope) {
        globalScope.ArtifactManager = {
            updateShowCurrentSpecButton,
            handleShowCurrentSpecClick,
            renderArtifactModal,
            closeArtifactModal
        };
    }

    // Add visibility observer to refresh dropdown when chat tab becomes visible
    if (typeof document !== 'undefined' && typeof globalScope.ChatManager !== 'undefined') {
        const setupVisibilityObserver = () => {
            const chatContent = document.getElementById('chat-content');
            if (chatContent) {
                const observer = new MutationObserver(() => {
                    if (chatContent.style.display !== 'none' && globalScope.ChatManager) {
                        console.log('[Chat] Chat tab became visible, refreshing dropdown');
                        setTimeout(() => {
                            if (globalScope.ChatManager.refreshLLMModelDropdown) {
                                globalScope.ChatManager.refreshLLMModelDropdown();
                            }
                        }, 100);
                    }
                });
                
                observer.observe(chatContent, { attributes: true, attributeFilter: ['style'] });
                console.log('[Chat] Visibility observer set up for chat tab');
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupVisibilityObserver);
        } else {
            setupVisibilityObserver();
        }
    }

})(typeof window !== 'undefined' ? window : undefined);

if (typeof module !== 'undefined') {
    const exportsForTests = require('./chat.js');
    module.exports = exportsForTests;
}
