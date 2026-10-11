"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { RateLimitError } from "@/shared/errors";
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
  const redirectTo = callbackUrl.startsWith("/") ? callbackUrl : "/admin";

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  try {
    const ip = await getClientIp();
    await enforceRateLimit("login:ip", ip, RATE_LIMIT_POLICIES.login);
    await enforceRateLimit("login:email", email, RATE_LIMIT_POLICIES.login);

    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: error.message };
    }
    if (error instanceof AuthError) {
      return { error: "E-posta veya parola hatalı." };
    }
    throw error;
  }

  return {};
}
