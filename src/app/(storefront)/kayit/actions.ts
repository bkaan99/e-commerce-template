"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountService } from "@/modules/account/container";
import { normalizeTurkishMobile } from "@/modules/checkout/checkout.schema";
import { isAppError } from "@/shared/errors";
import { verifyCaptcha } from "@/shared/captcha";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface RegisterState {
  error?: string;
}

const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(60),
  lastName: z.string().trim().min(2, "Soyad en az 2 karakter olmalı").max(60),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Geçerli bir e-posta girin")),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeTurkishMobile(value) : null)),
  password: z.string().max(128),
});

export async function registerAction(
  _previous: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const field = (name: string) => String(formData.get(name) ?? "");

  const parsed = registerSchema.safeParse({
    firstName: field("firstName"),
    lastName: field("lastName"),
    email: field("email"),
    phone: field("phone"),
    password: field("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" };
  }
  if (field("phone").trim() && parsed.data.phone === null) {
    return { error: "Geçerli bir cep telefonu girin" };
  }

  try {
    const ip = await getClientIp();
    await enforceRateLimit("register", ip, RATE_LIMIT_POLICIES.register);
    await verifyCaptcha(field("cf-turnstile-response") || null, ip);

    await getAccountService().register(parsed.data);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    reportError(error, { action: "register" });
    return { error: "Kayıt tamamlanamadı, lütfen tekrar deneyin." };
  }

  redirect("/giris?kayit=1");
}
