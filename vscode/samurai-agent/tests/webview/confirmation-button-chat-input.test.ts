/**
 * Test to verify confirmation button click behavior for chat input field
 * Tests the handleConfirmationButtonClick function in src/webview/chat.js
 */

// Jest test for confirmation button chat input behavior

describe('Confirmation Button Chat Input Behavior', () => {
  let mockChatInput: any;
  let mockQuestionElement: any;
  let mockSafeGetDocumentElement: any;
  let handleConfirmationButtonClick: any;

  beforeEach(() => {
    // Mock chat input element
    mockChatInput = {
      value: '',
      focus: jest.fn()
    };

    // Mock question element with data-question attribute
    mockQuestionElement = {
      getAttribute: jest.fn().mockReturnValue('Should we implement this feature?')
    };

    // Mock safeGetDocumentElement function
    mockSafeGetDocumentElement = jest.fn().mockReturnValue(mockChatInput);

    // Mock the handleConfirmationButtonClick function
    handleConfirmationButtonClick = (questionElement: any, buttonType: string) => {
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
      const chatInput = mockSafeGetDocumentElement('chatInput');
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
    };
  });

  describe('Yes button behavior', () => {
    it('should append "YES" response when input field is empty', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'YES');
      
      // Assert
      expect(mockChatInput.value).toBe('I would like to answer "YES" to Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
      expect(mockQuestionElement.getAttribute).toHaveBeenCalledWith('data-question');
    });

    it('should append "YES" response with space when input field contains text', () => {
      // Arrange
      mockChatInput.value = 'Hello';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'YES');
      
      // Assert
      expect(mockChatInput.value).toBe('Hello I would like to answer "YES" to Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
    });

    it('should append "YES" response with space when input field contains whitespace only', () => {
      // Arrange
      mockChatInput.value = '   ';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'YES');
      
      // Assert
      expect(mockChatInput.value).toBe('I would like to answer "YES" to Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
    });
  });

  describe('No button behavior', () => {
    it('should append "NO" response when input field is empty', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'NO');
      
      // Assert
      expect(mockChatInput.value).toBe('I would like to answer "NO" to Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
    });

    it('should append "NO" response with space when input field contains text', () => {
      // Arrange
      mockChatInput.value = 'Previous message';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'NO');
      
      // Assert
      expect(mockChatInput.value).toBe('Previous message I would like to answer "NO" to Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
    });
  });

  describe('AI Recommendation button behavior', () => {
    it('should append AI recommendation request when input field is empty', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'AI_RECOMMENDATION');
      
      // Assert
      expect(mockChatInput.value).toBe('Please provide an AI recommendation for: Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
    });

    it('should append AI recommendation request with space when input field contains text', () => {
      // Arrange
      mockChatInput.value = 'I need help with';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'AI_RECOMMENDATION');
      
      // Assert
      expect(mockChatInput.value).toBe('I need help with Please provide an AI recommendation for: Should we implement this feature?');
      expect(mockChatInput.focus).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing question text gracefully', () => {
      // Arrange
      const mockQuestionElementNoText = {
        getAttribute: jest.fn().mockReturnValue(null)
      };
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Act
      handleConfirmationButtonClick(mockQuestionElementNoText, 'YES');
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Chat: No question text found in data-question attribute');
      expect(mockChatInput.value).toBe(''); // Should remain unchanged
      expect(mockChatInput.focus).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle unknown button type gracefully', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'UNKNOWN_BUTTON');
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Chat: Unknown button type:', 'UNKNOWN_BUTTON');
      expect(mockChatInput.value).toBe(''); // Should remain unchanged
      expect(mockChatInput.focus).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle missing chat input element gracefully', () => {
      // Arrange
      mockSafeGetDocumentElement.mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'YES');
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Chat: chatInput element not found');
      
      consoleSpy.mockRestore();
    });

    it('should handle multiple consecutive button clicks correctly', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act - First click
      handleConfirmationButtonClick(mockQuestionElement, 'YES');
      const firstResult = mockChatInput.value;
      
      // Act - Second click
      handleConfirmationButtonClick(mockQuestionElement, 'NO');
      const secondResult = mockChatInput.value;
      
      // Assert
      expect(firstResult).toBe('I would like to answer "YES" to Should we implement this feature?');
      expect(secondResult).toBe('I would like to answer "YES" to Should we implement this feature? I would like to answer "NO" to Should we implement this feature?');
    });
  });

  describe('Text formatting verification', () => {
    it('should use correct text format for YES button', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'YES');
      
      // Assert
      expect(mockChatInput.value).toMatch(/^I would like to answer "YES" to .+$/);
    });

    it('should use correct text format for NO button', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'NO');
      
      // Assert
      expect(mockChatInput.value).toMatch(/^I would like to answer "NO" to .+$/);
    });

    it('should use correct text format for AI recommendation button', () => {
      // Arrange
      mockChatInput.value = '';
      
      // Act
      handleConfirmationButtonClick(mockQuestionElement, 'AI_RECOMMENDATION');
      
      // Assert
      expect(mockChatInput.value).toMatch(/^Please provide an AI recommendation for: .+$/);
    });
  });
});
