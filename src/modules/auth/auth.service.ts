import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRepository } from "./auth.repository";
import { RegisterInput, LoginInput } from "./auth.validation";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

const authRepository = new AuthRepository();

export class AuthService {
  async register(data: RegisterInput) {
    // Check if user already exists
    const existingUser = await authRepository.findUserByEmail(data.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await authRepository.createUser({
      ...data,
      hashedPassword,
    });

    logger.info("New user registered", { userId: user.id });

    return user;
  }

  async login(data: LoginInput) {
    // Find user
    const user = await authRepository.findUserByEmail(data.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Save session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createSession({
      userId: user.id,
      refreshToken,
      expiresAt,
    });

    logger.info("User logged in", { userId: user.id });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    // Find session
    const session = await authRepository.findSessionByRefreshToken(refreshToken);
    if (!session) {
      throw new Error("Invalid refresh token");
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await authRepository.deleteSession(refreshToken);
      throw new Error("Refresh token expired");
    }

    // Generate new access token
    const accessToken = this.generateAccessToken(session.userId);

    logger.info("Access token refreshed", { userId: session.userId });

    return { accessToken };
  }

  async logout(refreshToken: string) {
    await authRepository.deleteSession(refreshToken);
    logger.info("User logged out");
  }

  private generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
    );
  }
}



// What this does in simple terms:
// This is the brain of the auth module. All business logic lives here.
// Register flow:

// Check if email exists → throw error if it does. We say "User with this email already exists" not 
// "Email taken" — same message format everywhere
// bcrypt.hash(password, 12) → the 12 is the salt rounds. Higher = more secure but slower. 12 is the
//  industry standard balance
// Never store plain text password, always store the hash

// Login flow:

// Find user by email
// bcrypt.compare(plainPassword, hashedPassword) → bcrypt handles the comparison internally. Returns true/false
// Notice both "user not found" and "wrong password" throw the same error: "Invalid email or password". 
// This is intentional — if you say "User not found" an attacker knows that email isn't registered. 
// Same message = no information leak
// Generate both tokens, save session, return everything

// Token generation:

// generateAccessToken → signs a JWT with userId as payload, uses access secret, expires in 15min
// generateRefreshToken → signs a JWT with refresh secret, expires in 7 days
// Both are private methods — only this class can call them

// Refresh flow:

// Find session by refresh token
// Check expiry manually — even if JWT isn't expired, if session was deleted from DB it's invalid
// Generate new access token only — refresh token stays the same