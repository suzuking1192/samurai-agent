import React from 'react';
import ReactMarkdown from 'react-markdown';
import { QuestionSchema, UserInteractionSchema } from '../types';

interface InteractiveQuestionButtonsProps {
  question: QuestionSchema;
  onButtonClick: (interaction: UserInteractionSchema) => void;
  disabled?: boolean;
  hideQuestionText?: boolean;
}

const InteractiveQuestionButtons: React.FC<InteractiveQuestionButtonsProps> = ({
  question,
  onButtonClick,
  disabled = false,
  hideQuestionText = false
}) => {
  const handleConfirmingButtonClick = (actionType: 'yes' | 'no' | 'skip' | 'ai_decide' | 'do_not_know') => {
    const interaction: UserInteractionSchema = {
      question_id: question.id,
      action_type: actionType,
      question_text: question.text
    };
    onButtonClick(interaction);
  };

  const handleOptionButtonClick = (selectedOption: string) => {
    const interaction: UserInteractionSchema = {
      question_id: question.id,
      action_type: 'option_selected',
      selected_option: selectedOption,
      question_text: question.text
    };
    onButtonClick(interaction);
  };

  if (question.type === 'confirming') {
    return (
      <div className="interactive-question-buttons confirming-buttons">
        {!hideQuestionText && (
          <div className="question-text">
            <strong>Question:</strong>{' '}
            <ReactMarkdown
              components={{
                code: ({children, className}) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="markdown-inline-code">{children}</code>
                  ) : (
                    <code className="markdown-code">{children}</code>
                  );
                },
                p: ({children}) => <span>{children}</span>,
                strong: ({children}) => <strong>{children}</strong>,
                em: ({children}) => <em>{children}</em>,
                ul: ({children}) => <ul className="markdown-list">{children}</ul>,
                ol: ({children}) => <ol className="markdown-list">{children}</ol>,
                li: ({children}) => <li className="markdown-list-item">{children}</li>,
              }}
            >
              {question.text}
            </ReactMarkdown>
          </div>
        )}
        <div className="button-group">
          <button
            className="btn btn-sm btn-success"
            onClick={() => handleConfirmingButtonClick('yes')}
            disabled={disabled}
            title="Confirm this is correct"
          >
            Yes
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => handleConfirmingButtonClick('no')}
            disabled={disabled}
            title="Confirm this is incorrect"
          >
            No
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => handleConfirmingButtonClick('skip')}
            disabled={disabled}
            title="Skip this question"
          >
            Skip
          </button>
          <button
            className="btn btn-sm btn-info"
            onClick={() => handleConfirmingButtonClick('ai_decide')}
            disabled={disabled}
            title="Let AI decide"
          >
            Let AI Decide
          </button>
          <button
            className="btn btn-sm btn-warning"
            onClick={() => handleConfirmingButtonClick('do_not_know')}
            disabled={disabled}
            title="I don't know"
          >
            Don't Know
          </button>
        </div>
      </div>
    );
  }

  if (question.type === 'option') {
    return (
      <div className="interactive-question-buttons option-buttons">
        {!hideQuestionText && (
          <div className="question-text">
            <strong>Question:</strong>{' '}
            <ReactMarkdown
              components={{
                code: ({children, className}) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="markdown-inline-code">{children}</code>
                  ) : (
                    <code className="markdown-code">{children}</code>
                  );
                },
                p: ({children}) => <span>{children}</span>,
                strong: ({children}) => <strong>{children}</strong>,
                em: ({children}) => <em>{children}</em>,
                ul: ({children}) => <ul className="markdown-list">{children}</ul>,
                ol: ({children}) => <ol className="markdown-list">{children}</ol>,
                li: ({children}) => <li className="markdown-list-item">{children}</li>,
              }}
            >
              {question.text}
            </ReactMarkdown>
          </div>
        )}
        <div className="button-group">
          {question.options.map((option, index) => (
            <button
              key={index}
              className="btn btn-sm btn-outline-primary"
              onClick={() => handleOptionButtonClick(option)}
              disabled={disabled}
              title={`Select option ${option}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default InteractiveQuestionButtons;

