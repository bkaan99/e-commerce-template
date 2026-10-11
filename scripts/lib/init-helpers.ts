import { randomBytes } from "node:crypto";
import type { ProjectConfig } from "../../src/config/project-config";
import type { SalesMode } from "../../src/config/site.config";

export interface InitAnswers {
  siteName: string;
  description: string;
  appUrl: string;
  contactEmail: string;
  contactPhone: string;
  salesMode: SalesMode;
  guestCheckout: boolean;
  wishlist: boolean;
  primaryColor: string;
  accentColor: string;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isSalesMode(value: string): value is SalesMode {
  return value === "retail" || value === "b2b" || value === "hybrid";
}

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64");
}

/** Yanıtlardan `project.json` içeriğini üretir. */
export function buildProjectConfig(answers: InitAnswers): ProjectConfig {
  return {
    site: {
      name: answers.siteName,
      description: answers.description,
      salesMode: answers.salesMode,
      contact: { email: answers.contactEmail, phone: answers.contactPhone },
    },
    features: {
      b2b: answers.salesMode !== "retail",
      guestCheckout: answers.guestCheckout,
      wishlist: answers.wishlist,
    },
    theme: {
      colors: { primary: answers.primaryColor, accent: answers.accentColor },
    },
  };
}

/**
 * `.env.example` şablonundaki `ANAHTAR=...` satırlarını verilen değerlerle
 * değiştirir; şablondaki yorum ve sıra korunur.
 */
export function applyEnvValues(
  template: string,
  values: Record<string, string>,
): string {
  return template
    .split("\n")
    .map((line) => {
      const match = /^([A-Z0-9_]+)=/.exec(line);
      const key = match?.[1];
      if (key && key in values) {
        return `${key}=${values[key]}`;
      }
      return line;
    })
    .join("\n");
}
