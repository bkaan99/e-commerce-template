export interface HeaderEntry {
  key: string;
  value: string;
}

/**
 * Güvenlik başlıkları. CSP'de `unsafe-inline` Next.js'in satır içi başlatma
 * betikleri için gerekir; nonce tabanlı CSP tüm sayfaları dinamik yapacağından
 * şimdilik tercih edilmedi.
 */
export function buildSecurityHeaders(isProduction: boolean): HeaderEntry[] {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isProduction ? [] : ["'unsafe-eval'"]),
    "https://challenges.cloudflare.com",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
  ].join(" ");

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.facebook.com",
    "frame-src https://www.paytr.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const headers: HeaderEntry[] = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }

  return headers;
}
