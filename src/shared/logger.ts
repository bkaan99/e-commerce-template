import pino, { type Logger } from "pino";

/** Loglara asla yazılmaması gereken alanlar. */
const REDACTED_PATHS = [
  "password",
  "passwordHash",
  "token",
  "secret",
  "authorization",
  "cardNumber",
  "cvv",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.secret",
  "*.authorization",
  "*.cardNumber",
  "*.cvv",
  "req.headers.authorization",
  "req.headers.cookie",
];

export const logger: Logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
  base: undefined,
});

/** İstek/iş bazında korelasyon kimliği taşıyan alt logger. */
export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}

/** Ödeme ve PayTR callback olayları için ayrı bağlamlı logger. */
export const paymentLogger: Logger = logger.child({ context: "payment" });
