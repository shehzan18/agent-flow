import { Tool, ToolInput, ToolResult } from "./tool.types";

export const calculatorTool: Tool = {
  definition: {
    name: "calculator",
    description:
      "Performs basic arithmetic operations on two numbers. Use this when you need to add, subtract, multiply, divide, or compute powers/percentages. Always use this for any calculation instead of trying to compute manually.",
    category: "math",
    parameters: {
      operation: {
        type: "string",
        description: "The arithmetic operation to perform",
        required: true,
        enum: ["add", "subtract", "multiply", "divide", "power", "percentage"],
      },
      a: {
        type: "number",
        description: "First operand",
        required: true,
      },
      b: {
        type: "number",
        description: "Second operand",
        required: true,
      },
    },
  },

  async execute(input: ToolInput): Promise<ToolResult> {
    const { operation, a, b } = input;

    try {
      let result: number;

      switch (operation) {
        case "add":
          result = a + b;
          break;

        case "subtract":
          result = a - b;
          break;

        case "multiply":
          result = a * b;
          break;

        case "divide":
          if (b === 0) {
            return {
              success: false,
              error: "Division by zero is not allowed",
            };
          }
          result = a / b;
          break;

        case "power":
          result = Math.pow(a, b);
          break;

        case "percentage":
          // a% of b — e.g., 20% of 150 = 30
          result = (a / 100) * b;
          break;

        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
          };
      }

      // Check for infinity/NaN (very large numbers, etc.)
      if (!Number.isFinite(result)) {
        return {
          success: false,
          error: `Result is not a finite number: ${result}`,
        };
      }

      return {
        success: true,
        output: {
          result,
          expression: `${a} ${operation} ${b} = ${result}`,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Calculation failed",
      };
    }
  },
};