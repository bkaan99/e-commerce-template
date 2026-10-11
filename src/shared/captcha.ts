import "server-only";
import { isFeatureEnabled } from "@/config/features";
import { ValidationError } from "./errors";
import { getEnv } from "./env";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare Turnstile yanıtını doğrular. `features.captcha` kapalıysa
 * (varsayılan) hiçbir şey yapmaz; açıkken geçersiz yanıt hata fırlatır.
 */
export async function verifyCaptcha(
  token: string | null,
  remoteIp?: string,
): Promise<void> {
  if (!isFeatureEnabled("captcha")) return;

  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY tanımlı değil");
  if (!token) throw new ValidationError("Lütfen robot olmadığınızı doğrulayın");

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await response.json()) as { success?: boolean };

  if (!result.success) {
    throw new ValidationError("Robot doğrulaması başarısız, tekrar deneyin");
  }
}
