import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { LLMProviderService } from "../llm/llmProviderService";
import { ProjectDetailService } from "../memory/projectDetailService";
import { DataStore } from "../../persistence/dataStore";
import { ChatMessage, Session, UserIntentEnum } from "../../common/models/chat-models";
import { AgentExecutionResult } from "../models/agent-models";
import { LLMMessage } from "../../common/models/llm-models";
import { ExtractCodeToolResultPayload } from "../../common/models/tool-models";
import { parseAndValidateLlmJson } from "../../common/utils/llmResponseParser";
import { ExtractCodeTool } from "../tools/extractCodeTool";
import { CreateSpecTool } from "../tools/createSpecTool";

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
  constructor(
    private readonly llmProviderService: LLMProviderService,
    private readonly dataStore: DataStore,
    private readonly projectDetailService: ProjectDetailService,
    private readonly extractCodeTool: ExtractCodeTool,
    private readonly createSpecTool: CreateSpecTool
  ) {}

  /**
   * Main entry point for agent operations
   * Orchestrates the processing of user messages within a given session
   */
  public async execute(userMessage: ChatMessage, session: Session): Promise<AgentExecutionResult> {
    this.logInvocation("execute", userMessage.content);
    
    try {
      // Load chat session history
      const chatMessages = this.dataStore.loadChatMessagesForSession(session.id);
      const chatHistory: LLMMessage[] = chatMessages.map((msg: ChatMessage) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }));
      
      // Load project detail memory
      const projectDetails = await this.projectDetailService.getProjectDetails(session.metadata.projectId) || "";
      
      // Load code context if available
      let initialCodeContexts: any[] = [];
      if (session.codeContextIds && session.codeContextIds.length > 0) {
        initialCodeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
      }
      
      // Analyze user intent with loaded context
      const userIntent = await this.analyzeUserIntent(chatHistory, userMessage, projectDetails);
      
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
        try {
          // Execute code extraction with parameters from analysis result
          const extractionResult = await this.extractCodeTool.execute({
            query: codeExtractionAnalysisResult.extraction_query,
            filePathPattern: undefined, // Could be added to analysis result in the future
            projectId: session.metadata.projectId,
            sessionId: session.id,
            connectedCodebasePath: session.metadata.connectedCodebasePath
          });

          if (extractionResult.success && extractionResult.result) {
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
          }
        } catch (error) {
          console.error('Error in code extraction:', error);
          this.logInvocation("extractCodeTool.execute", `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Load code contexts for the session
      let codeContexts: ExtractCodeToolResultPayload[] = [];
      if (session.codeContextIds && session.codeContextIds.length > 0) {
        codeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
      }
      
      // Dispatch to appropriate handler based on user intent
      let agentResponse: string;
      
      switch (userIntent) {
        case UserIntentEnum.PURE_DISCUSSION:
          agentResponse = await this.handlePureDiscussion(userMessage, chatHistory, projectDetails, codeContexts);
          break;
          
        case UserIntentEnum.FEATURE_EXPLORATION:
          agentResponse = await this.handleFeatureExploration(userMessage, chatHistory, projectDetails, codeContexts);
          break;
          
        case UserIntentEnum.SPEC_CLARIFICATION:
          agentResponse = await this.handleSpecClarification(userMessage, chatHistory, projectDetails, codeContexts);
          break;
          
        case UserIntentEnum.SPEC_GENERATION:
          const specGenerationResult = await this.handleGeneratingSpecs(userMessage, codeContexts, chatHistory, projectDetails);
          agentResponse = specGenerationResult.message;
          break;
          
        default:
          agentResponse = "I'm not sure how to handle that type of request. Please try rephrasing your message.";
      }
      
      // TODO: Implement message persistence
      // For now, we'll just return the response without persisting messages
      // This will be implemented when the DataStore has proper public methods for chat message persistence
      
      // Update session with new message count and previous intent
      await this.dataStore.updateSession(session.id, {
        messageCount: (session.messageCount || 0) + 2, // User message + agent response
        previous_session_intent: userIntent
      });
      
      return {
        success: true,
        message: agentResponse,
        metadata: {
          userIntent,
          chatHistoryLength: chatHistory.length,
          projectDetailsLength: projectDetails.length,
          codeContextsCount: codeContexts.length,
          codeExtractionAnalysis: codeExtractionAnalysisResult
        }
      };
    } catch (error) {
      console.error('Error in SamuraiAgent.execute:', error);
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
    projectDetails: string
  ): Promise<UserIntentEnum> {
    this.logInvocation("analyzeUserIntent", currentUserMessage.content);
    
    // Step 1: Check for keyword matching for spec_generation
    const messageContent = currentUserMessage.content.toLowerCase();
    const specGenerationKeywords = ["create a spec", "create specs"];
    
    for (const keyword of specGenerationKeywords) {
      if (messageContent.includes(keyword)) {
        this.logInvocation("analyzeUserIntent", `Keyword match found: ${keyword} -> SPEC_GENERATION`);
        return UserIntentEnum.SPEC_GENERATION;
      }
    }
    
    // Step 2: If no keyword match, proceed to LLM analysis
    return await this.performLLMIntentAnalysis(chatHistory, currentUserMessage, projectDetails);
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
  ): Promise<{ new_code_context_necessary: boolean, extraction_query: string | null, reasoning: string }> {
    this.logInvocation("analyzeCodeExtractionNeeds", `Intent: ${userIntent}`);
    
    try {
      // Step 1: Load existing code context for the session
      let existingCodeContexts: ExtractCodeToolResultPayload[] = [];
      if (session.codeContextIds && session.codeContextIds.length > 0) {
        existingCodeContexts = await this.dataStore.loadAllCodeContextForSession(session.id, session.metadata.projectId);
      }
      
      // Step 2: Format existing code context for LLM prompt
      const formattedExistingContext = this._formatExistingCodeContextForLLM(existingCodeContexts);
      
      // Step 3: Build conversation summary from chat history
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
      // Step 4: Get the current user message (last message in chat history)
      const currentUserMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : "No current message";
      
      // Step 5: Load and populate the prompt template
      const promptTemplate = this.readPromptFile('codeExtraction/analyze_code_extraction_needs.md');
      const populatedPrompt = promptTemplate
        .replace('{activeTaskHeader}', '') // No active task header for now
        .replace('{noActiveTaskInference}', '') // No active task inference for now
        .replace('{conversationSummary}', conversationSummary)
        .replace('{projectDetails}', projectDetails || 'No project details available')
        .replace('{userIntent}', userIntent)
        .replace('{currentUserMessage}', currentUserMessage)
        .replace('{existingCodeContext}', formattedExistingContext);
      
      // Step 6: Make LLM call
      const response = await this.llmProviderService.chat({
        id: `code-extraction-analysis-${Date.now()}`,
        provider: "auto",
        model: "",
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
      
      // Step 7: Parse and validate LLM response
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      const responseContent = llmResponse.content?.trim() || "";
      const parsedResult = parseAndValidateLlmJson<{
        new_code_context_necessary: boolean;
        extraction_query: string | null;
        reasoning?: string;
      }>(responseContent, ['new_code_context_necessary', 'extraction_query']);
      
      // Step 8: Return the parsed result
      return {
        new_code_context_necessary: parsedResult.new_code_context_necessary,
        extraction_query: parsedResult.extraction_query,
        reasoning: parsedResult.reasoning || 'No reasoning provided'
      };
      
    } catch (error) {
      console.error('Error in analyzeCodeExtractionNeeds:', error);
      return {
        new_code_context_necessary: false,
        extraction_query: null,
        reasoning: `Error in code extraction analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  public async handlePureDiscussion(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[]
  ): Promise<string> {
    this.logInvocation("handlePureDiscussion", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
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
        model: "",
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
      
      return llmResponse.content?.trim() || "I'm here to help with your project! What would you like to discuss?";
      
    } catch (error) {
      console.error('Error in handlePureDiscussion:', error);
      return "I'm here to help with your project! What would you like to discuss?";
    }
  }

  public async handleFeatureExploration(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[]
  ): Promise<string> {
    this.logInvocation("handleFeatureExploration", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
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
        model: "",
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
      
      return llmResponse.content?.trim() || "That's an interesting feature idea! Tell me more about what you have in mind.";
      
    } catch (error) {
      console.error('Error in handleFeatureExploration:', error);
      return "That's an interesting feature idea! Tell me more about what you have in mind.";
    }
  }

  public async handleSpecClarification(
    userMessage: ChatMessage, 
    chatHistory: LLMMessage[], 
    projectDetails: string, 
    codeContexts: ExtractCodeToolResultPayload[]
  ): Promise<string> {
    this.logInvocation("handleSpecClarification", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
      // Load and format the system prompt
      const systemPrompt = await this._loadAndFormatSystemPrompt(
        'specClarification/system_prompt.md',
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
        id: `spec-clarification-${Date.now()}`,
        provider: "auto",
        model: "",
        messages,
        metadata: {
          type: "spec_clarification"
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
      
      return llmResponse.content?.trim() || "I'm here to help clarify your specifications! What would you like to specify?";
      
    } catch (error) {
      console.error('Error in handleSpecClarification:', error);
      return "I'm here to help clarify your specifications! What would you like to specify?";
    }
  }

  public async handleGeneratingSpecs(
    userMessage: ChatMessage, 
    codeContexts: ExtractCodeToolResultPayload[], 
    chatHistory: LLMMessage[], 
    projectDetails: string
  ): Promise<AgentExecutionResult> {
    this.logInvocation("handleGeneratingSpecs", userMessage.content);
    
    try {
      // Format code contexts for prompt injection
      const formattedCodeContexts = this._formatCodeContextsForPrompt(codeContexts);
      
      // Build conversation summary
      const conversationSummary = this._buildConversationSummary(chatHistory);
      
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
        model: "",
        messages,
        metadata: {
          type: "spec_generation"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Extract and parse the LLM response
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      
      const responseContent = llmResponse.content?.trim() || "";
      
      // Parse the JSON response containing specs
      let parsedSpecs: Array<{
        title: string;
        description: string;
        parent_spec_id?: string | null;
      }>;
      
      try {
        parsedSpecs = JSON.parse(responseContent);
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      if (!Array.isArray(parsedSpecs)) {
        throw new Error("LLM response is not an array of specs");
      }
      
      // Validate that each spec has required fields
      for (const spec of parsedSpecs) {
        if (!spec.title || !spec.description) {
          throw new Error(`Invalid spec structure: missing title or description. Spec: ${JSON.stringify(spec)}`);
        }
      }
      
      // Create specs using CreateSpecTool
      const createdSpecs = [];
      const errors = [];
      let rootSpecId: string | null = null;
      
      for (const specData of parsedSpecs) {
        try {
          // Determine parent spec ID
          let parentSpecId: string | undefined = undefined;
          if (specData.parent_spec_id) {
            parentSpecId = specData.parent_spec_id;
          } else if (rootSpecId && specData !== parsedSpecs[0]) {
            // If this is not the first spec and we have a root, make it a child of root
            parentSpecId = rootSpecId;
          }
          
          const createSpecResult = await this.createSpecTool.execute({
            title: specData.title,
            description: specData.description,
            parentSpecId,
            depth: parentSpecId ? 2 : 1
          });
          
          if (createSpecResult.success && createSpecResult.result) {
            const createdSpec = createSpecResult.result as any;
            createdSpecs.push(createdSpec);
            
            // Store the first spec's ID as root for subsequent specs
            if (!rootSpecId && !parentSpecId) {
              rootSpecId = createdSpec.id;
            }
          } else {
            errors.push(`Failed to create spec "${specData.title}": ${createSpecResult.error}`);
          }
        } catch (error) {
          errors.push(`Error creating spec "${specData.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Generate response message
      let responseMessage: string;
      if (createdSpecs.length > 0) {
        responseMessage = `Perfect! I've generated and created ${createdSpecs.length} specs based on your request:\n\n`;
        createdSpecs.forEach((spec, index) => {
          responseMessage += `${index + 1}. ${spec.title}\n`;
        });
        
        if (errors.length > 0) {
          responseMessage += `\nNote: ${errors.length} spec(s) could not be created due to errors.`;
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
          errorsCount: errors.length,
          errors: errors,
          specs: createdSpecs
        }
      };
      
    } catch (error) {
      console.error('Error in handleGeneratingSpecs:', error);
      return {
        success: false,
        message: `Error generating specs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async performLLMIntentAnalysis(
    chatHistory: LLMMessage[], 
    currentUserMessage: ChatMessage, 
    projectDetails: string
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
      
      // Call LLM service
      const response = await this.llmProviderService.chat({
        id: `intent-analysis-${Date.now()}`,
        provider: "auto",
        model: "",
        messages,
        metadata: {
          type: "intent_analysis"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      if (response.type === "error" || !response.payload) {
        throw new Error(response.error || "LLM request failed");
      }
      
      // Parse the LLM response
      const llmResponse = response.payload;
      if (!llmResponse || 'error' in llmResponse) {
        throw new Error('error' in llmResponse ? llmResponse.error : "LLM request failed");
      }
      const intentResponse = llmResponse.content?.trim().toLowerCase() || "";
      
      // Map the response to UserIntentEnum
      return this.parseIntentResponse(intentResponse);
      
    } catch (error) {
      console.error('Error in LLM intent analysis:', error);
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
    const promptPath = this.getPromptPath(fileName);
    return fs.readFileSync(promptPath, 'utf-8');
  }

  private getPromptPath(fileName: string): string {
    // When running in VS Code extension, __dirname will be the dist folder
    // e.g., /Users/.../vscode/samurai-agent/dist
    
    // Try multiple possible locations for prompt files
    const candidates = [
      // When compiled: __dirname is dist/, prompts are in dist/prompts/
      path.join(__dirname, 'prompts', fileName),
      // When in source: __dirname is dist/agent/core or src/agent/core
      path.join(__dirname, '..', '..', 'prompts', fileName),
      // From dist root
      path.join(__dirname, '..', 'prompts', fileName),
      // Absolute path with proper extension context
      path.join(__dirname, '..', '..', '..', 'src', 'agent', 'prompts', fileName),
      // Direct path from process.cwd
      path.join(process.cwd(), 'dist', 'prompts', fileName),
      path.join(process.cwd(), 'src', 'agent', 'prompts', fileName),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        console.log(`Found prompt file at: ${candidate}`);
        return candidate;
      }
    }

    console.error(`Prompt file not found for ${fileName}`);
    console.error(`__dirname: ${__dirname}`);
    console.error(`process.cwd(): ${process.cwd()}`);
    console.error(`Checked paths:`, candidates);
    throw new Error(
      `Prompt file not found for ${fileName}. Checked paths: ${candidates.join(', ')}`
    );
  }
  
  private parseIntentResponse(intentResponse: string): UserIntentEnum {
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
    if (intentMapping[intentResponse]) {
      return intentMapping[intentResponse];
    }
    
    // Try partial matching
    for (const [key, value] of Object.entries(intentMapping)) {
      if (intentResponse.includes(key)) {
        return value;
      }
    }
    
    // If no match found, throw an error
    throw new Error(`Unable to parse intent from LLM response: "${intentResponse}". Expected one of: pure_discussion, feature_exploration, spec_clarification`);
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
    if (!chatHistory || chatHistory.length === 0) {
      return "No conversation history available.";
    }

    // Take the last few messages to keep summary concise
    const recentMessages = chatHistory.slice(-20); // Last 5 messages
    const summaryParts: string[] = [];

    for (const message of recentMessages) {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      const content = message.content.length > 200000 
        ? message.content.substring(0, 200000) + '...' 
        : message.content;
      summaryParts.push(`${role}: ${content}`);
    }

    return summaryParts.join('\n');
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
      const promptPath = this.getPromptPath(promptFilePath);
      const promptTemplate = fs.readFileSync(promptPath, 'utf-8');
      
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

  private logInvocation(methodName: string, message: string): void {
    console.log(`SamuraiAgent.${methodName} invoked with message:`, message);
  }
}

