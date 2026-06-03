import winston from "winston";
import { env } from "./env";

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const cid = correlationId ? ` [${correlationId}]` : "";
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}${cid}: ${message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});



// What this does in simple terms:
// console.log is fine for small projects. For a production system like AgentFlow it's not enough
//  because:

// You can't control log levels (debug vs info vs error)
// You can't write logs to files
// You can't add structured metadata like correlationId

// Winston solves all of this.
// Two formats:

// Dev format → colored, human-readable output in terminal. Example: 12:34:56 info [req_abc123]:
//  Server started
// Prod format → JSON output, machine-readable, easy to parse by log aggregation tools

// Three transports (places logs go):

// Console → always prints to terminal
// error.log → only error-level logs saved to file
// combined.log → all logs saved to file

// The correlationId is important — every request gets a unique ID so you can trace exactly what 
// happened during one specific request across all your logs