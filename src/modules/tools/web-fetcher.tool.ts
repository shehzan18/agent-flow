import { Tool, ToolInput, ToolResult } from "./tool.types";
import { parse } from "node-html-parser";

export const webFetcherTool: Tool = {
  definition: {
    name: "fetch_url",
    description:
      "Fetches the content of a web page given its URL and returns the readable text. Use this when you have a specific URL and need to read its contents — articles, documentation, API responses, etc. Do NOT use this to search the web; use web_search for that.",
    category: "search",
    parameters: {
      url: {
        type: "string",
        description: "The full URL to fetch, including https://",
        required: true,
      },
      maxLength: {
        type: "number",
        description: "Maximum characters of text to return (default 5000)",
        required: false,
      },
    },
  },

  async execute(input: ToolInput): Promise<ToolResult> {
    const { url, maxLength = 5000 } = input;

    // Basic URL validation
    if (!url || typeof url !== "string") {
      return { success: false, error: "URL is required" };
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return {
        success: false,
        error: "URL must start with http:// or https://",
      };
    }

    try {
      // Fetch with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AgentFlow/1.0; +https://agentflow.dev)",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle JSON responses directly
      if (contentType.includes("application/json")) {
        const json = await response.json();
        const text = JSON.stringify(json, null, 2);
        return {
          success: true,
          output: {
            url,
            contentType: "json",
            content: text.substring(0, maxLength),
            truncated: text.length > maxLength,
          },
        };
      }

      // Handle HTML — extract readable text
      const html = await response.text();
      const root = parse(html);

      // Remove noise
      root.querySelectorAll("script, style, nav, footer, header, noscript, iframe").forEach((el) => el.remove());

      // Try to get main content, fall back to body
      const main = root.querySelector("main") || root.querySelector("article") || root.querySelector("body");
      const text = (main?.text || root.text)
        .replace(/\s+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // Extract title
      const title = root.querySelector("title")?.text?.trim() || "";

      return {
        success: true,
        output: {
          url,
          title,
          contentType: "html",
          content: text.substring(0, maxLength),
          truncated: text.length > maxLength,
          fullLength: text.length,
        },
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { success: false, error: "Request timed out after 15 seconds" };
      }
      return {
        success: false,
        error: error.message || "Failed to fetch URL",
      };
    }
  },
};