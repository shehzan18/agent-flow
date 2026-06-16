import { Tool, ToolInput, ToolResult } from "./tool.types";

export const dateTimeTool: Tool = {
  definition: {
    name: "get_current_datetime",
    description:
      "Returns the current date and time. Use this whenever you need to know today's date, the current time, or when computing time differences. The LLM does not know the current date from training data — always use this tool.",
    category: "utility",
    parameters: {
      format: {
        type: "string",
        description: "Output format",
        required: false,
        enum: ["iso", "human", "date-only", "time-only", "timestamp"],
      },
      timezone: {
        type: "string",
        description: "IANA timezone like 'Asia/Kolkata', 'UTC', 'America/New_York'. Defaults to UTC if not provided.",
        required: false,
      },
    },
  },

  async execute(input: ToolInput): Promise<ToolResult> {
    try {
      const format = input.format || "iso";
      const timezone = input.timezone || "UTC";

      const now = new Date();

      let output: string;

      switch (format) {
        case "iso":
          output = now.toISOString();
          break;

        case "human":
          output = now.toLocaleString("en-US", {
            timeZone: timezone,
            dateStyle: "full",
            timeStyle: "long",
          });
          break;

        case "date-only":
          output = now.toLocaleDateString("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          break;

        case "time-only":
          output = now.toLocaleTimeString("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          break;

        case "timestamp":
          output = String(now.getTime());
          break;

        default:
          output = now.toISOString();
      }

      return {
        success: true,
        output: {
          datetime: output,
          format,
          timezone,
          unixTimestamp: now.getTime(),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to get current datetime",
      };
    }
  },
};