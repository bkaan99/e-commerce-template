/**
 * Oturum çerezinin adı. Varsayılan `authjs.session-token` adı aynı makinede
 * (localhost) çalışan başka Auth.js projeleriyle çakışıp "no matching
 * decryption secret" hatası ürettiğinden bu şablona özgü bir ad kullanılır.
 */
export const SESSION_COOKIE_NAME = "ecommerce.session-token";
export const SECURE_SESSION_COOKIE_NAME = `__Secure-${SESSION_COOKIE_NAME}`;

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE_NAME : SESSION_COOKIE_NAME;
}
