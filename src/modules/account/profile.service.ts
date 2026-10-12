import { z } from "zod";
import { ValidationError } from "@/shared/errors";
import type { PasswordHasher } from "../auth/password-hasher";
import { validatePassword } from "../auth/password-policy";
import { normalizeTurkishMobile } from "../checkout/checkout.schema";
import type { AccountRepository } from "./account.service";

export const profileSchema = z.object({
  firstName: z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(60),
  lastName: z.string().trim().min(2, "Soyad en az 2 karakter olmalı").max(60),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const normalized = normalizeTurkishMobile(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Geçerli bir cep telefonu girin",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

export class ProfileService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.accounts.findProfile(userId);
    if (!profile) throw new ValidationError("Hesap bulunamadı");
    return profile;
  }

  async updateProfile(userId: string, raw: unknown): Promise<void> {
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues[0]?.message ?? "Geçersiz bilgi",
      );
    }
    await this.accounts.updateProfile(userId, parsed.data);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.accounts.findById(userId);
    if (!user?.passwordHash)
      throw new ValidationError("Parola değiştirilemedi");

    const valid = await this.hasher.verify(user.passwordHash, currentPassword);
    if (!valid) throw new ValidationError("Mevcut parolanız hatalı");

    const policyError = validatePassword(newPassword);
    if (policyError) throw new ValidationError(policyError);

    if (await this.hasher.verify(user.passwordHash, newPassword)) {
      throw new ValidationError("Yeni parola mevcut parolayla aynı olamaz");
    }

    await this.accounts.updatePassword(
      userId,
      await this.hasher.hash(newPassword),
    );
  }
}
