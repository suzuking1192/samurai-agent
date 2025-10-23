import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { LLMProviderService } from "../llm/llmProviderService";
import { ProjectDetailService } from "../memory/projectDetailService";
import { DataStore } from "../../persistence/dataStore";
import { ChatMessage, Session, UserIntentEnum, ISpecClarificationOutput, ConfirmationQuestion } from "../../common/models/chat-models";
import { AgentExecutionResult } from "../models/agent-models";
import { LLMMessage } from "../../common/models/llm-models";
import { ExtractCodeToolResultPayload } from "../../common/models/tool-models";
import { extractJsonFromLLMResponse } from "../../common/utils/llmResponseParser";
import { ExtractCodeTool } from "../tools/extractCodeTool";
import { CreateSpecTool } from "../tools/createSpecTool";
import { ConfirmationQuestionService } from "../../extension/services/confirmationQuestionService";
import { TelemetryService } from "../../services/TelemetryService";

export interface FeatureExplorationResult {
  ideas: string[];
  metadata: Record<string, unknown>;
}


export interface SpecGenerationResult {
  specId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export class SamuraiAgent {
  private currentExecutionCost: number = 0;
  
  constructor(
    private readonly llmProviderService: LLMProviderService,
    private readonly dataStore: DataStore,
    private readonly projectDetailService: ProjectDetailService,
    private readonly extractCodeTool: ExtractCodeTool,
    private readonly createSpecTool: CreateSpecTool,
    private readonly telemetryService: TelemetryService
  ) {}

  /**
   * Main entry point for agent operations
   * Orchestrates the processing of user messages within a given session
   */
  public async execute(
    userMessage: ChatMessage,
    session: Session,
    onProgress?: (update: { stage: string; data?: unknown }) => void,
  ): Promise<AgentExecutionResult> {
    this.logInvocation("execute", userMessage.content);
    onProgress?.({ stage: "analyzing" });
    
    // Reset execution cost for this run
    this.currentExecutionCost = 0;
    console.log('[COST DEBUG] SamuraiAgent - Reset execution cost to 0');
    
    try {
      // Load chat session history
      const chatMessages = this.dataStore.loadChatMessagesForSession(session.id);
      const chatHistory: LLMMessage[] = chatMessages.map((msg: ChatMessage) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }));

      chatHistory.push({ role: 'user', content: userMessage.content });
      
      // Load project detail memory
      const projectDetails = await this.projectDetailService.getProjectDetails(session.metadata.projectId) || "";
      
      // Load code context if available
      let initialCodeContexts: any[] = [];
      if (session.codeContextIds && session.codeContextIds.length > 0) {
        initialCodeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
      }
      
      // Check if we should route based on session mode (for deep bug analysis mode)
      const sessionMode = session.metadata?.mode;
      console.log('[MODE DEBUG] Session mode check:', {
        sessionMode,
        hasMetadata: !!session.metadata,
        metadata: session.metadata,
        isDeepBugAnalysis: sessionMode === 'deep_bug_analysis'
      });
      
      if (sessionMode === 'deep_bug_analysis') {
        // Route directly to deep bug analysis handler
        this.logInvocation("execute", "Routing to deep bug analysis mode based on session mode");
        
        // Load code contexts for the session
        let codeContexts: ExtractCodeToolResultPayload[] = [];
        if (session.codeContextIds && session.codeContextIds.length > 0) {
          codeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
        }
        
        // Call the deep bug analysis handler directly
        const agentResponse = await this.handleDeepBugAnalysis(userMessage, chatHistory, projectDetails, codeContexts, session);
        
        // TODO: Implement message persistence
        // For now, we'll just return the response without persisting messages
        // This will be implemented when the DataStore has proper public methods for chat message persistence
        
        // Update session with new message count
        await this.dataStore.updateSession(session.id, {
          messageCount: (session.messageCount || 0) + 2 // User message + agent response
        });
        
        console.log('[COST DEBUG] SamuraiAgent - Deep bug analysis execution cost:', this.currentExecutionCost);
        
        return {
          success: true,
          message: agentResponse,
          metadata: {
            userIntent: 'deep_bug_analysis',
            cost: this.currentExecutionCost
          }
        };
      }
      
      // Analyze user intent with loaded context
      const userIntent = await this.analyzeUserIntent(chatHistory, userMessage, projectDetails, session);
      
      // Analyze code extraction needs after intent analysis
      const codeExtractionAnalysisResult = await this.analyzeCodeExtractionNeeds(
        chatHistory, 
        projectDetails, 
        session, 
        userIntent
      );
      
      // Log the code extraction analysis result
      this.logInvocation("analyzeCodeExtractionNeeds", `Result: ${JSON.stringify(codeExtractionAnalysisResult)}`);
      
      // Conditional code extraction based on analysis result
      if (codeExtractionAnalysisResult.new_code_context_necessary && codeExtractionAnalysisResult.extraction_query) {
        onProgress?.({
          stage: "extracting-code",
          data: { query: codeExtractionAnalysisResult.extraction_query },
        });
        try {
          // Log the extraction query before passing it to ExtractCodeTool
          console.log('SamuraiAgent - About to call ExtractCodeTool with query:', {
            queryLength: codeExtractionAnalysisResult.extraction_query?.length,
            queryPreview: codeExtractionAnalysisResult.extraction_query?.substring(0, 100) + (codeExtractionAnalysisResult.extraction_query && codeExtractionAnalysisResult.extraction_query.length > 100 ? '...' : ''),
            fullQuery: codeExtractionAnalysisResult.extraction_query
          });
          
          const extractionResult = await this.extractCodeTool.execute({
            query: codeExtractionAnalysisResult.extraction_query,
            filePathPattern: undefined, // Could be added to analysis result in the future
            projectId: session.metadata.projectId,
            sessionId: session.id,
            connectedCodebasePath: session.metadata.connectedCodebasePath,
            model: session.metadata.model,
            filenameKeywords: codeExtractionAnalysisResult.filenameKeywords,
            methodNameKeywords: codeExtractionAnalysisResult.methodNameKeywords,
            codeKeywords: codeExtractionAnalysisResult.codeKeywords,
            manuallyPinnedFilePaths: session.pinnedFilePaths || [],
          });

          if (extractionResult.success && extractionResult.result) {
            const extractedFiles = (extractionResult.result as any)?.relevantCodeElements?.map((ctx: any) => ({
              path: ctx.path,
              elementCount: ctx.elements?.length,
            })) || [];
            console.log("SamuraiAgent: extractCodeTool.execute succeeded", {
              files: extractedFiles,
            });
            onProgress?.({ stage: "extraction-complete", data: { files: extractedFiles } });
            // Save the extracted code context
            const newCodeContextId = await this.dataStore.saveCodeContext(
              extractionResult.result as ExtractCodeToolResultPayload,
              session.metadata.projectId,
              session.id
            );

            // Update session with new code context ID (overwrite existing)
            const updatedContextIds = [newCodeContextId];
            await this.dataStore.updateSession(session.id, { 
              codeContextIds: updatedContextIds 
            });

            // Update the session object for the rest of the method
            session.codeContextIds = updatedContextIds;

            this.logInvocation("extractCodeTool.execute", `Successfully extracted and saved code context: ${newCodeContextId}`);
          } else {
            this.logInvocation("extractCodeTool.execute", `Code extraction failed: ${extractionResult.error}`);
            onProgress?.({ stage: "extraction-failed", data: { error: extractionResult.error } });
          }
        } catch (error) {
          console.error('Error in code extraction:', error);
          
          // Capture error to PostHog for monitoring
          this.telemetryService.captureError(error as Error, { 
            service: 'SamuraiAgent', 
            function: 'codeExtraction',
            extractionQuery: codeExtractionAnalysisResult.extraction_query
          });
          
          this.logInvocation("extractCodeTool.execute", `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          onProgress?.({
            stage: "extraction-failed",
            data: { error: error instanceof Error ? error.message : String(error) },
          });
        }
      }
      
      // Load code contexts for the session
      let codeContexts: ExtractCodeToolResultPayload[] = [];
      if (session.codeContextIds && session.codeContextIds.length > 0) {
        codeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
      }
      // Dispatch to appropriate handler based on user intent
      let agentResponse: string;
      let specClarificationData: ISpecClarificationOutput | undefined;
      let interactiveQuestions: any[] | undefined;
      
      switch (userIntent) {
        case UserIntentEnum.PURE_DISCUSSION:
          agentResponse = await this.handlePureDiscussion(userMessage, chatHistory, projectDetails, codeContexts, session);
          break;
          
        case UserIntentEnum.FEATURE_EXPLORATION:
          agentResponse = await this.handleFeatureExploration(userMessage, chatHistory, projectDetails, codeContexts, session);
          break;
          
        case UserIntentEnum.SPEC_CLARIFICATION:
          const clarificationResult = await this.handleSpecClarification(userMessage, chatHistory, projectDetails, codeContexts, session);
          agentResponse = clarificationResult.clarification_text;
          specClarificationData = clarificationResult;
          
          // Create interactive button for "Create specs"
          interactiveQuestions = [{
            type: 'button',
            label: 'Create specs for the tasks we discussed; AI will resolve any ambiguity.',
            messageToSend: 'Create specs for the tasks we discussed'
          }];
          break;
          
        case UserIntentEnum.SPEC_GENERATION:
          const specGenerationResult = await this.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails, session);
          agentResponse = specGenerationResult.message;
          break;
          
        default:
          agentResponse = "I'm not sure how to handle that type of request. Please try rephrasing your message.";
      }
      
      // Detect and extract confirmation questions from the agent response
      const interactiveConfirmationQuestions = ConfirmationQuestionService.detectAndExtractQuestions(agentResponse);
      
      // TODO: Implement message persistence
      // For now, we'll just return the response without persisting messages
      // This will be implemented when the DataStore has proper public methods for chat message persistence
      
      // Update session with new message count and previous intent
      await this.dataStore.updateSession(session.id, {
        messageCount: (session.messageCount || 0) + 2, // User message + agent response
        previous_session_intent: userIntent
      });
      
      console.log('[COST DEBUG] SamuraiAgent - Final execution cost:', this.currentExecutionCost);
      
      return {
        success: true,
        message: agentResponse,
        metadata: {
          userIntent,
          chatHistoryLength: chatHistory.length,
          projectDetailsLength: projectDetails.length,
          codeContextsCount: codeContexts.length,
          codeExtractionAnalysis: codeExtractionAnalysisResult,
          specClarificationData,
          interactiveQuestions,
          interactiveConfirmationQuestions: interactiveConfirmationQuestions.length > 0 ? interactiveConfirmationQuestions : undefined,
          cost: this.currentExecutionCost
        }
      };
    } catch (error) {
      console.error('Error in SamuraiAgent.execute:', error);
      
      // Capture critical error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'execute' 
      });
      
      return {
        success: false,
        message: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  public async analyzeUserIntent(
    chatHistory: LLMMessage[], 
    currentUserMessage: ChatMessage, 
    projectDetails: string,
    session: Session
  ): Promise<UserIntentEnum> {
    this.logInvocation("analyzeUserIntent", currentUserMessage.content);
    
    // Step 1: Check for keyword matching for spec_generation
    const messageContent = currentUserMessage.content.toLowerCase();
    const specGenerationKeywords = ["create specs now", "create a spec", "create specs"];
    
    for (const keyword of specGenerationKeywords) {
      if (messageContent.includes(keyword)) {
        this.logInvocation("analyzeUserIntent", `Keyword match found: ${keyword} -> SPEC_GENERATION`);
        return UserIntentEnum.SPEC_GENERATION;
      }
    }
    
    // Step 1.5: Check for code review keyword matching
    const codeReviewKeywords = [
      "please conduct a thorough code review",
      "conduct a thorough code review",
      "conduct a code review"
    ];
    
    for (const keyword of codeReviewKeywords) {
      if (messageContent.includes(keyword)) {
        this.logInvocation("analyzeUserIntent", `Code review keyword match found: ${keyword} -> PURE_DISCUSSION`);
        return UserIntentEnum.PURE_DISCUSSION;
      }
    }
    
    // Step 2: If no keyword match, proceed to LLM analysis
    return await this.performLLMIntentAnalysis(chatHistory, currentUserMessage, projectDetails, session);
  }

  /**
   * Analyzes whether new code context extraction is needed for the current conversation
   * @param chatHistory - List of LLMMessage objects representing conversation history
   * @param projectDetails - String containing project details and context
   * @param session - Session object containing session metadata
   * @param userIntent - UserIntentEnum representing the analyzed user intent
   * @returns Promise resolving to analysis result with necessity flag, extraction query, and reasoning
   */
  private async analyzeCodeExtractionNeeds(
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    session: Session, 
    userIntent: UserIntentEnum
  ): Promise<{ new_code_context_necessary: boolean, extraction_query: string | null, reasoning: string, filenameKeywords?: string[], methodNameKeywords?: string[], codeKeywords?: string[] }> {
    this.logInvocation("analyzeCodeExtractionNeeds", `Intent: ${userIntent}`);
    
    try {
      // Step 1: Get the current user message (last message in chat history)
      const currentUserMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : "No current message";
      
      // Step 2: Check for keyword detection first
      const keywordDetected = this.detectCodeExtractionKeyword(currentUserMessage);
      
      if (keywordDetected) {
        this.logInvocation("analyzeCodeExtractionNeeds", "Keyword detected - bypassing LLM call");
        return {
          new_code_context_necessary: true,
          extraction_query: currentUserMessage,
          reasoning: "Keyword 'Please read the latest code' detected in user message - bypassing LLM analysis",
          filenameKeywords: [],
          methodNameKeywords: [],
          codeKeywords: []
        };
      }
      
      // Step 3: Load existing code context for the session
      let existingCodeContexts: ExtractCodeToolResultPayload[] = [];
      if (session.codeContextIds && session.codeContextIds.length > 0) {
        existingCodeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
      }
      
      // Step 4: Format existing code context for LLM prompt
      const formattedExistingContext = this._formatExistingCodeContextForLLM(existingCodeContexts);
      
      // Step 5: Build conversation summary from chat history
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
      // Step 6: Load and populate the prompt template
      const promptTemplate = this.readPromptFile('codeExtraction/analyze_code_extraction_needs.md');
      const populatedPrompt = promptTemplate
        .replace('{activeTaskHeader}', '') // No active task header for now
        .replace('{noActiveTaskInference}', '') // No active task inference for now
        .replace('{conversationSummary}', conversationSummary)
        .replace('{projectDetails}', projectDetails || 'No project details available')
        .replace('{userIntent}', userIntent)
        .replace('{currentUserMessage}', currentUserMessage)
        .replace('{existingCodeContext}', formattedExistingContext);
      
      // Step 7: Make LLM call
      const response = await this.llmProviderService.chat({
        id: `code-extraction-analysis-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages: [
          { role: "system", content: populatedPrompt }
        ],
        metadata: {
          type: "code_extraction_analysis"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Step 8: Parse and validate LLM response
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost from this LLM call
      this.trackLLMCost(llmResponse, 'analyzeCodeExtractionNeeds');
      
      const responseContent = llmResponse.content?.trim() || "";
      const parsedResult = extractJsonFromLLMResponse(responseContent);
      
      // Check if JSON parsing was successful
      if (!parsedResult || typeof parsedResult !== 'object') {
        throw new Error(`Failed to parse JSON from LLM response. Content: ${responseContent.substring(0, 200)}${responseContent.length > 200 ? '...' : ''}`);
      }
      
      // Step 9: Return the parsed result
      const result = {
        new_code_context_necessary: parsedResult.new_code_context_necessary,
        extraction_query: parsedResult.extraction_query,
        reasoning: parsedResult.reasoning,
        filenameKeywords: parsedResult.filenameKeywords || [],
        methodNameKeywords: parsedResult.methodNameKeywords || [],
        codeKeywords: parsedResult.codeKeywords || []
      };
      
      // Log the extraction query details for debugging
      console.log('analyzeCodeExtractionNeeds - extraction_query details:', {
        hasQuery: !!result.extraction_query,
        queryLength: result.extraction_query?.length,
        queryPreview: result.extraction_query?.substring(0, 100) + (result.extraction_query && result.extraction_query.length > 100 ? '...' : ''),
        fullQuery: result.extraction_query
      });
      
      return result;
      
    } catch (error) {
      console.error('Error in analyzeCodeExtractionNeeds:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'analyzeCodeExtractionNeeds' 
      });
      
      return {
        new_code_context_necessary: false,
        extraction_query: null,
        reasoning: `Error in code extraction analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filenameKeywords: [],
        methodNameKeywords: [],
        codeKeywords: []
      };
    }
  }

  /**
   * Detects the hardcoded keyword "Please read the latest code" in user messages
   * @param userMessage - The user's input message
   * @returns boolean indicating whether the keyword is present
   */
  private detectCodeExtractionKeyword(userMessage: string): boolean {
    if (!userMessage || typeof userMessage !== 'string') {
      return false;
    }
    
    // Perform case-insensitive, exact phrase matching
    const keyword = "please read the latest code";
    const normalizedMessage = userMessage.toLowerCase().trim();
    
    // Use word boundary regex to ensure the keyword is not part of a larger word
    // This ensures "codebook" doesn't match "code"
    const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return keywordRegex.test(normalizedMessage);
  }

  public async handlePureDiscussion(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[],
    session: Session
  ): Promise<string> {
    this.logInvocation("handlePureDiscussion", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      console.log('[DEBUG handlePureDiscussion] codeContexts received:', codeContexts.length);
      console.log('[DEBUG handlePureDiscussion] formattedCodeContexts length:', formattedCodeContexts.length);
      console.log('[DEBUG handlePureDiscussion] formattedCodeContexts preview:', formattedCodeContexts.slice(0, 500));
      
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory) + `\n\nLatest user request: ${userMessage.content}`;
      
      // Load and format the system prompt
      const systemPrompt = await this._loadAndFormatSystemPrompt(
        'pureDiscussion/system_prompt.md',
        {
          projectDetails,
          codeContexts: formattedCodeContexts,
          conversationSummary,
          activeTaskHeader: '', // No active task for now
          noActiveTaskInference: '' // No active task inference for now
        }
      );
      
      console.log('[DEBUG handlePureDiscussion] systemPrompt contains CODE CONTEXT section:', systemPrompt.includes('## CODE CONTEXT'));
      console.log('[DEBUG handlePureDiscussion] systemPrompt codeContexts section preview:', 
        systemPrompt.substring(
          systemPrompt.indexOf('## CODE CONTEXT'), 
          Math.min(systemPrompt.indexOf('## CODE CONTEXT') + 1000, systemPrompt.length)
        )
      );
      
      // Construct messages array for LLM request
      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory, // Include chat history for context
        { role: "user", content: userMessage.content }
      ];
      
      // Call LLM service
      const response = await this.llmProviderService.chat({
        id: `pure-discussion-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages,
        metadata: {
          type: "pure_discussion"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Extract and return the content
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost from this LLM call
      this.trackLLMCost(llmResponse, 'handlePureDiscussion');
      
      return llmResponse.content?.trim() || "I'm here to help with your project! What would you like to discuss?";
      
    } catch (error) {
      console.error('Error in handlePureDiscussion:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'handlePureDiscussion' 
      });
      
      return "I'm here to help with your project! What would you like to discuss?";
    }
  }

  public async handleFeatureExploration(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[],
    session: Session
  ): Promise<string> {
    this.logInvocation("handleFeatureExploration", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);

      // Include current artifact in context if available
      let artifactContext = "";
      if (session.currentArtifact?.textSpec) {
        artifactContext = `\n\n## CURRENT SPECIFICATION ARTIFACT\n${session.currentArtifact.textSpec}\n`;
      }

      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory) + artifactContext + `\n\nLatest user request: ${userMessage.content}`;
      
      // Load and format the system prompt
      const systemPrompt = await this._loadAndFormatSystemPrompt(
        'featureExploration/system_prompt.md',
        {
          projectDetails,
          codeContexts: formattedCodeContexts,
          conversationSummary,
          activeTaskHeader: '', // No active task for now
          noActiveTaskInference: '' // No active task inference for now
        }
      );
      
      // Construct messages array for LLM request
      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...chatHistory, // Include chat history for context
        { role: "user", content: userMessage.content }
      ];
      
      // Call LLM service
      const response = await this.llmProviderService.chat({
        id: `feature-exploration-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages,
        metadata: {
          type: "feature_exploration"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Extract and return the content
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost from this LLM call
      this.trackLLMCost(llmResponse, 'handleFeatureExploration');
      
      return llmResponse.content?.trim() || "That's an interesting feature idea! Tell me more about what you have in mind.";
      
    } catch (error) {
      console.error('Error in handleFeatureExploration:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'handleFeatureExploration' 
      });
      
      return "That's an interesting feature idea! Tell me more about what you have in mind.";
    }
  }

  public async handleDeepBugAnalysis(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[],
    session: Session
  ): Promise<string> {
    this.logInvocation("handleDeepBugAnalysis", userMessage.content);
    
    try {
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory) + `\n\nLatest user request: ${userMessage.content}`;
      const bugDescription = userMessage.content;
      
      // Initialize iteration tracking
      let iteration = 0;
      const MAX_ITERATIONS = 2;
      let accumulatedCodeContexts = [...codeContexts]; // Keep existing contexts
      let currentAnalysis: any = null;
      
      console.log(`[Deep Bug Analysis] Starting analysis with ${accumulatedCodeContexts.length} initial code contexts`);
      
      // Iterative analysis loop
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`[Deep Bug Analysis] Starting iteration ${iteration}/${MAX_ITERATIONS}`);
        
        let bugContextAnalysis: any;
        
        // Step 1: Determine what code context we need
        if (iteration === 1) {
          // First iteration: Analyze bug context needs from scratch
          bugContextAnalysis = await this.analyzeBugContextNeeds(
            bugDescription,
            conversationSummary,
            projectDetails,
            accumulatedCodeContexts,
            iteration,
            session
          );
        } else if (currentAnalysis?.additional_keywords && currentAnalysis?.search_description) {
          // Second iteration: Use keywords from previous analysis
          console.log(`[Deep Bug Analysis] Using additional keywords from previous analysis`);
          bugContextAnalysis = {
            new_code_context_necessary: true,
            extraction_query: currentAnalysis.search_description,
            filenameKeywords: currentAnalysis.additional_keywords.filenameKeywords || [],
            methodNameKeywords: currentAnalysis.additional_keywords.methodNameKeywords || [],
            codeKeywords: currentAnalysis.additional_keywords.codeKeywords || [],
            reasoning: "Using additional keywords provided by previous analysis"
          };
        } else {
          // Fallback: analyze again if no keywords provided
          bugContextAnalysis = await this.analyzeBugContextNeeds(
            bugDescription,
            conversationSummary,
            projectDetails,
            accumulatedCodeContexts,
            iteration,
            session
          );
        }
        
        console.log(`[Deep Bug Analysis] Bug context analysis result:`, {
          needsContext: bugContextAnalysis.new_code_context_necessary,
          reasoning: bugContextAnalysis.reasoning
        });
        
        // Step 2: Extract code if needed
        if (bugContextAnalysis.new_code_context_necessary && bugContextAnalysis.extraction_query) {
          try {
            console.log(`[Deep Bug Analysis] Extracting code with query: ${bugContextAnalysis.extraction_query.substring(0, 100)}...`);
            
            const extractionResult = await this.extractCodeTool.execute({
              query: bugContextAnalysis.extraction_query,
              filePathPattern: bugContextAnalysis.filePathPattern,
              projectId: session.metadata.projectId,
              sessionId: session.id,
              connectedCodebasePath: session.metadata.connectedCodebasePath,
              model: session.metadata.model,
              filenameKeywords: bugContextAnalysis.filenameKeywords || [],
              methodNameKeywords: bugContextAnalysis.methodNameKeywords || [],
              codeKeywords: bugContextAnalysis.codeKeywords || [],
            });
            
            if (extractionResult.success && extractionResult.result) {
              // Merge with accumulated contexts (don't overwrite)
              accumulatedCodeContexts = this.mergeCodeContexts(
                accumulatedCodeContexts,
                extractionResult.result as ExtractCodeToolResultPayload
              );
              console.log(`[Deep Bug Analysis] Code extracted successfully. Total contexts: ${accumulatedCodeContexts.length}`);
            } else {
              console.warn(`[Deep Bug Analysis] Code extraction failed: ${extractionResult.error}`);
            }
          } catch (extractError) {
            console.error('[Deep Bug Analysis] Error during code extraction:', extractError);
            this.telemetryService.captureError(extractError as Error, {
              service: 'SamuraiAgent',
              function: 'handleDeepBugAnalysis_extraction',
              iteration
            });
          }
        }
        
        // Step 3: Perform root cause analysis
        currentAnalysis = await this.performRootCauseAnalysis(
          bugDescription,
          conversationSummary,
          projectDetails,
          accumulatedCodeContexts,
          iteration,
          session
        );
        
        console.log(`[Deep Bug Analysis] Root cause analysis complete:`, {
          confidence: currentAnalysis.confidence,
          needsMoreContext: currentAnalysis.needs_more_context,
          iteration
        });
        
        // Step 4: Check if we need another iteration
        if (currentAnalysis.confidence >= 70 || !currentAnalysis.needs_more_context || iteration >= MAX_ITERATIONS) {
          console.log(`[Deep Bug Analysis] Stopping iterations. Confidence: ${currentAnalysis.confidence}, Needs more: ${currentAnalysis.needs_more_context}`);
          break;
        }
        
        console.log(`[Deep Bug Analysis] Low confidence (${currentAnalysis.confidence}), proceeding to iteration ${iteration + 1}`);
      }
      
      // Format and return the final response
      return this.formatBugAnalysisResponse(currentAnalysis, accumulatedCodeContexts, iteration);
      
    } catch (error) {
      console.error('Error in handleDeepBugAnalysis:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'handleDeepBugAnalysis' 
      });
      
      return "I encountered an error while analyzing the bug. Please try describing the issue again, and include any error messages or stack traces if available.";
    }
  }

  public async handleSpecClarification(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[],
    session: Session
  ): Promise<ISpecClarificationOutput> {
    this.logInvocation("handleSpecClarification", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Include current artifact in context if available
      let artifactContext = "";
      if (session.currentArtifact?.textSpec) {
        artifactContext = `\n\n## CURRENT SPECIFICATION ARTIFACT\n${session.currentArtifact.textSpec}\n`;
      }
      
      const conversationSummary = this._buildConversationSummary(chatHistory) + artifactContext + `\n\nLatest user request: ${userMessage.content}`;
      const basePrompt = await this._loadAndFormatSystemPrompt(
        'specClarification/system_prompt.md',
        {
          projectDetails,
          codeContexts: formattedCodeContexts,
          conversationSummary,
          activeTaskHeader: '',
          noActiveTaskInference: ''
        }
      );

      const structuredPrompt = `${basePrompt.trim()}

## OUTPUT FORMAT (CRITICAL - MUST FOLLOW EXACTLY)

You MUST respond with ONLY valid JSON. Do not include any explanatory text before or after the JSON.

Required structure:
{
  "clarification_text": "your clarification questions and analysis here",
  "score": 85
}

CRITICAL RULES:
- Start your response with { (opening brace)
- End your response with } (closing brace)  
- Do NOT add any conversational text before or after the JSON
- Do NOT wrap the JSON in markdown code fences
- The score MUST be a number between 0 and 100`;

      const messages: LLMMessage[] = [
        { role: "system", content: structuredPrompt },
        { role: "system", content: "CRITICAL: Your entire response must be ONLY the JSON object. Start with { and end with }. No other text allowed." },
        ...chatHistory,
        { role: "user", content: userMessage.content },
        { role: "user", content: "Please respond with ONLY the JSON object as specified in the system prompt. No conversational text." }
      ];

      // Call LLM service
      const response = await this.llmProviderService.chat({
        id: `spec-clarification-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages,
        metadata: {
          type: "spec_clarification"
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        maxTokens: 10000,
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Extract and return the content
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost from this LLM call
      this.trackLLMCost(llmResponse, 'handleSpecClarification');
      
      const responseContent = llmResponse.content?.trim() || "";
      
      // Log the full LLM response for debugging
      console.log('[Spec Clarification] Full LLM response:', {
        contentLength: responseContent.length,
        contentType: typeof responseContent,
        firstChars: responseContent.substring(0, 500),
        lastChars: responseContent.substring(Math.max(0, responseContent.length - 500)),
        fullResponse: responseContent.length < 3000 ? responseContent : 'Response too long, see first/last chars',
        hasJsonMarker: responseContent.includes('```json'),
        startsWithBrace: responseContent.trim().startsWith('{'),
        endsWithBrace: responseContent.trim().endsWith('}')
      });
      
      // Parse and validate the JSON response
      try {
        const parsedResult = extractJsonFromLLMResponse(
          responseContent
        );
        
        // Check if parsing was successful
        if (!parsedResult) {
          console.error('[Spec Clarification] Failed to parse LLM response:', {
            responseContentLength: responseContent.length,
            responsePreview: responseContent.substring(0, 1000),
            responseSuffix: responseContent.substring(Math.max(0, responseContent.length - 1000))
          });
          throw new Error('Failed to parse JSON from LLM response');
        }
        
        console.log('[Spec Clarification] Successfully parsed JSON:', {
          hasClarificationText: !!parsedResult.clarification_text,
          hasScore: parsedResult.score !== undefined && parsedResult.score !== null,
          scoreValue: parsedResult.score,
          scoreType: typeof parsedResult.score,
          parsedKeys: Object.keys(parsedResult)
        });
        
        // Validate score is in range 0-100
        if (typeof parsedResult.score !== 'number' || parsedResult.score < 0 || parsedResult.score > 100) {
          console.error('[Spec Clarification] Invalid score value:', {
            scoreValue: parsedResult.score,
            scoreType: typeof parsedResult.score,
            parsedResult: parsedResult
          });
          throw new Error(`Invalid score value: ${parsedResult.score}. Score must be between 0 and 100.`);
        }
        
        // Trigger artifact generation asynchronously (fire and forget)
        try {
          // Set status to generating
          await this.dataStore.updateSession(session.id, {
            currentArtifact: {
              mermaidData: '',
              textSpec: '',
              timestamp: Date.now(),
              generationStatus: 'generating'
            }
          });
          
          this.generateSpecArtifact(session, chatHistory, projectDetails, codeContexts)
            .then(async (artifact) => {
              // Update session with new artifact
              await this.dataStore.updateSession(session.id, {
                currentArtifact: {
                  ...artifact,
                  generationStatus: 'completed'
                }
              });
              console.log('Spec artifact generated and saved successfully');
            })
            .catch(async error => {
              console.error('Failed to generate artifact:', error);
              // Set status to failed
              await this.dataStore.updateSession(session.id, {
                currentArtifact: {
                  mermaidData: '',
                  textSpec: '',
                  timestamp: Date.now(),
                  generationStatus: 'failed'
                }
              });
            });
        } catch (error) {
          console.error('Error initiating artifact generation:', error);
        }
        
        return parsedResult;
      } catch (parseError) {
        // Log detailed parsing error with response content
        console.error('Error parsing spec clarification JSON:', {
          error: parseError,
          responseContentLength: responseContent.length,
          responsePreview: responseContent,
          responseSuffix: responseContent.substring(Math.max(0, responseContent.length - 200))
        });
        throw parseError;
      }
      
    } catch (error) {
      console.error('Error in handleSpecClarification:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'handleSpecClarification' 
      });
      
      // Return a fallback response with error indication
      return {
        clarification_text: "I'm here to help clarify your specifications! What would you like to specify?",
        score: 0
      };
    }
  }

  public async handleGeneratingSpecs(
    userMessage: ChatMessage, 
    codeContexts: ExtractCodeToolResultPayload[], 
    chatHistory: LLMMessage[], 
    projectDetails: string,
    session: Session
  ): Promise<AgentExecutionResult> {
    this.logInvocation("handleGeneratingSpecs", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Include current artifact in context if available
      let artifactContext = "";
      if (session.currentArtifact?.textSpec) {
        artifactContext = `\n\n## CURRENT SPECIFICATION ARTIFACT\n${session.currentArtifact.textSpec}\n`;
      }
      
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory) + artifactContext + `\n\nLatest user request: ${userMessage.content}`;
      
      // Load and format the system prompt
      const systemPrompt = await this._loadAndFormatSystemPrompt(
        'specGeneration/generate_spec_system_prompt.md',
        {
          projectDetails,
          codeContexts: formattedCodeContexts,
          conversationSummary,
          activeTaskHeader: '', // No active task for now
          noActiveTaskInference: '', // No active task inference for now
          currentUserMessage: userMessage.content,
          activeTaskId: '' // No active task ID for now
        }
      );
      
      // Construct messages array for LLM request
      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage.content }
      ];
      
      // Call LLM service
      const response = await this.llmProviderService.chat({
        id: `spec-generation-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages,
        metadata: {
          type: "spec_generation"
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        maxTokens: 20000,
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Extract and parse the LLM response
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost from this LLM call
      this.trackLLMCost(llmResponse, 'handleGeneratingSpecs');
      
      const responseContent = llmResponse.content?.trim() || "";
      
      // Log LLM response details for debugging
      console.log('LLM response details:', {
        hasContent: !!llmResponse.content,
        contentLength: llmResponse.content?.length || 0,
        contentPreview: responseContent.substring(0, 200),
        provider: (llmResponse as any).provider || 'unknown',
        model: (llmResponse as any).model || 'unknown'
      });
      
      // Check for empty response
      if (!responseContent) {
        throw new Error("LLM returned an empty response. This could be due to:\n" +
          "1. LLM service timeout or rate limiting\n" +
          "2. Invalid or overly complex prompt\n" +
          "3. LLM provider issues\n" +
          "Please try again or simplify your request.");
      }
      
      // Parse the JSON response containing specs
      let parsedSpecs: Array<{
        title: string;
        description: string;
        parent_spec_id?: string | null;
      }>;
      
      try {
        // Use specialized spec generation parser for better handling of markdown syntax
        const parsedResponse = extractJsonFromLLMResponse(responseContent, { isSpecGeneration: true });
        
        // Handle different response formats
        if (Array.isArray(parsedResponse)) {
          // Format 1: Direct array
          parsedSpecs = parsedResponse;
        } else if (parsedResponse && typeof parsedResponse === 'object') {
          // Format 2: Object with specs array (try common field names)
          if (Array.isArray(parsedResponse.specs)) {
            parsedSpecs = parsedResponse.specs;
          } else if (Array.isArray(parsedResponse.specifications)) {
            parsedSpecs = parsedResponse.specifications;
          } else if (Array.isArray(parsedResponse.items)) {
            parsedSpecs = parsedResponse.items;
          } else if (Array.isArray(parsedResponse.data)) {
            parsedSpecs = parsedResponse.data;
          } else {
            // Try to find any array field
            const arrayField = Object.values(parsedResponse).find(val => Array.isArray(val));
            if (arrayField) {
              parsedSpecs = arrayField as any[];
            } else {
              console.error('Parsed response object:', parsedResponse);
              throw new Error(`LLM response is an object but contains no array field. Available fields: ${Object.keys(parsedResponse).join(', ')}`);
            }
          }
        } else {
          throw new Error("LLM response is not an array of specs");
        }
      } catch (error) {
        const fallbackMessage = responseContent || 'No content received from LLM.';
        console.error('Error parsing spec generation response:', {
          error,
          responseLength: responseContent.length,
          responsePreview: fallbackMessage
        });
        
        // Provide more specific error messages based on the type of error
        let errorMessage = `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        if (responseContent.length === 0) {
          errorMessage = "LLM returned an empty response. This could be due to LLM service issues, timeouts, or rate limiting. Please try again.";
        } else if (responseContent.length < 10) {
          errorMessage = `LLM returned a very short response: "${responseContent}". This might indicate an error or incomplete response. Please try again.`;
        } else if (!responseContent.includes('{') && !responseContent.includes('[')) {
          errorMessage = `LLM response doesn't contain JSON format. Response: "${fallbackMessage}". Please ensure the LLM is configured to return JSON.`;
        }
        
        throw new Error(`${errorMessage}\nLLM output preview:\n${fallbackMessage}`);
      }
      
      if (!Array.isArray(parsedSpecs)) {
        console.error('parsedSpecs is not an array:', typeof parsedSpecs, parsedSpecs);
        throw new Error("LLM response is not an array of specs");
      }
      
      // Log what we got
      console.log(`handleGeneratingSpecs: Parsed ${parsedSpecs.length} specs from LLM response`);
      console.log(`handleGeneratingSpecs: Spec titles:`, parsedSpecs.map(s => s.title));
      
      // Validate that each spec has required fields
      for (const spec of parsedSpecs) {
        if (!spec || typeof spec !== 'object') {
          throw new Error(`Invalid spec structure: expected object but received ${JSON.stringify(spec)}`);
        }
        if (!spec.title || !spec.description) {
          throw new Error(`Invalid spec structure: missing title or description. Spec: ${JSON.stringify(spec)}`);
        }
      }
      
      // Ensure we have at least one spec
      if (parsedSpecs.length === 0) {
        throw new Error("No specs were generated from the LLM response");
      }
      
      // Create specs using CreateSpecTool
      const createdSpecs = [];
      const errors = [];
      let rootSpecId: string | null = null;
      
      // First, create the parent spec (first spec in the array)
      if (parsedSpecs.length > 0) {
        const parentSpecData = parsedSpecs[0];
        try {
          const createSpecResult = await this.createSpecTool.execute({
            title: parentSpecData.title,
            description: parentSpecData.description,
            parentSpecId: parentSpecData.parent_spec_id || undefined,
            depth: 1
          });
          
          if (createSpecResult.success && createSpecResult.result) {
            const createdSpec = createSpecResult.result as any;
            createdSpecs.push(createdSpec);
            rootSpecId = createdSpec.id;
            console.log(`Created parent spec: ${createdSpec.title} with ID: ${rootSpecId}`);
          } else {
            errors.push(`Failed to create parent spec "${parentSpecData.title}": ${createSpecResult.error}`);
          }
        } catch (error) {
          // Capture error to PostHog for monitoring
          this.telemetryService.captureError(error as Error, { 
            service: 'SamuraiAgent', 
            function: 'createParentSpec',
            specTitle: parentSpecData.title
          });
          
          errors.push(`Error creating parent spec "${parentSpecData.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Then, create child specs (remaining specs in the array)
      if (rootSpecId && parsedSpecs.length > 1) {
        for (let i = 1; i < parsedSpecs.length; i++) {
          const specData = parsedSpecs[i];
          try {
            // All remaining specs should be children of the root spec
            // Always use rootSpecId - ignore LLM's parent_spec_id which may be a title string
            const createSpecResult = await this.createSpecTool.execute({
              title: specData.title,
              description: specData.description,
              parentSpecId: rootSpecId,
              depth: 2
            });
            
            if (createSpecResult.success && createSpecResult.result) {
              const createdSpec = createSpecResult.result as any;
              createdSpecs.push(createdSpec);
              console.log(`Created child spec: ${createdSpec.title} with parent ID: ${rootSpecId}`);
            } else {
              errors.push(`Failed to create child spec "${specData.title}": ${createSpecResult.error}`);
            }
          } catch (error) {
            // Capture error to PostHog for monitoring
            this.telemetryService.captureError(error as Error, { 
              service: 'SamuraiAgent', 
              function: 'createChildSpec',
              specTitle: specData.title,
              parentSpecId: rootSpecId
            });
            
            errors.push(`Error creating child spec "${specData.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        // Update the parent spec to mark it as having subspecs
        if (createdSpecs.length > 1) {
          try {
            const parentSpec = createdSpecs[0];
            const updatedParentSpec = {
              ...parentSpec,
              hasSubspecs: true
            };
            
            const updateResult = this.dataStore.handleWebviewMessage({
              command: "saveSpec",
              payload: updatedParentSpec,
            });
            
            if (updateResult.type === "error") {
              console.warn(`Failed to update parent spec hasSubspecs: ${updateResult.error}`);
            } else {
              console.log(`Updated parent spec to mark it as having subspecs`);
            }
          } catch (error) {
            // Capture error to PostHog for monitoring
            this.telemetryService.captureError(error as Error, { 
              service: 'SamuraiAgent', 
              function: 'updateParentSpecHasSubspecs',
              parentSpecId: createdSpecs[0]?.id
            });
            
            console.warn(`Error updating parent spec hasSubspecs: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        // Verify and repair spec relationships to ensure integrity
        if (createdSpecs.length > 0) {
          await this.verifyAndRepairSpecRelationships(createdSpecs, rootSpecId);
        }
      }
      
      // Generate response message
      let responseMessage: string;
      if (createdSpecs.length > 0) {
        const parentSpec = createdSpecs[0];
        const childSpecs = createdSpecs.slice(1);
        
        responseMessage = `Perfect! I've generated and created ${createdSpecs.length} specs based on your request:\n\n`;
        responseMessage += `**Parent Spec:**\n1. ${parentSpec.title}\n\n`;
        
        if (childSpecs.length > 0) {
          responseMessage += `**Child Specs:**\n`;
          childSpecs.forEach((spec, index) => {
            responseMessage += `${index + 2}. ${spec.title}\n`;
          });
          responseMessage += `\nThe child specs are nested under the parent spec and can be expanded by clicking the "Show subspecs" button.`;
        }
        
        if (errors.length > 0) {
          responseMessage += `\n\nNote: ${errors.length} spec(s) could not be created due to errors.`;
        }
      } else {
        responseMessage = "I encountered issues creating the specs. Please try again or rephrase your request.";
        if (errors.length > 0) {
          responseMessage += `\nErrors: ${errors.join(', ')}`;
        }
      }
      
      return {
        success: createdSpecs.length > 0,
        message: responseMessage,
        metadata: {
          createdSpecsCount: createdSpecs.length,
          parentSpecId: rootSpecId,
          childSpecsCount: createdSpecs.length - 1,
          errorsCount: errors.length,
          errors: errors,
          specs: createdSpecs,
          specCreationDetails: {
            totalRequested: parsedSpecs.length,
            totalCreated: createdSpecs.length,
            parentSpec: createdSpecs[0] ? { id: createdSpecs[0].id, title: createdSpecs[0].title } : null,
            childSpecs: createdSpecs.slice(1).map(spec => ({ id: spec.id, title: spec.title, parentId: spec.parentSpecId }))
          }
        }
      };
      
    } catch (error) {
      console.error('Error in handleGeneratingSpecs:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'handleGeneratingSpecs' 
      });
      
      return {
        success: false,
        message: `Error generating specs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Verifies and repairs spec parent-child relationships after creation
   * Ensures the first spec is the parent and all others are children of it
   * 
   * @param createdSpecs - Array of specs that were just created
   * @param expectedParentId - The expected parent spec ID (from the first spec)
   */
  private async verifyAndRepairSpecRelationships(
    createdSpecs: any[],
    expectedParentId: string | null
  ): Promise<void> {
    if (!expectedParentId || createdSpecs.length === 0) {
      console.log('[Spec Verification] No specs to verify or no parent ID provided');
      return;
    }

    console.log(`[Spec Verification] Starting verification for ${createdSpecs.length} specs with expected parent ID: ${expectedParentId}`);
    
    try {
      // Load all specs from persistence to verify the saved state
      const loadResult = this.dataStore.handleWebviewMessage({
        command: "loadSpecs",
      });

      if (loadResult.type === "error" || !loadResult.payload) {
        console.warn('[Spec Verification] Failed to load specs for verification:', loadResult.error);
        return;
      }

      const allSpecs = loadResult.payload as any[];
      const createdSpecIds = new Set(createdSpecs.map(s => s.id));
      const specsToVerify = allSpecs.filter(s => createdSpecIds.has(s.id));

      console.log(`[Spec Verification] Loaded ${specsToVerify.length} specs from persistence for verification`);

      let fixedCount = 0;
      let issues: string[] = [];

      // Verify parent spec (first spec)
      const parentSpec = specsToVerify.find(s => s.id === expectedParentId);
      if (parentSpec) {
        let parentNeedsUpdate = false;
        const parentUpdates: any = { ...parentSpec };

        // Check parent properties
        if (parentSpec.depth !== 1) {
          issues.push(`Parent spec depth is ${parentSpec.depth}, expected 1`);
          parentUpdates.depth = 1;
          parentNeedsUpdate = true;
        }
        if (parentSpec.parentSpecId !== null) {
          issues.push(`Parent spec has parentSpecId: ${parentSpec.parentSpecId}, expected null`);
          parentUpdates.parentSpecId = null;
          parentNeedsUpdate = true;
        }
        
        // Check if parent should have hasSubspecs flag
        const hasChildren = specsToVerify.some(s => s.id !== expectedParentId);
        if (hasChildren && !parentSpec.hasSubspecs) {
          issues.push(`Parent spec hasSubspecs is false, but has ${specsToVerify.length - 1} children`);
          parentUpdates.hasSubspecs = true;
          parentNeedsUpdate = true;
        }

        if (parentNeedsUpdate) {
          console.log(`[Spec Verification] Fixing parent spec: ${parentSpec.title}`);
          const updateResult = this.dataStore.handleWebviewMessage({
            command: "saveSpec",
            payload: parentUpdates,
          });
          
          if (updateResult.type === "success") {
            fixedCount++;
          } else {
            console.warn(`[Spec Verification] Failed to fix parent spec:`, updateResult.error);
          }
        }
      } else {
        console.warn(`[Spec Verification] Parent spec with ID ${expectedParentId} not found in loaded specs`);
      }

      // Verify child specs
      for (const spec of specsToVerify) {
        if (spec.id === expectedParentId) {
          continue; // Skip parent, already checked
        }

        let childNeedsUpdate = false;
        const childUpdates: any = { ...spec };

        // Check child properties
        if (spec.depth !== 2) {
          issues.push(`Child spec "${spec.title}" depth is ${spec.depth}, expected 2`);
          childUpdates.depth = 2;
          childNeedsUpdate = true;
        }
        if (spec.parentSpecId !== expectedParentId) {
          issues.push(`Child spec "${spec.title}" has parentSpecId: ${spec.parentSpecId}, expected ${expectedParentId}`);
          childUpdates.parentSpecId = expectedParentId;
          childNeedsUpdate = true;
        }

        if (childNeedsUpdate) {
          console.log(`[Spec Verification] Fixing child spec: ${spec.title}`);
          const updateResult = this.dataStore.handleWebviewMessage({
            command: "saveSpec",
            payload: childUpdates,
          });
          
          if (updateResult.type === "success") {
            fixedCount++;
          } else {
            console.warn(`[Spec Verification] Failed to fix child spec:`, updateResult.error);
          }
        }
      }

      // Log results
      if (issues.length > 0) {
        console.log(`[Spec Verification] Found ${issues.length} issue(s):`);
        issues.forEach(issue => console.log(`  - ${issue}`));
        console.log(`[Spec Verification] Fixed ${fixedCount} spec(s)`);
      } else {
        console.log(`[Spec Verification] ✓ All specs have correct relationships`);
      }

    } catch (error) {
      console.error('[Spec Verification] Error during verification:', error);
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'verifyAndRepairSpecRelationships',
        expectedParentId
      });
    }
  }

  public async generateSpecArtifact(
    session: Session,
    chatHistory: LLMMessage[],
    projectDetails: string,
    codeContexts: ExtractCodeToolResultPayload[]
  ): Promise<{ mermaidData: string; textSpec: string; timestamp: number }> {
    this.logInvocation("generateSpecArtifact", "Generating spec artifact");
    
    try {
      // Format contexts
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
      // Load artifact generation prompt
      const systemPrompt = await this._loadAndFormatSystemPrompt(
        'specArtifact/system_prompt.md',
        {
          projectDetails,
          codeContexts: formattedCodeContexts,
          conversationSummary,
        }
      );
      
      // Call LLM
      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the architecture artifact based on our conversation." }
      ];
      
      const response = await this.llmProviderService.chat({
        id: `artifact-generation-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages,
        metadata: { type: "artifact_generation" },
        createdAt: new Date(),
        updatedAt: new Date(),
        maxTokens: 8000,
      });
      
      console.log('[Artifact Generation] LLM response received:', {
        responseType: response.type,
        hasPayload: !!response.payload,
        responseKeys: response ? Object.keys(response) : []
      });
      
      if (response.type === "error" || !response.payload) {
        console.error('[Artifact Generation] Error response:', {
          type: response.type,
          error: response.error,
          fullResponse: JSON.stringify(response, null, 2)
        });
        throw new Error(response.error || "LLM request failed");
      }
      
      // Parse response
      const llmResponse = response.payload;
      console.log('[Artifact Generation] LLM payload structure:', {
        isNull: llmResponse === null,
        isUndefined: llmResponse === undefined,
        type: typeof llmResponse,
        hasError: 'error' in llmResponse,
        keys: llmResponse ? Object.keys(llmResponse) : [],
        hasContent: 'content' in llmResponse,
        contentType: llmResponse && 'content' in llmResponse ? typeof llmResponse.content : 'N/A'
      });
      
      if (!llmResponse || 'error' in llmResponse) {
        console.error('[Artifact Generation] Invalid LLM response payload:', {
          llmResponse: llmResponse ? JSON.stringify(llmResponse, null, 2).substring(0, 500) : 'null/undefined'
        });
        throw new Error("Invalid LLM response");
      }
      
      // Log the raw content before parsing
      const rawContent = llmResponse.content || "";
      console.log('[Artifact Generation] Raw LLM content:', {
        contentLength: rawContent.length,
        contentType: typeof rawContent,
        isString: typeof rawContent === 'string',
        firstChars: typeof rawContent === 'string' ? rawContent.substring(0, 200) : 'NOT A STRING',
        lastChars: typeof rawContent === 'string' ? rawContent.substring(Math.max(0, rawContent.length - 200)) : 'NOT A STRING',
        fullContentPreview: typeof rawContent === 'string' && rawContent.length < 1000 ? rawContent : 'Content too long or not a string'
      });
      
      const artifactData = extractJsonFromLLMResponse(rawContent);
      
      console.log('[Artifact Generation] Parsed artifact data:', {
        isNull: artifactData === null,
        isUndefined: artifactData === undefined,
        type: typeof artifactData,
        keys: artifactData ? Object.keys(artifactData) : [],
        hasMermaidData: artifactData && 'mermaidData' in artifactData,
        hasTextSpec: artifactData && 'textSpec' in artifactData,
        mermaidDataType: artifactData?.mermaidData ? typeof artifactData.mermaidData : 'N/A',
        textSpecType: artifactData?.textSpec ? typeof artifactData.textSpec : 'N/A',
        mermaidDataLength: artifactData?.mermaidData ? artifactData.mermaidData.length : 0,
        textSpecLength: artifactData?.textSpec ? artifactData.textSpec.length : 0
      });
      
      if (!artifactData || !artifactData.mermaidData || !artifactData.textSpec) {
        console.error('[Artifact Generation] Invalid artifact data structure:', {
          artifactData: artifactData ? JSON.stringify(artifactData, null, 2).substring(0, 500) : 'null/undefined',
          hasMermaidData: !!artifactData?.mermaidData,
          hasTextSpec: !!artifactData?.textSpec,
          fullArtifactData: artifactData
        });
        throw new Error("Invalid artifact data structure");
      }
      
      console.log('[Artifact Generation] ✓ Successfully generated artifact:', {
        mermaidDataLength: artifactData.mermaidData.length,
        textSpecLength: artifactData.textSpec.length,
        timestamp: Date.now()
      });
      
      return {
        mermaidData: artifactData.mermaidData,
        textSpec: artifactData.textSpec,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Artifact Generation] ✗ Error generating spec artifact:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
      throw error;
    }
  }

  private async performLLMIntentAnalysis(
    chatHistory: LLMMessage[], 
    currentUserMessage: ChatMessage, 
    projectDetails: string,
    session: Session
  ): Promise<UserIntentEnum> {
    try {
      // Build the intent analysis prompt based on the backend implementation
      const intentSystemPrompt = this.buildIntentAnalysisPrompt(projectDetails);
      
      // Prepare messages for LLM call
      // Include chat history for context, then add the current user message
      const messages: LLMMessage[] = [
        { role: "system", content: intentSystemPrompt },
        ...chatHistory, // Spread chat history to provide conversation context
        { role: "user", content: currentUserMessage.content }
      ];
      
      // Call LLM service with parameters optimized for concise responses
      const response = await this.llmProviderService.chat({
        id: `intent-analysis-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages,
        metadata: {
          type: "intent_analysis"
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        // Add parameters to encourage concise responses
        temperature: 0.1, // Lower temperature for more deterministic, concise responses
        maxTokens: 10 // Limit to prevent verbose responses (intent should be 1 word)
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Parse the LLM response
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost from this LLM call
      this.trackLLMCost(llmResponse, 'performLLMIntentAnalysis');
      
      const intentResponse = llmResponse.content?.trim().toLowerCase() || "";
      
      // Map the response to UserIntentEnum
      return this.parseIntentResponse(intentResponse);
      
    } catch (error) {
      console.error('Error in LLM intent analysis:', error);
      
      // Capture error to PostHog for monitoring
      this.telemetryService.captureError(error as Error, { 
        service: 'SamuraiAgent', 
        function: 'performLLMIntentAnalysis' 
      });
      
      // Default to pure_discussion if analysis fails
      return UserIntentEnum.PURE_DISCUSSION;
    }
  }
  
  private buildIntentAnalysisPrompt(projectDetails: string): string {
    const promptTemplate = this.readPromptFile('intentAnalysis.md');
    return promptTemplate
      .replace('{projectDetails}', projectDetails || 'No project details available')
      .replace('{currentUserMessage}', '{currentUserMessage}');
  }

  private readPromptFile(fileName: string): string {
    // Use the same prompt loading logic as CodeParserService
    // Try multiple possible locations for prompt files
    const candidates = [
      // In packaged extensions, __dirname points to the dist directory
      // Check the extension's dist/prompts directory first (for packaged extensions)
      path.join(__dirname, '..', '..', 'dist', 'prompts', fileName),
      
      // Check extension's out/prompts directory (for development)
      path.join(__dirname, '..', '..', 'out', 'prompts', fileName),
      
      // Check extension's src/agent/prompts directory (for development)
      path.join(__dirname, '..', '..', 'src', 'agent', 'prompts', fileName),
      
      // Legacy fallback paths
      path.join(__dirname, 'prompts', fileName),
      path.join(__dirname, '..', 'prompts', fileName),
      path.join(__dirname, '..', '..', 'prompts', fileName),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        console.log(`SamuraiAgent: Found prompt file at: ${candidate}`);
        return fs.readFileSync(candidate, 'utf-8');
      }
    }

    console.error(`SamuraiAgent: Prompt file not found for ${fileName}`);
    console.error(`__dirname: ${__dirname}`);
    console.error(`Checked paths:`, candidates);
    throw new Error(
      `Prompt file not found for ${fileName}. Checked paths: ${candidates.join(', ')}`
    );
  }
  
  private parseIntentResponse(intentResponse: string): UserIntentEnum {
    const normalized = intentResponse.trim().toLowerCase();
    
    // Map possible variations to standard intents
    const intentMapping: Record<string, UserIntentEnum> = {
      "pure_discussion": UserIntentEnum.PURE_DISCUSSION,
      "pure discussion": UserIntentEnum.PURE_DISCUSSION,
      "discussion": UserIntentEnum.PURE_DISCUSSION,
      "question": UserIntentEnum.PURE_DISCUSSION,
      
      "feature_exploration": UserIntentEnum.FEATURE_EXPLORATION,
      "feature exploration": UserIntentEnum.FEATURE_EXPLORATION,
      "exploration": UserIntentEnum.FEATURE_EXPLORATION,
      
      "spec_clarification": UserIntentEnum.SPEC_CLARIFICATION,
      "spec clarification": UserIntentEnum.SPEC_CLARIFICATION,
      "clarification": UserIntentEnum.SPEC_CLARIFICATION
    };
    
    // Try exact match first
    if (intentMapping[normalized]) {
      return intentMapping[normalized];
    }
    
    // NEW: Try regex extraction for verbose responses
    const intentRegex = /\b(pure_discussion|feature_exploration|spec_clarification)\b/;
    const match = normalized.match(intentRegex);
    
    if (match) {
      console.warn(`Intent parser: Had to extract intent from verbose response. Original: "${intentResponse.substring(0, 100)}${intentResponse.length > 100 ? '...' : ''}"`);
      return intentMapping[match[1]];
    }
    
    // Try partial matching
    for (const [key, value] of Object.entries(intentMapping)) {
      if (normalized.includes(key)) {
        console.warn(`Intent parser: Used partial matching for "${key}" from verbose response`);
        return value;
      }
    }
    
    // Enhanced error with truncated preview
    const preview = intentResponse.length > 100 
      ? intentResponse.substring(0, 100) + "..." 
      : intentResponse;
    throw new Error(`Unable to parse intent from LLM response: "${preview}". Expected one of: pure_discussion, feature_exploration, spec_clarification`);
  }

  /**
   * Formats existing code context into a Markdown string suitable for LLM prompts
   * @param codeContexts - Array of ExtractCodeToolResultPayload objects
   * @returns Formatted Markdown string with file paths as headers and elements as bullet points
   */
  private _formatExistingCodeContextForLLM(codeContexts: ExtractCodeToolResultPayload[]): string {
    if (!codeContexts || codeContexts.length === 0) {
      return "No existing code context available.";
    }

    const formattedSections: string[] = [];

    for (const context of codeContexts) {
      if (!context.relevantCodeElements || context.relevantCodeElements.length === 0) {
        continue;
      }

      for (const codeElement of context.relevantCodeElements) {
        const filePath = codeElement.path;
        const elements = codeElement.elements;

        if (!elements || elements.length === 0) {
          continue;
        }

        // Add file path as header
        formattedSections.push(`## ${filePath}`);

        // Add elements as bullet points
        for (const element of elements) {
          formattedSections.push(`* ${element.type}: ${element.name}`);
        }

        // Add snippet if available
        if (codeElement.snippet) {
          formattedSections.push(`\n\`\`\`\n${codeElement.snippet}\n\`\`\`\n`);
        }
      }
    }

    return formattedSections.length > 0 
      ? formattedSections.join('\n') 
      : "No relevant code elements found in existing context.";
  }

  /**
   * Builds a conversation summary from chat history for LLM prompts
   * @param chatHistory - Array of LLMMessage objects
   * @returns Formatted conversation summary string
   */
  private _buildConversationSummary(chatHistory: LLMMessage[]): string {
    if (chatHistory.length === 0) {
        return "No conversation history available.";
    }

    const recentMessages = chatHistory.slice(-8);
    const formatted = recentMessages.map((message, index) => {
        return `${index + 1}. (${message.role.toUpperCase()}) ${message.content}`;
    });

    return formatted.join('\n');
  }

  /**
   * Loads and formats a system prompt from a file with dynamic variable injection
   * @param promptFilePath - Relative path to the prompt file (e.g., 'pureDiscussion/system_prompt.md')
   * @param variables - Object containing variables to inject into the prompt
   * @returns Formatted system prompt string
   */
  private async _loadAndFormatSystemPrompt(
    promptFilePath: string, 
    variables: { 
      projectDetails: string, 
      codeContexts: string,
      conversationSummary: string,
      activeTaskHeader?: string,
      noActiveTaskInference?: string,
      currentUserMessage?: string,
      activeTaskId?: string
    }
  ): Promise<string> {
    try {
      const promptTemplate = this.readPromptFile(promptFilePath);
      
      // Replace placeholders with provided variables
      return promptTemplate
        .replace('{projectDetails}', variables.projectDetails || 'No project details available')
        .replace('{codeContexts}', variables.codeContexts || 'No code context available')
        .replace('{conversationSummary}', variables.conversationSummary || 'No conversation history available')
        .replace('{activeTaskHeader}', variables.activeTaskHeader || '')
        .replace('{noActiveTaskInference}', variables.noActiveTaskInference || '')
        .replace('{currentUserMessage}', variables.currentUserMessage || '')
        .replace('{activeTaskId}', variables.activeTaskId || '');
    } catch (error) {
      throw new Error(`Failed to load prompt file ${promptFilePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Formats code contexts into a string suitable for prompt injection
   * @param codeContexts - Array of ExtractCodeToolResultPayload objects
   * @returns Formatted string of code snippets with file headers
   */
  private _formatCodeContextsForPrompt(codeContexts: ExtractCodeToolResultPayload[]): string {
    if (!codeContexts || codeContexts.length === 0) {
      return "No code context available.";
    }

    const formattedSections: string[] = [];

    for (const context of codeContexts) {
      if (!context.relevantCodeElements || context.relevantCodeElements.length === 0) {
        continue;
      }

      for (const codeElement of context.relevantCodeElements) {
        const filePath = codeElement.path;
        const elements = codeElement.elements;

        if (!elements || elements.length === 0) {
          continue;
        }

        // Add file path as header
        formattedSections.push(`// File: ${filePath}`);

        // Add elements with type and name comments
        for (const element of elements) {
          formattedSections.push(`// [${element.type}]: ${element.name}`);
        }

        // Add snippet if available
        if (codeElement.snippet) {
          formattedSections.push(`\n${codeElement.snippet}\n`);
        }
      }
    }

    return formattedSections.length > 0 
      ? formattedSections.join('\n') 
      : "No relevant code elements found in context.";
  }

  /**
   * Analyzes what code context is needed to debug a bug
   * @param bugDescription - Description of the bug from user message
   * @param conversationSummary - Summary of conversation history
   * @param projectDetails - Project details context
   * @param existingCodeContexts - Currently loaded code contexts
   * @param iteration - Current iteration number
   * @param session - Current session
   * @returns Analysis result with extraction query and keywords
   */
  private async analyzeBugContextNeeds(
    bugDescription: string,
    conversationSummary: string,
    projectDetails: string,
    existingCodeContexts: ExtractCodeToolResultPayload[],
    iteration: number,
    session: Session
  ): Promise<{
    new_code_context_necessary: boolean;
    extraction_query: string | null;
    filePathPattern?: string;
    filenameKeywords?: string[];
    methodNameKeywords?: string[];
    codeKeywords?: string[];
    reasoning: string;
  }> {
    this.logInvocation("analyzeBugContextNeeds", `Iteration ${iteration}`);
    
    try {
      // Format existing code contexts
      const formattedExistingContext = this._formatExistingCodeContextForLLM(existingCodeContexts);
      
      // Load and populate the prompt template
      const promptTemplate = this.readPromptFile('bugAnalysis/analyze_bug_context_needs.md');
      const populatedPrompt = promptTemplate
        .replace('{bugDescription}', bugDescription)
        .replace('{conversationSummary}', conversationSummary)
        .replace('{projectDetails}', projectDetails || 'No project details available')
        .replace('{existingCodeContext}', formattedExistingContext)
        .replace('{iteration}', iteration.toString());
      
      // Make LLM call
      const response = await this.llmProviderService.chat({
        id: `bug-context-analysis-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages: [
          { role: "system", content: populatedPrompt }
        ],
        metadata: {
          type: "bug_context_analysis"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost
      this.trackLLMCost(llmResponse, 'analyzeBugContextNeeds');
      
      const responseContent = llmResponse.content?.trim() || "";
      const parsedResult = extractJsonFromLLMResponse(responseContent);
      
      if (!parsedResult || typeof parsedResult !== 'object') {
        throw new Error(`Failed to parse JSON from LLM response`);
      }
      
      return {
        new_code_context_necessary: parsedResult.new_code_context_necessary || false,
        extraction_query: parsedResult.extraction_query || null,
        filePathPattern: parsedResult.filePathPattern,
        filenameKeywords: parsedResult.filenameKeywords || [],
        methodNameKeywords: parsedResult.methodNameKeywords || [],
        codeKeywords: parsedResult.codeKeywords || [],
        reasoning: parsedResult.reasoning || "No reasoning provided"
      };
      
    } catch (error) {
      console.error('Error in analyzeBugContextNeeds:', error);
      this.telemetryService.captureError(error as Error, {
        service: 'SamuraiAgent',
        function: 'analyzeBugContextNeeds',
        iteration
      });
      
      // Return safe defaults
      return {
        new_code_context_necessary: false,
        extraction_query: null,
        reasoning: `Error analyzing bug context: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Performs root cause analysis on the bug with available code context
   * @param bugDescription - Description of the bug
   * @param conversationSummary - Summary of conversation
   * @param projectDetails - Project details
   * @param codeContexts - Available code contexts
   * @param iteration - Current iteration number
   * @param session - Current session
   * @returns Analysis result with confidence, root cause, and solutions
   */
  private async performRootCauseAnalysis(
    bugDescription: string,
    conversationSummary: string,
    projectDetails: string,
    codeContexts: ExtractCodeToolResultPayload[],
    iteration: number,
    session: Session
  ): Promise<{
    analysis_report: string;
    confidence: number;
    root_cause: string;
    proposed_solutions: string[];
    needs_more_context: boolean;
    additional_keywords?: {
      filenameKeywords: string[];
      methodNameKeywords: string[];
      codeKeywords: string[];
    };
    search_description?: string;
  }> {
    this.logInvocation("performRootCauseAnalysis", `Iteration ${iteration}`);
    
    try {
      // Format code contexts
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Load and populate the prompt template
      const promptTemplate = this.readPromptFile('bugAnalysis/root_cause_analysis.md');
      const populatedPrompt = promptTemplate
        .replace('{bugDescription}', bugDescription)
        .replace('{conversationSummary}', conversationSummary)
        .replace('{projectDetails}', projectDetails || 'No project details available')
        .replace('{codeContext}', formattedCodeContexts)
        .replace('{iteration}', iteration.toString());
      
      // Make LLM call
      const response = await this.llmProviderService.chat({
        id: `root-cause-analysis-${Date.now()}`,
        provider: "auto",
        model: session.metadata.model || "",
        messages: [
          { role: "system", content: populatedPrompt }
        ],
        metadata: {
          type: "root_cause_analysis"
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        maxTokens: 20000
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      // Track cost
      this.trackLLMCost(llmResponse, 'performRootCauseAnalysis');
      
      const responseContent = llmResponse.content?.trim() || "";
      console.log('[performRootCauseAnalysis] Received LLM response:', {
        contentLength: responseContent.length,
        provider: llmResponse.provider,
        model: llmResponse.model,
        contentPreview: responseContent.substring(0, 200) + (responseContent.length > 200 ? '...' : ''),
        contentEnd: responseContent.length > 200 ? '...' + responseContent.substring(responseContent.length - 200) : ''
      });
      
      const parsedResult = extractJsonFromLLMResponse(responseContent);
      
      if (!parsedResult || typeof parsedResult !== 'object') {
        console.error('[performRootCauseAnalysis] Failed to parse JSON from LLM response:', {
          parsedResultType: typeof parsedResult,
          parsedResult,
          responseLength: responseContent.length,
          responsePreview: responseContent.substring(0, 500),
          responseEnd: responseContent.substring(Math.max(0, responseContent.length - 500))
        });
        throw new Error(`Failed to parse JSON from LLM response - received ${typeof parsedResult}, expected object`);
      }
      
      console.log('[performRootCauseAnalysis] Successfully parsed JSON:', {
        hasAnalysisReport: !!parsedResult.analysis_report,
        hasConfidence: typeof parsedResult.confidence === 'number',
        confidence: parsedResult.confidence,
        hasRootCause: !!parsedResult.root_cause,
        hasSolutions: Array.isArray(parsedResult.proposed_solutions),
        solutionsCount: Array.isArray(parsedResult.proposed_solutions) ? parsedResult.proposed_solutions.length : 0,
        needsMoreContext: parsedResult.needs_more_context,
        keys: Object.keys(parsedResult)
      });
      
      // Normalize proposed_solutions to ensure they're all strings
      let normalizedSolutions: string[] = [];
      if (Array.isArray(parsedResult.proposed_solutions)) {
        normalizedSolutions = parsedResult.proposed_solutions
          .map((sol: any) => {
            // If it's already a string, use it
            if (typeof sol === 'string') {
              return sol.trim();
            }
            // If it's an object, try to extract meaningful text
            if (typeof sol === 'object' && sol !== null) {
              // Try common object fields
              if (sol.solution) return String(sol.solution).trim();
              if (sol.description) return String(sol.description).trim();
              if (sol.text) return String(sol.text).trim();
              // If none found, JSON stringify as last resort
              console.warn('[performRootCauseAnalysis] Proposed solution is an object (not a string):', sol);
              return JSON.stringify(sol);
            }
            // For any other type, convert to string
            return String(sol).trim();
          })
          .filter((sol: string) => sol.length > 0); // Remove empty strings
      }
      
      // If we ended up with no solutions, provide a default one
      if (normalizedSolutions.length === 0) {
        normalizedSolutions = ["Please provide more details about the bug, including error messages, stack traces, or specific symptoms you're experiencing. This will help identify the root cause and propose specific solutions."];
      }
      
      // Validate and return structured result
      return {
        analysis_report: parsedResult.analysis_report || "Analysis could not be completed.",
        confidence: typeof parsedResult.confidence === 'number' ? parsedResult.confidence : 50,
        root_cause: parsedResult.root_cause || "Root cause could not be determined.",
        proposed_solutions: normalizedSolutions,
        needs_more_context: parsedResult.needs_more_context === true && iteration < 2,
        additional_keywords: parsedResult.additional_keywords,
        search_description: parsedResult.search_description
      };
      
    } catch (error) {
      console.error('[performRootCauseAnalysis] Error in performRootCauseAnalysis:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        iteration
      });
      this.telemetryService.captureError(error as Error, {
        service: 'SamuraiAgent',
        function: 'performRootCauseAnalysis',
        iteration
      });
      
      // Return fallback analysis
      return {
        analysis_report: `I encountered an error while analyzing the bug: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        root_cause: "Unable to determine root cause due to analysis error.",
        proposed_solutions: ["Please provide more details about the bug, including error messages and stack traces."],
        needs_more_context: false
      };
    }
  }

  /**
   * Merges new code contexts with existing ones, avoiding duplicates
   * @param existing - Existing code contexts
   * @param newContext - New code context to merge
   * @returns Merged array of code contexts
   */
  private mergeCodeContexts(
    existing: ExtractCodeToolResultPayload[],
    newContext: ExtractCodeToolResultPayload
  ): ExtractCodeToolResultPayload[] {
    // If no existing contexts, just return the new one in an array
    if (existing.length === 0) {
      return [newContext];
    }
    
    // Create a map of existing file paths for quick lookup
    const existingPaths = new Set<string>();
    for (const context of existing) {
      for (const element of context.relevantCodeElements || []) {
        existingPaths.add(element.path);
      }
    }
    
    // Filter out new elements that are already in existing contexts
    const uniqueNewElements = (newContext.relevantCodeElements || []).filter(
      element => !existingPaths.has(element.path)
    );
    
    // If no new unique elements, just return existing
    if (uniqueNewElements.length === 0) {
      console.log('[mergeCodeContexts] No new unique elements found');
      return existing;
    }
    
    // Create a merged context with unique elements
    const mergedContext: ExtractCodeToolResultPayload = {
      relevantCodeElements: uniqueNewElements,
      files: uniqueNewElements.map(element => ({
        path: element.path,
        snippet: element.snippet
      }))
    } as ExtractCodeToolResultPayload;
    
    console.log(`[mergeCodeContexts] Added ${uniqueNewElements.length} new unique elements`);
    return [...existing, mergedContext];
  }

  /**
   * Formats the bug analysis response for display
   * @param analysis - Analysis result from performRootCauseAnalysis
   * @param codeContexts - Code contexts that were analyzed
   * @param iterations - Number of iterations performed
   * @returns Formatted markdown response
   */
  private formatBugAnalysisResponse(
    analysis: {
      analysis_report: string;
      confidence: number;
      root_cause: string;
      proposed_solutions: string[];
    },
    codeContexts: ExtractCodeToolResultPayload[],
    iterations: number
  ): string {
    // Determine confidence emoji
    let confidenceEmoji = '🔴'; // Low
    if (analysis.confidence >= 70) {
      confidenceEmoji = '🟢'; // High
    } else if (analysis.confidence >= 40) {
      confidenceEmoji = '🟡'; // Medium
    }
    
    // Build file list
    const filesList: string[] = [];
    for (const context of codeContexts) {
      for (const element of context.relevantCodeElements || []) {
        const elementCount = element.elements?.length || 0;
        filesList.push(`- ${element.path} (${elementCount} element${elementCount !== 1 ? 's' : ''})`);
      }
    }
    
    const filesAnalyzed = filesList.length > 0 
      ? filesList.join('\n')
      : '- No files analyzed';
    
    // Format solutions with defensive handling
    let solutionsFormatted: string;
    if (analysis.proposed_solutions && analysis.proposed_solutions.length > 0) {
      // Ensure all solutions are strings and format them
      solutionsFormatted = analysis.proposed_solutions
        .map((sol, idx) => {
          // Extra defensive check - convert to string if somehow not a string
          const solutionText = typeof sol === 'string' ? sol : String(sol);
          return `${idx + 1}. ${solutionText}`;
        })
        .join('\n\n'); // Use double newline for better readability
    } else {
      // Default fallback - but this should rarely happen now
      solutionsFormatted = '1. No specific solutions available. Please provide more details about the bug.';
    }
    
    // Build the response with conditional sections
    let response = `🔍 **Deep Bug Analysis Complete** (Iteration ${iterations}, Confidence: ${analysis.confidence}% ${confidenceEmoji})

${analysis.analysis_report}`;

    // Only include Root Cause section if we have meaningful content
    if (analysis.root_cause && analysis.root_cause !== "Root cause could not be determined.") {
      response += `

**Root Cause:**
${analysis.root_cause}`;
    }

    // Only include Proposed Solutions section if we have meaningful solutions
    // Skip the default "no solutions available" message to avoid redundancy
    if (analysis.proposed_solutions && analysis.proposed_solutions.length > 0) {
      const hasDefaultMessage = analysis.proposed_solutions.length === 1 && 
        (analysis.proposed_solutions[0].includes('No specific solutions available') ||
         analysis.proposed_solutions[0].includes('Please provide more details'));
      
      if (!hasDefaultMessage) {
        response += `

**Proposed Solutions:**
${solutionsFormatted}`;
      }
    }

    // Include files analyzed
    response += `

**Files Analyzed:**
${filesAnalyzed}`;

    return response;
  }

  private logInvocation(methodName: string, message: string): void {
    console.log(`SamuraiAgent.${methodName} invoked with message:`, message);
  }
  
  /**
   * Track cost from an LLM response
   */
  private trackLLMCost(llmResponse: any, methodName: string): void {
    if (llmResponse?.cost && typeof llmResponse.cost === 'number') {
      this.currentExecutionCost += llmResponse.cost;
      console.log(`[COST DEBUG] ${methodName} - Added cost:`, llmResponse.cost, 'Total:', this.currentExecutionCost);
    } else {
      console.log(`[COST DEBUG] ${methodName} - No cost in LLM response`);
    }
  }
}

