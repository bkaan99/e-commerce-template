import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Durumsuz, süreli ve imzalı belirteç (e-posta doğrulama, şifre sıfırlama).
 * Biçim: base64url(payload JSON) + "." + base64url(HMAC-SHA256).
 */
export interface TokenPayload {
  /** Amaç: farklı akışların belirteçleri birbirinin yerine kullanılamaz */
  purpose: string;
  subject: string;
  /** Bitiş zamanı (epoch saniye) */
  exp: number;
  /** İsteğe bağlı bağlam (örn. şifre özeti); değişirse belirteç geçersiz olur */
  ctx?: string;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSignedToken(
  payload: Omit<TokenPayload, "exp">,
  options: { secret: string; ttlSeconds: number; now?: Date },
): string {
  const now = options.now ?? new Date();
  const full: TokenPayload = {
    ...payload,
    exp: Math.floor(now.getTime() / 1000) + options.ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${sign(body, options.secret)}`;
}

export type TokenVerification =
  | { valid: true; payload: TokenPayload }
  | { valid: false; reason: "malformed" | "signature" | "expired" | "purpose" };

export function verifySignedToken(
  token: string,
  options: { secret: string; purpose: string; now?: Date },
): TokenVerification {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) {
    return { valid: false, reason: "malformed" };
  }

  const expected = Buffer.from(sign(body, options.secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { valid: false, reason: "signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (payload.purpose !== options.purpose) {
    return { valid: false, reason: "purpose" };
  }

  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (payload.exp < now) return { valid: false, reason: "expired" };

  return { valid: true, payload };
}
