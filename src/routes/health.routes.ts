import { Router, Request, Response } from "express";
import { env } from "../config/env";

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "AgentFlow is running",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;


// This is the health check endpoint. It's a simple route that just returns a JSON response 
// saying the server is alive.
// Why does this exist? Three reasons:

// During development, you hit localhost:3000/api/v1/health to quickly verify the server is running
// In production, AWS and Docker use health checks to know if your container is alive. If this 
// endpoint stops responding, they restart the container automatically
// During interviews, you open this URL first to show the server is live