import { Tool, ToolDefinition } from "./tool.types";
import { logger } from "../../config/logger";

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  // Register a new tool
  register(tool: Tool): void {
    const name = tool.definition.name;

    if (this.tools.has(name)) {
      logger.warn("Tool already registered, overwriting", { name });
    }

    this.tools.set(name, tool);

    logger.info("Tool registered", {
      name,
      category: tool.definition.category,
    });
  }

  // Get a tool by name
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  // Check if a tool exists
  has(name: string): boolean {
    return this.tools.has(name);
  }

  // Get all registered tools
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  // Get all tool definitions (for sending to LLM)
  getAllDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => tool.definition);
  }

  // Get tools by category
  getByCategory(category: string): Tool[] {
    return this.getAll().filter(
      (tool) => tool.definition.category === category
    );
  }

  // Get tools by names (used when an agent has access to a subset)
  getByNames(names: string[]): Tool[] {
    return names
      .map((name) => this.tools.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  // Unregister a tool (rarely needed, mainly for testing)
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      logger.info("Tool unregistered", { name });
    }
    return removed;
  }

  // Get count of registered tools
  count(): number {
    return this.tools.size;
  }
}

// Singleton instance — same registry across the entire app
export const toolRegistry = new ToolRegistry();