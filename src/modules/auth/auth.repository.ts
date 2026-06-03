import { prisma } from "../../config/database";
import { RegisterInput } from "./auth.validation";

export class AuthRepository {
  async createUser(data: RegisterInput & { hashedPassword: string }) {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async createSession(data: {
    userId: string;
    refreshToken: string;
    expiresAt: Date;
  }) {
    return prisma.session.create({
      data,
    });
  }

  async findSessionByRefreshToken(refreshToken: string) {
    return prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
  }

  async deleteSession(refreshToken: string) {
    return prisma.session.delete({
      where: { refreshToken },
    });
  }

  async deleteAllUserSessions(userId: string) {
    return prisma.session.deleteMany({
      where: { userId },
    });
  }
}


// What this does in simple terms:
// This file is the only place in the entire auth module that talks to the database. 
// That's the rule — no other file writes raw Prisma queries.
// Why this separation? Two reasons:
// 1. Single responsibility — if your database changes (column renamed, table restructured),
//  you only update this one file. Nothing else breaks.
// 2. Testability — in tests you can swap out the real repository with a fake one that returns
//  mock data. Your service and controller don't care — they just call repository methods.
// Important thing about select:
// Notice createUser and findUserById have a select block:
// typescriptselect: {
//   id: true,
//   name: true,
//   email: true,
//   createdAt: true,
// }
// This means Prisma only returns those fields. The password field is intentionally excluded. 
// So you can never accidentally send a password hash back to the frontend.
// But findUserByEmail has no select — it returns everything including the password. 
// That's intentional because the service needs the password hash to compare it during login