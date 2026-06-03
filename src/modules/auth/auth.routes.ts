import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "./auth.middleware";
import { AuthRequest } from "./auth.middleware";
import { Response } from "express";

const router = Router();
const authController = new AuthController();

// Public routes
router.post("/auth/register", (req, res) => authController.register(req, res));
router.post("/auth/login", (req, res) => authController.login(req, res));
router.post("/auth/refresh", (req, res) => authController.refresh(req, res));
router.post("/auth/logout", (req, res) => authController.logout(req, res));

// Protected route example
router.get("/auth/me", authenticate, (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: { userId: req.userId },
  });
});

export default router;