import * as assert from "assert";
import { CreateTaskTool } from "../../src/agent/tools/createTaskTool";
import { DataStore } from "../../src/persistence/dataStore";
import { TaskStatus, TaskPriority } from "../../src/common/models/task-models";

class MockDataStore extends DataStore {
  constructor() {
    super("");
  }

  public override handleWebviewMessage(message: any): any {
    if (message.command === "saveTask") {
      return {
        type: "success",
        payload: message.payload,
      } as any;
    }

    throw new Error("Unexpected command");
  }
}

describe("CreateTaskTool", () => {
  let tool: CreateTaskTool;

  beforeEach(() => {
    const dataStore = new MockDataStore();
    tool = new CreateTaskTool(dataStore);
  });

  it("should define tool metadata", () => {
    assert.strictEqual(tool.definition.name, "create_task");
    assert.ok(tool.definition.parameters.properties.title);
  });

  it("should create tasks successfully", async () => {
    const result = await tool.execute({ title: "Test Task" });

    assert.ok(result.success);
    assert.ok(result.result);

    const task = result.result;
    assert.strictEqual(task.title, "Test Task");
    assert.strictEqual(task.status, TaskStatus.PENDING);
    assert.strictEqual(task.priority, TaskPriority.MEDIUM);
    assert.ok(task.createdAt instanceof Date);
  });
});

