import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  LLM_PROVIDER: z.enum(["gemini", "openai", "anthropic"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX_HOST: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().optional(),

  TAVILY_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;


// What this does in simple terms:
// Normally you'd access env variables like process.env.PORT directly. Problem — TypeScript doesn't
//  know if PORT actually exists or what type it is. It's always string | undefined.
// This file solves that by:

// Loading your .env file via dotenv.config()
// Defining a schema using Zod — basically a blueprint of what env variables are required and what
//  type they should be
// Validating all env variables against that schema when the app starts
// If something is missing → app crashes immediately with a clear error message instead of failing
//  silently later
// If everything is valid → exports a fully typed env object

// So everywhere in your code you do env.PORT instead of process.env.PORT and TypeScript knows exactly
//  what type it is