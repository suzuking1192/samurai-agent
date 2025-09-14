import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import InteractiveQuestionButtons from '../InteractiveQuestionButtons';
import { QuestionSchema, UserInteractionSchema } from '../../types';

// Mock the question schemas
const mockConfirmingQuestion: QuestionSchema = {
  id: 'test-confirming-1',
  type: 'confirming',
  text: 'Is this the correct approach?',
  options: []
};

const mockOptionQuestion: QuestionSchema = {
  id: 'test-option-1',
  type: 'option',
  text: 'Choose your preferred option',
  options: ['A', 'B', 'C']
};

describe('InteractiveQuestionButtons', () => {
  const mockOnButtonClick = vi.fn();

  beforeEach(() => {
    mockOnButtonClick.mockClear();
  });

  describe('Confirming Questions', () => {
    it('renders all confirming question buttons', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      expect(screen.getByText('Is this the correct approach?')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
      expect(screen.getByText('Skip')).toBeInTheDocument();
      expect(screen.getByText('Let AI Decide')).toBeInTheDocument();
      expect(screen.getByText("Don't Know")).toBeInTheDocument();
    });

    it('calls onButtonClick with correct interaction for Yes button', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('Yes'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-confirming-1',
        action_type: 'yes',
        question_text: 'Is this the correct approach?'
      });
    });

    it('calls onButtonClick with correct interaction for No button', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('No'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-confirming-1',
        action_type: 'no',
        question_text: 'Is this the correct approach?'
      });
    });

    it('calls onButtonClick with correct interaction for Skip button', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('Skip'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-confirming-1',
        action_type: 'skip',
        question_text: 'Is this the correct approach?'
      });
    });

    it('calls onButtonClick with correct interaction for Let AI Decide button', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('Let AI Decide'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-confirming-1',
        action_type: 'ai_decide',
        question_text: 'Is this the correct approach?'
      });
    });

    it('calls onButtonClick with correct interaction for Don\'t Know button', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText("Don't Know"));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-confirming-1',
        action_type: 'do_not_know',
        question_text: 'Is this the correct approach?'
      });
    });
  });

  describe('Option Questions', () => {
    it('renders all option buttons', () => {
      render(
        <InteractiveQuestionButtons
          question={mockOptionQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      expect(screen.getByText('Choose your preferred option')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('calls onButtonClick with correct interaction for option A', () => {
      render(
        <InteractiveQuestionButtons
          question={mockOptionQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('A'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-option-1',
        action_type: 'option_selected',
        selected_option: 'A',
        question_text: 'Choose your preferred option'
      });
    });

    it('calls onButtonClick with correct interaction for option B', () => {
      render(
        <InteractiveQuestionButtons
          question={mockOptionQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('B'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-option-1',
        action_type: 'option_selected',
        selected_option: 'B',
        question_text: 'Choose your preferred option'
      });
    });

    it('calls onButtonClick with correct interaction for option C', () => {
      render(
        <InteractiveQuestionButtons
          question={mockOptionQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      fireEvent.click(screen.getByText('C'));

      expect(mockOnButtonClick).toHaveBeenCalledWith({
        question_id: 'test-option-1',
        action_type: 'option_selected',
        selected_option: 'C',
        question_text: 'Choose your preferred option'
      });
    });
  });

  describe('Disabled State', () => {
    it('disables all buttons when disabled prop is true', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
          disabled={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('does not call onButtonClick when disabled', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
          disabled={true}
        />
      );

      fireEvent.click(screen.getByText('Yes'));

      expect(mockOnButtonClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper button titles for confirming questions', () => {
      render(
        <InteractiveQuestionButtons
          question={mockConfirmingQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      expect(screen.getByTitle('Confirm this is correct')).toBeInTheDocument();
      expect(screen.getByTitle('Confirm this is incorrect')).toBeInTheDocument();
      expect(screen.getByTitle('Skip this question')).toBeInTheDocument();
      expect(screen.getByTitle('Let AI decide')).toBeInTheDocument();
      expect(screen.getByTitle("I don't know")).toBeInTheDocument();
    });

    it('has proper button titles for option questions', () => {
      render(
        <InteractiveQuestionButtons
          question={mockOptionQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      expect(screen.getByTitle('Select option A')).toBeInTheDocument();
      expect(screen.getByTitle('Select option B')).toBeInTheDocument();
      expect(screen.getByTitle('Select option C')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles option question with no options', () => {
      const emptyOptionQuestion: QuestionSchema = {
        id: 'test-empty-option',
        type: 'option',
        text: 'Choose an option',
        options: []
      };

      render(
        <InteractiveQuestionButtons
          question={emptyOptionQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      expect(screen.getByText('Choose an option')).toBeInTheDocument();
      // Should not render any option buttons
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('handles option question with many options', () => {
      const manyOptionsQuestion: QuestionSchema = {
        id: 'test-many-options',
        type: 'option',
        text: 'Choose from many options',
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
      };

      render(
        <InteractiveQuestionButtons
          question={manyOptionsQuestion}
          onButtonClick={mockOnButtonClick}
        />
      );

      expect(screen.getByText('Choose from many options')).toBeInTheDocument();
      
      // Should render all 10 option buttons
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(i.toString())).toBeInTheDocument();
      }
    });
  });
});
