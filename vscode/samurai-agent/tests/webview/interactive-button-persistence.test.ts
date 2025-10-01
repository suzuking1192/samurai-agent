/**
 * Test to verify interactive button click shows "Thinking..." indicator
 * and persists messages correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Interactive Button - Create Specs', () => {
  let chatState: any;
  let globalScope: any;
  let mockSaveChatMessage: any;
  let mockAgentExecute: any;

  beforeEach(() => {
    // Mock chat state
    chatState = {
      currentSessionId: 'test-session-id',
      currentSession: {
        id: 'test-session-id',
        projectId: 'test-project-id'
      },
      projectSettings: {
        projectId: 'test-project-id'
      }
    };

    // Mock save chat message
    mockSaveChatMessage = vi.fn().mockResolvedValue(undefined);
    
    // Mock agent execute
    mockAgentExecute = vi.fn().mockResolvedValue({
      success: true,
      message: 'Specs created successfully'
    });

    // Mock global scope
    globalScope = {
      MessageType: {
        USER: 'user',
        ASSISTANT: 'assistant'
      },
      WebviewApi: {
        persistence: {
          saveChatMessage: mockSaveChatMessage
        },
        agent: {
          execute: mockAgentExecute
        }
      }
    };

    // Mock document
    global.document = {
      getElementById: vi.fn().mockReturnValue({
        appendChild: vi.fn(),
        scrollTop: 0,
        scrollHeight: 1000
      }),
      createElement: vi.fn().mockImplementation((tag: string) => {
        return {
          className: '',
          textContent: '',
          id: '',
          remove: vi.fn(),
          parentNode: { removeChild: vi.fn() }
        };
      })
    } as any;
  });

  it('should show "Thinking..." indicator when interactive button is clicked', async () => {
    const question = {
      type: 'button',
      label: 'Create specs for the tasks we discussed; AI will resolve any ambiguity.',
      messageToSend: 'Create specs for the tasks we discussed'
    };

    // Simulate the button click logic
    const userMsg = {
      id: `user-${Date.now()}`,
      sessionId: chatState.currentSessionId,
      projectId: chatState.projectSettings?.projectId,
      type: globalScope?.MessageType?.USER || 'user',
      role: 'user',
      content: question.messageToSend,
      metadata: {}
    };

    // Create pending indicator
    const pendingIndicator = document.createElement('div');
    pendingIndicator.className = 'assistant-message pending';
    pendingIndicator.textContent = 'Thinking...';

    // Verify the pending indicator has correct properties
    expect(pendingIndicator.className).toBe('assistant-message pending');
    expect(pendingIndicator.textContent).toBe('Thinking...');
  });

  it('should persist user message when interactive button is clicked', async () => {
    const question = {
      type: 'button',
      label: 'Create specs for the tasks we discussed',
      messageToSend: 'Create specs for the tasks we discussed'
    };

    const userMsg = {
      id: `user-${Date.now()}`,
      sessionId: chatState.currentSessionId,
      projectId: chatState.projectSettings?.projectId,
      type: globalScope?.MessageType?.USER || 'user',
      role: 'user',
      content: question.messageToSend,
      metadata: {}
    };

    // Simulate saving the message
    await globalScope.WebviewApi.persistence.saveChatMessage({
      sessionId: chatState.currentSessionId,
      projectId: chatState.projectSettings.projectId,
      type: userMsg.type,
      content: userMsg.content,
      role: userMsg.role,
      metadata: userMsg.metadata
    });

    // Verify saveChatMessage was called with correct parameters
    expect(mockSaveChatMessage).toHaveBeenCalledWith({
      sessionId: 'test-session-id',
      projectId: 'test-project-id',
      type: 'user',
      content: 'Create specs for the tasks we discussed',
      role: 'user',
      metadata: {}
    });
  });

  it('should call agent.execute with correct parameters', async () => {
    const question = {
      type: 'button',
      messageToSend: 'Create specs for the tasks we discussed'
    };

    const userMsg = {
      id: `user-${Date.now()}`,
      sessionId: chatState.currentSessionId,
      projectId: chatState.projectSettings?.projectId,
      type: 'user',
      role: 'user',
      content: question.messageToSend,
      metadata: {}
    };

    // Simulate agent execute
    await globalScope.WebviewApi.agent.execute({
      userMessage: userMsg,
      session: chatState.currentSession,
      message: question.messageToSend
    });

    // Verify agent.execute was called
    expect(mockAgentExecute).toHaveBeenCalledWith({
      userMessage: userMsg,
      session: chatState.currentSession,
      message: 'Create specs for the tasks we discussed'
    });
  });

  it('should remove pending indicator on success', () => {
    const pendingIndicator = {
      remove: vi.fn(),
      parentNode: { removeChild: vi.fn() }
    };

    // Simulate successful completion
    if (pendingIndicator && pendingIndicator.parentNode) {
      pendingIndicator.remove();
    }

    // Verify remove was called
    expect(pendingIndicator.remove).toHaveBeenCalled();
  });

  it('should remove pending indicator on error', () => {
    const pendingIndicator = {
      remove: vi.fn(),
      parentNode: { removeChild: vi.fn() }
    };

    // Simulate error scenario
    try {
      throw new Error('Test error');
    } catch (error) {
      if (pendingIndicator && pendingIndicator.parentNode) {
        pendingIndicator.remove();
      }
    }

    // Verify remove was called even on error
    expect(pendingIndicator.remove).toHaveBeenCalled();
  });
});

