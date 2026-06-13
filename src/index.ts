import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { connectDatabase } from "./config/database";
import { redis } from "./config/redis";
import { initializeSocket } from "./config/socket";
import { queueService } from "./modules/queue-system/queue.service";
import { AgentWorker } from "./modules/worker-system/agent.worker";
import { RagWorker } from "./modules/worker-system/rag.worker";
import { MemoryWorker } from "./modules/worker-system/memory.worker";
import healthRouter from "./routes/health.routes";
import authRouter from "./modules/auth/auth.routes";
import workflowRouter from "./modules/workflows/workflow.routes";
import executionRouter from "./modules/execution-manager/execution.routes";
import ragRoutes from "./modules/rag/rag.routes";
import path from "path";

const app = express();



// Security middleware
//app.use(helmet());
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public"))); // Serve static files from the public directory
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
app.use("/api/v1", executionRouter);
app.use("/api/v1", ragRoutes);

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
  // Connect database
  await connectDatabase();

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize Socket.IO
  initializeSocket(httpServer);

  // Initialize queues
  queueService.getAgentQueue();
  logger.info("Queue system initialized");

  // Start workers
  new AgentWorker();
  new RagWorker();
  new MemoryWorker();
  logger.info("All workers started");

  // Start server
  httpServer.listen(env.PORT, () => {
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
