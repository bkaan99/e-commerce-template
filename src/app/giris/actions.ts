"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "");
  const redirectTo = callbackUrl.startsWith("/") ? callbackUrl : "/admin";

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "E-posta veya parola hatalı." };
    }
    throw error;
  }

  return {};
}
