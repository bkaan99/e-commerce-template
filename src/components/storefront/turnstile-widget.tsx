import Script from "next/script";
import { isFeatureEnabled } from "@/config/features";
import { getEnv } from "@/shared/env";

/**
 * Cloudflare Turnstile bileşeni. `features.captcha` kapalıysa hiçbir şey çizmez.
 * Doğrulama belirteci formda `cf-turnstile-response` alanı olarak gönderilir.
 */
export function TurnstileWidget() {
  if (!isFeatureEnabled("captcha")) return null;

  const siteKey = getEnv().TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="cf-turnstile" data-sitekey={siteKey} />
    </>
  );
}
