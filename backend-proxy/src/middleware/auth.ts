import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  betaCode?: string;
  body: any;
}

/**
 * Middleware to validate beta code
 * Checks if the provided beta code matches the valid code from environment
 */
export const validateBetaCode = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { betaCode } = req.body;
  const validBetaCode = process.env.VALID_BETA_CODE;

  // Check if beta code is provided
  if (!betaCode) {
    res.status(400).json({
      type: 'error',
      error: 'Beta code is required',
      errorCode: 'MISSING_BETA_CODE'
    });
    return;
  }

  // Check if valid beta code is configured
  if (!validBetaCode) {
    console.error('VALID_BETA_CODE environment variable is not set');
    res.status(500).json({
      type: 'error',
      error: 'Server configuration error',
      errorCode: 'INTERNAL_ERROR'
    });
    return;
  }

  // Validate beta code
  if (betaCode.trim() !== validBetaCode.trim()) {
    console.log(`Invalid beta code attempt: ${betaCode} (expected: ${validBetaCode})`);
    res.status(401).json({
      type: 'error',
      error: 'Invalid beta code provided',
      errorCode: 'INVALID_BETA_CODE'
    });
    return;
  }

  // Beta code is valid, attach to request and continue
  req.betaCode = betaCode;
  next();
};

/**
 * Middleware to validate request body structure
 * Ensures required fields are present and properly formatted
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { model, messages } = req.body;

  // Check required fields
  if (!model) {
    res.status(400).json({
      type: 'error',
      error: 'Model is required',
      errorCode: 'INVALID_REQUEST'
    });
    return;
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      type: 'error',
      error: 'Messages array is required and must not be empty',
      errorCode: 'INVALID_REQUEST'
    });
    return;
  }

  // Validate message structure
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message.role || !message.content) {
      res.status(400).json({
        type: 'error',
        error: `Message at index ${i} must have 'role' and 'content' fields`,
        errorCode: 'INVALID_REQUEST'
      });
      return;
    }

    if (!['system', 'user', 'assistant'].includes(message.role)) {
      res.status(400).json({
        type: 'error',
        error: `Message at index ${i} has invalid role: ${message.role}`,
        errorCode: 'INVALID_REQUEST'
      });
      return;
    }
  }

  // Validate model name
  if (model !== 'gemini-2.5-flash-beta') {
    res.status(400).json({
      type: 'error',
      error: 'Only gemini-2.5-flash-beta model is supported',
      errorCode: 'INVALID_REQUEST'
    });
    return;
  }

  next();
};
