import { toolRegistry } from "./tool.registry";
import {
  Tool,
  ToolInput,
  ToolResult,
  ToolCall,
  ToolExecutionTrace,
  ToolParameter,
} from "./tool.types";
import { logger } from "../../config/logger";

export class ToolExecutor {
  private executionTraces: ToolExecutionTrace[] = [];

  // Execute a single tool call
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const { toolName, arguments: args } = toolCall;

    logger.info("Executing tool", { toolName, arguments: args });

    // Step 1: Check tool exists
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      const error = `Tool not found: ${toolName}`;
      logger.error(error);
      return this.recordTrace(toolName, args, {
        success: false,
        error,
      }, startTime);
    }

    // Step 2: Validate input against schema
    const validationError = this.validateInput(tool, args);
    if (validationError) {
      logger.error("Tool input validation failed", {
        toolName,
        error: validationError,
      });
      return this.recordTrace(toolName, args, {
        success: false,
        error: validationError,
      }, startTime);
    }

    // Step 3: Execute the tool with timeout protection
    try {
      const result = await this.executeWithTimeout(tool, args, 30000);

      // Add latency to metadata
      result.metadata = {
        ...result.metadata,
        latencyMs: Date.now() - startTime,
      };

      logger.info("Tool executed successfully", {
        toolName,
        latencyMs: result.metadata.latencyMs,
      });

      return this.recordTrace(toolName, args, result, startTime);
    } catch (error: any) {
      logger.error("Tool execution failed", {
        toolName,
        error: error.message,
      });

      return this.recordTrace(toolName, args, {
        success: false,
        error: error.message || "Tool execution failed",
      }, startTime);
    }
  }

  // Execute multiple tool calls in parallel (when LLM requests several at once)
  async executeBatch(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    logger.info("Executing tool batch", { count: toolCalls.length });

    const results = await Promise.all(
      toolCalls.map((call) => this.execute(call))
    );

    return results;
  }

  // Get all execution traces (for replay/debugging)
  getTraces(): ToolExecutionTrace[] {
    return this.executionTraces;
  }

  // Clear traces (e.g., between agent runs)
  clearTraces(): void {
    this.executionTraces = [];
  }

  // Validate input against tool's parameter schema
  private validateInput(tool: Tool, input: ToolInput): string | null {
    const params = tool.definition.parameters;

    // Check required fields
    for (const [paramName, paramDef] of Object.entries(params)) {
      if (paramDef.required && !(paramName in input)) {
        return `Missing required parameter: ${paramName}`;
      }

      // Type check (if param is provided)
      if (paramName in input) {
        const typeError = this.checkType(input[paramName], paramDef, paramName);
        if (typeError) return typeError;
      }
    }

    return null;
  }

  // Check value matches expected type
  private checkType(
    value: any,
    param: ToolParameter,
    paramName: string
  ): string | null {
    const actualType = Array.isArray(value) ? "array" : typeof value;

    if (param.type === "number" && actualType !== "number") {
      return `Parameter ${paramName} must be a number, got ${actualType}`;
    }

    if (param.type === "string" && actualType !== "string") {
      return `Parameter ${paramName} must be a string, got ${actualType}`;
    }

    if (param.type === "boolean" && actualType !== "boolean") {
      return `Parameter ${paramName} must be a boolean, got ${actualType}`;
    }

    if (param.type === "array" && !Array.isArray(value)) {
      return `Parameter ${paramName} must be an array, got ${actualType}`;
    }

    // Check enum constraint
    if (param.enum && !param.enum.includes(value)) {
      return `Parameter ${paramName} must be one of: ${param.enum.join(", ")}`;
    }

    return null;
  }

  // Execute with timeout protection
  private async executeWithTimeout(
    tool: Tool,
    input: ToolInput,
    timeoutMs: number
  ): Promise<ToolResult> {
    return Promise.race([
      tool.execute(input),
      new Promise<ToolResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  // Record trace and return result
  private recordTrace(
    toolName: string,
    input: ToolInput,
    result: ToolResult,
    startTime: number
  ): ToolResult {
    const trace: ToolExecutionTrace = {
      toolName,
      input,
      result,
      timestamp: new Date(startTime).toISOString(),
      durationMs: Date.now() - startTime,
    };

    this.executionTraces.push(trace);
    return result;
  }
}