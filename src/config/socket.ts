import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { logger } from "./logger";

// Global Socket.IO instance
let io: SocketIOServer;

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Auth middleware for every socket connection
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("No token provided"));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        userId: string;
      };

      // Attach userId to socket
      (socket as any).userId = decoded.userId;

      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  // Handle connections
  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;

    logger.info("Client connected", {
      socketId: socket.id,
      userId,
    });

    // Client joins execution room to receive events
    socket.on("join:execution", (executionId: string) => {
      const room = `execution:${executionId}`;
      socket.join(room);

      logger.debug("Client joined execution room", {
        socketId: socket.id,
        userId,
        executionId,
        room,
      });

      socket.emit("joined:execution", {
        executionId,
        message: "Successfully joined execution room",
      });
    });

    // Client leaves execution room
    socket.on("leave:execution", (executionId: string) => {
      const room = `execution:${executionId}`;
      socket.leave(room);

      logger.debug("Client left execution room", {
        socketId: socket.id,
        executionId,
      });
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      logger.info("Client disconnected", {
        socketId: socket.id,
        userId,
        reason,
      });
    });
  });

  logger.info("Socket.IO initialized");

  return io;
}

// Get Socket.IO instance anywhere in the app
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}

// Emit event to specific execution room
export function emitToExecution(
  executionId: string,
  event: string,
  data: any
) {
  if (!io) return;

  const room = `execution:${executionId}`;
  io.to(room).emit(event, data);

  logger.debug("Emitted event to execution room", {
    executionId,
    event,
    room,
  });
}


