import "server-only";
import { z } from "zod";
import { features, type Features } from "@/config/features";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.url(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET en az 32 karakter olmalı"),
    DATABASE_URL: z.string().min(1),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    MAIL_FROM: z.string().min(1),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    PAYTR_MERCHANT_ID: optionalString,
    PAYTR_MERCHANT_KEY: optionalString,
    PAYTR_MERCHANT_SALT: optionalString,
    /** Production'da PayTR test modunu açar (canlıya geçmeden önce deneme için) */
    PAYTR_TEST_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    /** Yüklenen dosyaların dizini; varsayılan ./uploads */
    UPLOAD_DIR: optionalString,
    /** features.erp açıkken HTTP JSON bağlayıcının adresi ve anahtarı */
    ERP_STOCK_URL: optionalString,
    ERP_API_KEY: optionalString,
    TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;

    const requiredInProduction = [
      "PAYTR_MERCHANT_ID",
      "PAYTR_MERCHANT_KEY",
      "PAYTR_MERCHANT_SALT",
    ] as const;

    for (const key of requiredInProduction) {
      if (!env[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "production ortamında zorunludur",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Ortam değişkenleri geçersiz:\n- ${issues.join("\n- ")}`);
    this.name = "EnvValidationError";
  }
}

/** Yalnızca ilgili özellik açıksa zorunlu olan anahtarlar. */
function featureIssues(
  env: Env,
  enabled: Pick<Features, "captcha"> & Partial<Pick<Features, "erp">>,
): string[] {
  const issues: string[] = [];

  if (enabled.captcha) {
    for (const key of ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const) {
      if (!env[key]) {
        issues.push(`${key}: captcha özelliği açıkken zorunludur`);
      }
    }
  }

  if (enabled.erp && !env.ERP_STOCK_URL) {
    issues.push("ERP_STOCK_URL: erp özelliği açıkken zorunludur");
  }

  return issues;
}

export function parseEnv(
  source: Record<string, string | undefined>,
  enabled: Pick<Features, "captcha"> &
    Partial<Pick<Features, "erp">> = features,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }

  const issues = featureIssues(result.data, enabled);
  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return result.data;
}

let cachedEnv: Env | undefined;

/** Doğrulanmış ortam değişkenlerini döndürür. Kodda process.env yerine bu kullanılır. */
export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}
