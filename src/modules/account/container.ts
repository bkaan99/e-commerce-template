import { getDb } from "@/shared/db";
import { getEnv } from "@/shared/env";
import { getSiteUrl } from "@/shared/site-url";
import { Argon2PasswordHasher } from "../auth/password-hasher";
import { getNotificationService } from "../orders/container";
import { PrismaAccountRepository } from "./account.repository";
import { AccountService } from "./account.service";

export function getAccountService(): AccountService {
  return new AccountService({
    accounts: new PrismaAccountRepository(getDb),
    hasher: new Argon2PasswordHasher(),
    mailer: getNotificationService(),
    secret: getEnv().AUTH_SECRET,
    baseUrl: getSiteUrl(),
  });
}
