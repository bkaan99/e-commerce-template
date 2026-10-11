import { describe, expect, it } from "vitest";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  isAppError,
} from "./errors";

describe("errors", () => {
  it("alt sınıflar AppError'dan türer ve doğru HTTP durumunu taşır", () => {
    expect(new ValidationError()).toBeInstanceOf(AppError);
    expect(new ValidationError().httpStatus).toBe(400);
    expect(new ForbiddenError().httpStatus).toBe(403);
    expect(new NotFoundError("Ürün").message).toBe("Ürün bulunamadı");
    expect(new RateLimitError().httpStatus).toBe(429);
  });

  it("hata adı sınıf adıyla eşleşir", () => {
    expect(new NotFoundError().name).toBe("NotFoundError");
  });

  it("isAppError yalnızca AppError için true döner", () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
  });
});
