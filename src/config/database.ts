import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Database connection failed", { error });
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}


// What this does in simple terms:
// Why not just new PrismaClient() directly?
// In development, nodemon restarts your server every time you change a file. Every restart would
//  create a new database connection. After 10-20 restarts you'd have dozens of open connections and Postgres would start refusing new ones.
// The globalForPrisma trick solves this — it stores the Prisma instance on the global object. On
//  restart, if a Prisma instance already exists on global, reuse it instead of creating a new one. 
//  In production this doesn't matter because the server never restarts randomly.

// Query logging:
// Every database query gets logged via Winston in development. So when you call 
// prisma.user.findUnique(...) you'll see the actual SQL it ran and how long it took in your terminal.
//  Extremely useful for debugging slow queries.
// connectDatabase():
// Called once when the app starts to verify the database connection is working. If it fails → app 
// crashes immediately with a clear error instead of failing silently on the first request.
