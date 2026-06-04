import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./config/logger";
import healthRouter from "./routes/health.routes";
import authRouter from "./modules/auth/auth.routes";

import { connectDatabase } from "./config/database";

import workflowRouter from "./modules/workflows/workflow.routes";

import { redis } from "./config/redis";

import { queueService } from "./modules/queue-system/queue.service";


const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Correlation ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader("x-correlation-id", correlationId);
  (req as any).correlationId = correlationId;
  next();
});

// Routes
app.use("/api/v1", healthRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", workflowRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    correlationId: (req as any).correlationId,
  });
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

async function bootstrap() {
  await connectDatabase();

  await redis.ping();
  logger.info("Redis connected successfully");

  // Initialize queues
  queueService.getAgentQueue();
  logger.info("Queue system initialized");

  app.listen(env.PORT, () => {
    logger.info(`AgentFlow running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

bootstrap();

export default app;


// What this does in simple terms:
// This is the entry point of the entire application. Think of it as the main gate.
// Three layers of middleware applied to every request in order:

// helmet → sets secure HTTP headers automatically. Protects against common attacks like clickjacking,
//  XSS etc. One line of code, free security.

// cors → allows your frontend to talk to this backend. Without this, browsers block cross-origin
//  requests.

// Body parsing → lets you read req.body when someone sends JSON data in a POST request.

// Correlation ID middleware — every incoming request gets a unique ID like req_1234567890_abc123. 
// This ID travels with the request through all your logs. When something breaks in production, you 
// search logs by this ID and see exactly what happened step by step.
// Two error handlers at the bottom:

// 404 handler → catches any request to a route that doesn't exist
// Global error handler → catches any unhandled error anywhere in the app, logs it with Winston, 
// returns clean JSON response
