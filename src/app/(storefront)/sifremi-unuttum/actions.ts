"use server";

import { getAccountService } from "@/modules/account/container";
import { isAppError } from "@/shared/errors";
import { verifyCaptcha } from "@/shared/captcha";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface ForgotState {
  message?: string;
  error?: string;
}

const NEUTRAL_MESSAGE =
  "Bu e-posta ile kayıtlı bir hesap varsa, parola sıfırlama bağlantısı gönderildi.";

export async function forgotPasswordAction(
  _previous: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "E-posta gerekli" };

  try {
    const ip = await getClientIp();
    await enforceRateLimit(
      "password-reset",
      ip,
      RATE_LIMIT_POLICIES.passwordReset,
    );
    await enforceRateLimit(
      "password-reset-email",
      email.toLowerCase(),
      RATE_LIMIT_POLICIES.passwordReset,
    );
    await verifyCaptcha(
      String(formData.get("cf-turnstile-response") ?? "") || null,
      ip,
    );

    await getAccountService().requestPasswordReset(email);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    reportError(error, { action: "forgotPassword" });
    // Hata detayı sızdırılmaz; kullanıcıya yine nötr yanıt verilir.
  }

  return { message: NEUTRAL_MESSAGE };
}
