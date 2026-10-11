/** Uygulamanın tüm bilinen hataları bu sınıftan türer. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Geçersiz istek", details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Oturum açmanız gerekiyor") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bu işlem için yetkiniz yok") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Kayıt") {
    super(`${entity} bulunamadı`, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "İşlem mevcut durumla çakışıyor") {
    super(message, "CONFLICT", 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Çok fazla istek gönderdiniz, lütfen bekleyin") {
    super(message, "RATE_LIMITED", 429);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, details?: unknown) {
    super(`${service} servisinden hata alındı`, "EXTERNAL_SERVICE_ERROR", 502, {
      service,
      details,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
