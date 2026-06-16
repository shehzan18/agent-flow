import { Tool, ToolInput, ToolResult } from "./tool.types";
import { tavily } from "@tavily/core";
import { env } from "../../config/env";

export const webSearchTool: Tool = {
  definition: {
    name: "web_search",
    description:
      "Searches the web and returns relevant results with titles, URLs, and content snippets. Use this when you need current information, recent events, or facts you're unsure about. After searching, you can use fetch_url to read a specific result in full detail.",
    category: "search",
    parameters: {
      query: {
        type: "string",
        description: "The search query — what you want to find",
        required: true,
      },
      maxResults: {
        type: "number",
        description: "Number of results to return (default 5, max 10)",
        required: false,
      },
      searchDepth: {
        type: "string",
        description: "Search depth — 'basic' is faster, 'advanced' is more thorough",
        required: false,
        enum: ["basic", "advanced"],
      },
    },
  },

  async execute(input: ToolInput): Promise<ToolResult> {
    const { query, maxResults = 5, searchDepth = "basic" } = input;

    if (!query || typeof query !== "string") {
      return { success: false, error: "Search query is required" };
    }

    if (!env.TAVILY_API_KEY) {
      return {
        success: false,
        error: "Tavily API key not configured",
      };
    }

    try {
      const client = tavily({ apiKey: env.TAVILY_API_KEY });

      const response = await client.search(query, {
        maxResults: Math.min(maxResults, 10),
        searchDepth,
        includeAnswer: true,
      });

      // Transform to clean format
      const results = response.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        score: r.score,
      }));

      return {
        success: true,
        output: {
          query,
          answer: response.answer || null,
          resultCount: results.length,
          results,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Web search failed",
      };
    }
  },
};




// Why Tavily over scraping Google:
// Tavily is built specifically for AI agents. It:

// Returns clean JSON (no HTML parsing)
// Ranks results by relevance for LLM consumption
// Has an includeAnswer feature that gives a direct synthesized answer
// Doesn't get you IP-banned like scraping Google would