import { Router, Request, Response } from 'express';
import { validateBetaCode, validateRequest, AuthenticatedRequest } from '../middleware/auth';
import { GeminiClient, LLMMessage } from '../utils/geminiClient';

const router = Router();

// Initialize Gemini client
let geminiClient: GeminiClient | null = null;

const initializeGeminiClient = (): GeminiClient => {
  if (!geminiClient) {
    const apiKey = process.env.BETA_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('BETA_GEMINI_API_KEY environment variable is not set');
    }
    geminiClient = new GeminiClient(apiKey);
  }
  return geminiClient;
};

/**
 * POST /api/gemini-beta/chat
 * Handles chat completion requests for the beta model
 */
router.post('/chat', validateRequest, validateBetaCode, async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { model, messages, temperature, maxTokens, topP, topK } = req.body;

    console.log(`[${new Date().toISOString()}] Processing beta request:`, {
      model,
      messageCount: messages.length,
      hasTemperature: temperature !== undefined,
      hasMaxTokens: maxTokens !== undefined,
      betaCode: req.betaCode ? '***' : 'missing'
    });

    // Initialize Gemini client
    const client = initializeGeminiClient();

    // Generate content
    const result = await client.generateContent(messages as LLMMessage[], {
      temperature,
      maxTokens,
      topP,
      topK
    });

    const totalProcessingTime = Date.now() - startTime;

    console.log(`[${new Date().toISOString()}] Beta request completed:`, {
      processingTime: totalProcessingTime,
      tokens: result.usage.totalTokens,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens
    });

    // Return success response
    res.json({
      type: 'success',
      payload: {
        content: result.content,
        usage: result.usage,
        processingTime: totalProcessingTime
      }
    });

  } catch (error: any) {
    const totalProcessingTime = Date.now() - startTime;
    
    console.error(`[${new Date().toISOString()}] Beta request failed:`, {
      error: error.message || error,
      errorCode: error.errorCode || 'UNKNOWN_ERROR',
      processingTime: totalProcessingTime
    });

    // Handle different types of errors
    if (error.errorCode) {
      // This is a mapped Gemini error
      res.status(500).json({
        type: 'error',
        error: error.error,
        errorCode: error.errorCode
      });
    } else if (error.message?.includes('BETA_GEMINI_API_KEY')) {
      // Configuration error
      res.status(500).json({
        type: 'error',
        error: 'Server configuration error',
        errorCode: 'CONFIG_ERROR'
      });
    } else {
      // Generic error
      res.status(500).json({
        type: 'error',
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR'
      });
    }
  }
});

/**
 * GET /api/gemini-beta/status
 * Returns the status of the beta proxy service
 */
router.get('/status', (_req: Request, res: Response) => {
  const hasApiKey = !!process.env.BETA_GEMINI_API_KEY;
  const hasValidCode = !!process.env.VALID_BETA_CODE;
  
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    configuration: {
      hasApiKey,
      hasValidCode,
      model: 'gemini-2.5-flash-beta'
    },
    uptime: process.uptime()
  });
});

export { router as geminiProxyRouter };
