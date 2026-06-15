import { toolRegistry } from "./tool.registry";
import { calculatorTool } from "./calculator.tool";

export function registerAllTools(): void {
  toolRegistry.register(calculatorTool);

  // Future tools will register here:
  // toolRegistry.register(webFetcherTool);
  // toolRegistry.register(dateTimeTool);
  // toolRegistry.register(ragSearchTool);
}