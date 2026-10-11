import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

/** Bağlantı adresinden PrismaClient üretir. Seed gibi Next dışı betikler de kullanır. */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export type { PrismaClient };
