"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { RateLimitError, isAppError } from "@/shared/errors";
import { verifyCaptcha } from "@/shared/captcha";
import {
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  getClientIp,
} from "@/shared/rate-limit";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "");
  // Açık yönlendirmeyi önlemek için yalnızca site içi yollar kabul edilir.
  const redirectTo =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/hesabim";

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  try {
    const ip = await getClientIp();
    await enforceRateLimit("login:ip", ip, RATE_LIMIT_POLICIES.login);
    await enforceRateLimit("login:email", email, RATE_LIMIT_POLICIES.login);
    await verifyCaptcha(
      String(formData.get("cf-turnstile-response") ?? "") || null,
      ip,
    );

    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (error) {
    if (error instanceof RateLimitError || isAppError(error)) {
      return { error: error.message };
    }
    if (error instanceof AuthError) {
      return { error: "E-posta veya parola hatalı." };
    }
    throw error;
  }

  return {};
}
