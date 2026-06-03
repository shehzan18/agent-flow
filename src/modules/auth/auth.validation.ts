import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;


// What this does in simple terms:
// We define three schemas — one for each endpoint.
// registerSchema — when someone hits POST /register, their request body must have:

// name → string, minimum 2 characters
// email → valid email format
// password → minimum 8 chars, must have uppercase letter and a number

// If any of these fail, Zod gives back a clear error message like "Password must be at least 8 
// characters" instead of a cryptic database error.

// loginSchema — just email and password, no complexity rules needed here since we're just checking 
// against what's stored.

// refreshSchema — just the refresh token string.
// The z.infer lines at the bottom — this is the TypeScript magic. Instead of manually writing:
// typescripttype RegisterInput = {
//   name: string;
//   email: string;
//   password: string;
// }
// Zod automatically generates the TypeScript type from the schema. They stay in sync automatically
//  — change the schema, the type updates too.