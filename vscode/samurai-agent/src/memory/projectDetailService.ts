import * as fs from "fs";
import * as path from "path";
import { LLMProviderService } from "../agent/llm/llmProviderService";
import { DataStore } from "../persistence/dataStore";
import { IProjectSettings } from "../common/models/settings-models";
import { LLMMessage, LLMResponse } from "../common/models/llm-models";

export class ProjectDetailService {
  constructor(
    private readonly llmProviderService: LLMProviderService,
    private readonly dataStore: DataStore,
    private readonly extensionRoot: string = path.resolve(
      __dirname,
      "..",
      "..",
    ),
  ) {}

  public async ingestProjectDetail(
    projectId: string,
    rawText: string,
    mode: string = "merge",
  ): Promise<string> {
    const trimmed = (rawText || "").trim();
    if (!trimmed) {
      return "";
    }

    const settings = this.loadProjectSettings();
    const existingContent = settings?.digestedProjectDetailContent || "";

    const normalizedMode = (mode || "merge").toLowerCase();
    const useMerge = normalizedMode === "merge" && !!existingContent;

    const buildResult = useMerge
      ? this.buildMergeInput(existingContent, trimmed)
      : this.buildSynthesisInput(trimmed);

    const provider = buildResult.provider ?? "auto";
    const model = buildResult.model ?? "";
    const messages = buildResult.messages;

    const requestTimestamp = new Date();
    const response = await this.llmProviderService.chat({
      id: `project-detail-${Date.now()}`,
      provider,
      model,
      messages,
      metadata: {
        projectId,
        mode: useMerge ? "merge" : "synthesis",
      },
      createdAt: requestTimestamp,
      updatedAt: requestTimestamp,
    });

    if (response.type === "error" || !response.payload) {
      throw new Error(response.error || "LLM request failed");
    }

    const payload = response.payload as LLMResponse;
    const finalText = (payload.content || "").trim();
    this.saveProjectContent(settings, trimmed, finalText);
    return finalText;
  }

  private loadProjectSettings(): IProjectSettings {
    const response = this.dataStore.readProjectSettings();
    if (response.type === "success" && response.payload) {
      return response.payload;
    }
    throw new Error("Failed to load project settings");
  }

  private saveProjectContent(
    settings: IProjectSettings,
    rawContent: string,
    digestedContent: string,
  ): void {
    const updatedSettings: IProjectSettings = {
      ...settings,
      rawProjectDetailContent: rawContent,
      digestedProjectDetailContent: digestedContent,
      updatedAt: new Date(),
    };

    const response = this.dataStore.saveProjectSettings(updatedSettings);
    if (response.type === "error") {
      throw new Error(response.error || "Failed to save project settings");
    }
  }

  private buildMergeInput(
    existingContent: string,
    newInsights: string,
  ): {
    provider: string;
    model: string;
    messages: LLMMessage[];
  } {
    const systemPrompt = this.readPrompt("merge_system_prompt.md");
    const content = `EXISTING PROJECT DETAIL:\n${existingContent}\n\nNEW INSIGHTS TO MERGE:\n${newInsights}\n\nINSTRUCTIONS: Perform the merge according to the rules above, ensuring preservation of existing content while intelligently incorporating new insights.`;
    return {
      provider: "auto",
      model: "",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ] as LLMMessage[],
    };
  }

  private buildSynthesisInput(newInsights: string): {
    provider: string;
    model: string;
    messages: LLMMessage[];
  } {
    const systemPrompt = this.readPrompt("synthesis_system_prompt.md");
    return {
      provider: "auto",
      model: "",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `NEW INSIGHTS:\n${newInsights}` },
      ] as LLMMessage[],
    };
  }

  private readPrompt(fileName: string): string {
    const promptPath = this.getPromptPath(fileName);
    return fs.readFileSync(promptPath, "utf-8");
  }

  private getPromptPath(fileName: string): string {
    const candidates = [
      path.join(
        this.extensionRoot,
        "dist",
        "prompts",
        "projectDetail",
        fileName,
      ),
      path.join(this.extensionRoot, "prompts", "projectDetail", fileName),
      path.join(
        this.extensionRoot,
        "src",
        "prompts",
        "projectDetail",
        fileName,
      ),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `Prompt file not found for ${fileName}. Checked paths: ${candidates.join(", ")}`,
    );
  }
}
