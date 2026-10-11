"use server";

import { redirect } from "next/navigation";
import { getAccountService } from "@/modules/account/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface ResetState {
  error?: string;
}

export async function resetPasswordAction(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "Parolalar eşleşmiyor" };

  try {
    const ip = await getClientIp();
    await enforceRateLimit(
      "password-reset",
      ip,
      RATE_LIMIT_POLICIES.passwordReset,
    );
    await getAccountService().resetPassword(token, password);
  } catch (error) {
    if (isAppError(error)) return { error: error.message };
    reportError(error, { action: "resetPassword" });
    return { error: "Parola sıfırlanamadı, lütfen tekrar deneyin." };
  }

  redirect("/giris?sifre=1");
}
