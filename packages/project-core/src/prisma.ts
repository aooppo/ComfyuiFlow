import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "./generated/client/index.js";

if (!process.env.DATABASE_URL) {
  let directory = process.cwd();
  while (!existsSync(resolve(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  const envPath = resolve(directory, ".env");
  if (existsSync(envPath)) loadEnvFile(envPath);
}

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
