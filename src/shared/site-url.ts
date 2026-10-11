import "server-only";
import { getEnv } from "./env";

export function getSiteUrl(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
