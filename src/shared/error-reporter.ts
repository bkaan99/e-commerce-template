import { logger } from "./logger";

export interface ErrorContext {
  [key: string]: unknown;
}

/** Yakalanan hataların gönderildiği arayüz. Sentry gibi servisler adapter olarak bağlanır. */
export interface ErrorReporter {
  report(error: unknown, context?: ErrorContext): void;
}

export class ConsoleErrorReporter implements ErrorReporter {
  report(error: unknown, context?: ErrorContext): void {
    logger.error({ err: error, ...context }, "Yakalanan hata");
  }
}

let reporter: ErrorReporter = new ConsoleErrorReporter();

export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

export function reportError(error: unknown, context?: ErrorContext): void {
  reporter.report(error, context);
}
