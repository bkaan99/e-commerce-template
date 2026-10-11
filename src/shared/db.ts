import "server-only";
import { getEnv } from "./env";
import { createPrismaClient, type PrismaClient } from "./prisma-client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Uygulama genelinde tek PrismaClient. Yalnızca repository katmanı kullanır;
 * servisler ve UI doğrudan erişmez.
 */
export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient(getEnv().DATABASE_URL);
  return globalForPrisma.prisma;
}
