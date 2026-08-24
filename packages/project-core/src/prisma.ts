import { PrismaClient } from "./generated/client/index.js";

const globalPrisma = globalThis as typeof globalThis & { projectPrisma?: PrismaClient };

export const prisma =
  globalPrisma.projectPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalPrisma.projectPrisma = prisma;
}

export type ProjectPrisma = PrismaClient;
