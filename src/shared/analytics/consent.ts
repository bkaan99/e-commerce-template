import type { ConsentState } from "./dispatcher";

export const CONSENT_STORAGE_KEY = "cookie-consent";
const CONSENT_EVENT = "cookie-consent-change";

function isConsentState(value: string | null): value is ConsentState {
  return value === "granted" || value === "denied";
}

export function readConsent(): ConsentState {
  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return isConsentState(stored) ? stored : "unknown";
  } catch {
    return "unknown";
  }
}

export function writeConsent(state: Exclude<ConsentState, "unknown">): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // Depolama kapalıysa tercih yalnızca bu oturumda geçerli olur.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** Onay değişimini dinler; aboneliği iptal eden fonksiyon döner. */
export function subscribeConsent(listener: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CONSENT_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
