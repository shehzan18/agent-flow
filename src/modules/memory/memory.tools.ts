import { Tool, ToolInput, ToolResult } from "../tools/tool.types";
import { MemoryService } from "./memory.service";

const memoryService = new MemoryService();

// Module-level userId context — set per execution before the agent runs.
// Memory is per-user, but tools have a fixed signature, so we inject userId here.
let currentUserId: string | null = null;

export function setMemoryContext(userId: string): void {
  currentUserId = userId;
}

export function clearMemoryContext(): void {
  currentUserId = null;
}

// ---------- SAVE MEMORY TOOL ----------
export const saveMemoryTool: Tool = {
  definition: {
    name: "save_memory",
    description:
      "Saves an important fact to long-term memory so it can be recalled in future conversations. Use this when you learn something worth remembering about the user, their preferences, decisions, or context. Rate importance 1-10 based on how significant the fact is (e.g. a core preference = 8, a passing comment = 3).",
    category: "utility",
    parameters: {
      content: {
        type: "string",
        description: "The fact to remember, stated concisely as a complete sentence",
        required: true,
      },
      importance: {
        type: "number",
        description: "How important this memory is, from 1 (trivial) to 10 (critical)",
        required: false,
      },
    },
  },

  async execute(input: ToolInput): Promise<ToolResult> {
    if (!currentUserId) {
      return { success: false, error: "No user context set for memory" };
    }

    if (!input.content || typeof input.content !== "string") {
      return { success: false, error: "content is required" };
    }

    try {
      const importance = typeof input.importance === "number"
        ? Math.max(1, Math.min(10, input.importance))
        : 5;

      const result = await memoryService.save({
        content: input.content,
        importance,
        userId: currentUserId,
      });

      return {
        success: true,
        output: {
          saved: true,
          outcome: result.outcome,        // created | updated | merged
          memory: result.content,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to save memory",
      };
    }
  },
};

// ---------- RECALL MEMORY TOOL ----------
export const recallMemoryTool: Tool = {
  definition: {
    name: "recall_memory",
    description:
      "Searches long-term memory for relevant facts from past conversations. Use this at the start of a task to check what you already know about the user or topic, before asking them or assuming. Returns the most relevant remembered facts.",
    category: "utility",
    parameters: {
      query: {
        type: "string",
        description: "What to search for in memory — describe the topic or question",
        required: true,
      },
      topK: {
        type: "number",
        description: "How many memories to retrieve (default 5)",
        required: false,
      },
    },
  },

  async execute(input: ToolInput): Promise<ToolResult> {
    if (!currentUserId) {
      return { success: false, error: "No user context set for memory" };
    }

    if (!input.query || typeof input.query !== "string") {
      return { success: false, error: "query is required" };
    }

    try {
      const memories = await memoryService.recall({
        query: input.query,
        userId: currentUserId,
        topK: typeof input.topK === "number" ? input.topK : 5,
      });

      return {
        success: true,
        output: {
          found: memories.length,
          memories: memories.map((m) => ({
            content: m.content,
            importance: m.importance,
            relevance: Number(m.scores.final.toFixed(3)),
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to recall memory",
      };
    }
  },
};