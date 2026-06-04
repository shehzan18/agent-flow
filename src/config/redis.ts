import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (error) => {
  logger.error("Redis connection error", { error: error.message });
});

redis.on("close", () => {
  logger.warn("Redis connection closed");
});

export const redisConnection = {
  host: new URL(env.REDIS_URL).hostname,
  port: parseInt(new URL(env.REDIS_URL).port || "6379"),
};



// redis → the actual Redis client instance, used for direct Redis operations like SETNX 
// locks and execution state caching
// redisConnection → just the host and port as an object, used by BullMQ Queue and Worker
//  constructors which need connection details in this specific format