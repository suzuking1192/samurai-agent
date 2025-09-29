import { randomUUID } from "crypto";
import { DataStore } from "../../persistence/dataStore";
import {
  Spec,
  SpecPriority,
  SpecStatus,
} from "../../common/models/spec-models";
import {
  ToolDefinition,
  ToolExecutionResult,
} from "../../common/models/tool-models";

export interface CreateSpecParameters {
  title: string;
  description?: string;
  parentSpecId?: string;
  depth?: number;
}

export class CreateSpecTool {
  public readonly definition: ToolDefinition = {
    id: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "create_spec",
    description: "Create a new spec in the Samurai Agent spec list.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the spec to create.",
        },
        description: {
          type: "string",
          description: "Detailed description/spec for the spec.",
        },
        parentSpecId: {
          type: "string",
          description: "Optional identifier of the parent spec.",
        },
        depth: {
          type: "number",
          description: "Depth level for nested specs.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    required: ["title"],
    category: "spec_management",
    enabled: true,
    metadata: {},
  };

  constructor(private readonly dataStore: DataStore) {}

  public async execute(params: CreateSpecParameters): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const spec = this.buildSpec(params);
      const response = this.dataStore.handleWebviewMessage({
        command: "saveSpec",
        payload: spec,
      });

      if (response.type === "error") {
        throw new Error(response.error ?? "Failed to save spec.");
      }

      const executionTime = Date.now() - startTime;
      return {
        success: true,
        result: spec,
        executionTime,
        metadata: {
          specId: spec.id,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime,
        metadata: {},
      };
    }
  }

  private buildSpec(params: CreateSpecParameters): Spec {
    const now = new Date();
    const depth = this.resolveDepth(params);

    return {
      id: randomUUID(),
      title: params.title.trim(),
      spec: (params.description ?? "").trim(),
      status: SpecStatus.PENDING,
      priority: SpecPriority.MEDIUM,
      isCompleted: false,
      depth,
      parentSpecId: params.parentSpecId ?? null,
      hasSubspecs: false,
      tags: [],
      dependencies: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  private resolveDepth(params: CreateSpecParameters): number {
    if (typeof params.depth === "number" && params.depth > 0) {
      return params.depth;
    }

    return params.parentSpecId ? 2 : 1;
  }
}

