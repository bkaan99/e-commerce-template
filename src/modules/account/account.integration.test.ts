import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { Argon2PasswordHasher } from "../auth/password-hasher";
import { AuthService } from "../auth/auth.service";
import type {
  AuthUserRecord,
  AuthUserRepository,
} from "../auth/auth.repository";
import { PrismaAccountRepository } from "./account.repository";
import { AccountService, type AccountMailer } from "./account.service";
import { PrismaStockAlertRepository } from "../stock-alerts/stock-alert.repository";
import { StockAlertService } from "../stock-alerts/stock-alert.service";

describe("Hesap ve stok bildirimi (veritabanı)", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;

  beforeAll(() => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("kayıt olur, doğrular, şifre sıfırlar ve yeni parolayla giriş yapar", async () => {
    const sent: { verify: string[]; reset: string[] } = {
      verify: [],
      reset: [],
    };
    const mailer: AccountMailer = {
      sendEmailVerification: async (_e, link) => void sent.verify.push(link),
      sendPasswordReset: async (_e, link) => void sent.reset.push(link),
    };
    const hasher = new Argon2PasswordHasher();
    const service = new AccountService({
      accounts: new PrismaAccountRepository(() => db),
      hasher,
      mailer,
      secret: "s".repeat(32),
      baseUrl: "https://site.test",
    });
    const email = `hesap-${tag}@example.com`;
    const tokenOf = (link: string) =>
      decodeURIComponent(new URL(link).searchParams.get("token")!);

    await service.register({
      email,
      password: "ilkparola12345",
      firstName: "Ali",
      lastName: "Veli",
      phone: null,
    });

    const created = await db.user.findUniqueOrThrow({
      where: { email },
      include: { customer: true },
    });
    expect(created.type).toBe("CUSTOMER");
    expect(created.customer).not.toBeNull();
    expect(created.emailVerifiedAt).toBeNull();
    expect(created.passwordHash).not.toContain("ilkparola");

    await service.verifyEmail(tokenOf(sent.verify[0]!));
    expect(
      (await db.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt,
    ).not.toBeNull();

    await service.requestPasswordReset(email);
    await service.resetPassword(tokenOf(sent.reset[0]!), "yeniparola12345");

    const users: AuthUserRepository = {
      findByEmail: async (value) => {
        const row = await db.user.findUnique({ where: { email: value } });
        return row
          ? ({
              id: row.id,
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              type: row.type,
              isActive: row.isActive,
              anonymized: false,
              passwordHash: row.passwordHash,
              failedLoginCount: row.failedLoginCount,
              lockedUntil: row.lockedUntil,
              permissions: [],
            } satisfies AuthUserRecord)
          : null;
      },
      findById: async () => null,
      saveLoginState: async () => {},
    };
    const auth = new AuthService({ users, hasher });

    expect(await auth.authenticate(email, "ilkparola12345")).toBeNull();
    expect((await auth.authenticate(email, "yeniparola12345"))?.email).toBe(
      email,
    );
  });

  it("aynı e-postayla eşzamanlı iki kayıttan yalnızca biri başarılı olur", async () => {
    const repo = new PrismaAccountRepository(() => db);
    const hasher = new Argon2PasswordHasher();
    const service = new AccountService({
      accounts: repo,
      hasher,
      mailer: {
        sendEmailVerification: async () => {},
        sendPasswordReset: async () => {},
      },
      secret: "s".repeat(32),
      baseUrl: "https://site.test",
    });
    const input = {
      email: `yaris-${tag}@example.com`,
      password: "ilkparola12345",
      firstName: "Ali",
      lastName: "Veli",
      phone: null,
    };

    const results = await Promise.allSettled([
      service.register(input),
      service.register(input),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.user.count({ where: { email: input.email } })).toBe(1);
  });

  it("stok bildirimi: abonelik, stoğa girince bildirim ve tekrar göndermeme", async () => {
    const category = await db.category.create({
      data: { name: "Bildirim", slug: `alert-${tag}` },
    });
    const product = await db.product.create({
      data: {
        name: `Bildirim Ürünü ${tag}`,
        slug: `bildirim-urunu-${tag}`,
        status: "ACTIVE",
        categoryId: category.id,
        variants: {
          create: { sku: `ALERT-${tag}`, price: "10.00", stockQuantity: 0 },
        },
      },
      include: { variants: true },
    });
    const variantId = product.variants[0]!.id;

    const sent: string[] = [];
    const service = new StockAlertService({
      alerts: new PrismaStockAlertRepository(() => db),
      mailer: {
        sendStockAvailable: async (email) => void sent.push(email),
      },
      secret: "s".repeat(32),
      baseUrl: "https://site.test",
    });
    const email = `bildir-${tag}@example.com`;

    await service.subscribe(variantId, email);
    await service.subscribe(variantId, email); // idempotent
    expect(
      await db.backInStockSubscription.count({ where: { variantId } }),
    ).toBe(1);

    expect(await service.notifyAvailable(variantId)).toBe(0);

    await db.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: 5 },
    });

    expect(await service.notifyAvailable(variantId)).toBe(1);
    expect(sent).toEqual([email]);
    // İkinci tarama aynı aboneye tekrar göndermez.
    expect(await service.notifyAvailable(variantId)).toBe(0);
  });
});
