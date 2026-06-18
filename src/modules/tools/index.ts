import { toolRegistry } from "./tool.registry";
import { calculatorTool } from "./calculator.tool";
import { dateTimeTool } from "./date-time.tool";
import { webFetcherTool } from "./web-fetcher.tool";
import { webSearchTool } from "./web-search.tool";
import { saveMemoryTool, recallMemoryTool } from "../memory/memory.tools";

export function registerAllTools(): void {
  toolRegistry.register(calculatorTool);
  toolRegistry.register(dateTimeTool);
  toolRegistry.register(webFetcherTool);
  toolRegistry.register(webSearchTool);
  toolRegistry.register(saveMemoryTool);
  toolRegistry.register(recallMemoryTool);
}