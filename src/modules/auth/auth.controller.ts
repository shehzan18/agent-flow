import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { registerSchema, loginSchema, refreshSchema } from "./auth.validation";
import { logger } from "../../config/logger";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      // Validate request body
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const user = await authService.register(parsed.data);

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: { user },
      });
    } catch (error: any) {
      logger.error("Register error", { error: error.message });

      if (error.message === "User with this email already exists") {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      // Validate request body
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await authService.login(parsed.data);

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    } catch (error: any) {
      logger.error("Login error", { error: error.message });

      if (error.message === "Invalid email or password") {
        return res.status(401).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await authService.refresh(parsed.data.refreshToken);

      return res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: result,
      });
    } catch (error: any) {
      logger.error("Refresh error", { error: error.message });

      if (
        error.message === "Invalid refresh token" ||
        error.message === "Refresh token expired"
      ) {
        return res.status(401).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      await authService.logout(parsed.data.refreshToken);

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      logger.error("Logout error", { error: error.message });
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

// The controller is the traffic cop. It sits between the HTTP request and the business logic. 
// Its only job is:

// Validate the request body using Zod
// Call the service
// Return the right HTTP response

// Three types of responses you'll see:

// 400 → bad request, validation failed, user sent wrong data
// 401 → unauthorized, wrong password or invalid token
// 409 → conflict, email already exists
// 201 → created successfully (register)
// 200 → success (login, refresh, logout)
// 500 → something unexpected broke on our side

// Why catch errors here and not in the service?
// The service throws plain JavaScript errors like throw new Error("Invalid email or password"). 
// It doesn't know anything about HTTP — that's not its job.
// The controller catches those errors and translates them into proper HTTP responses. Clean separation.
// Pattern used in every method:

// validate → call service → return success response
//                        → catch error → return error response