import { randomUUID } from "crypto";
import { DataStore } from "../../persistence/dataStore";
import {
  Task,
  TaskPriority,
  TaskStatus,
} from "../../common/models/task-models";
import {
  ToolDefinition,
  ToolExecutionResult,
} from "../../common/models/tool-models";

export interface CreateTaskParameters {
  title: string;
  description?: string;
  parentTaskId?: string;
  depth?: number;
}

export class CreateTaskTool {
  public readonly definition: ToolDefinition = {
    id: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "create_task",
    description: "Create a new task in the Samurai Agent task list.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the task to create.",
        },
        description: {
          type: "string",
          description: "Detailed description/spec for the task.",
        },
        parentTaskId: {
          type: "string",
          description: "Optional identifier of the parent task.",
        },
        depth: {
          type: "number",
          description: "Depth level for nested tasks.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    required: ["title"],
    category: "task_management",
    enabled: true,
    metadata: {},
  };

  constructor(private readonly dataStore: DataStore) {}

  public async execute(params: CreateTaskParameters): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const task = this.buildTask(params);
      const response = this.dataStore.handleWebviewMessage({
        command: "saveTask",
        payload: task,
      });

      if (response.type === "error") {
        throw new Error(response.error ?? "Failed to save task.");
      }

      const executionTime = Date.now() - startTime;
      return {
        success: true,
        result: task,
        executionTime,
        metadata: {
          taskId: task.id,
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

  private buildTask(params: CreateTaskParameters): Task {
    const now = new Date();
    const depth = this.resolveDepth(params);

    return {
      id: randomUUID(),
      title: params.title.trim(),
      spec: (params.description ?? "").trim(),
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      isCompleted: false,
      depth,
      parentTaskId: params.parentTaskId ?? null,
      hasSubtasks: false,
      tags: [],
      dependencies: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  private resolveDepth(params: CreateTaskParameters): number {
    if (typeof params.depth === "number" && params.depth > 0) {
      return params.depth;
    }

    return params.parentTaskId ? 2 : 1;
  }
}

