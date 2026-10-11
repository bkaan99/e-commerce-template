export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

/** Parola kuralları; ihlal varsa Türkçe hata mesajı döndürür, yoksa null. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return "Parola çok uzun";
  }
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/\d/.test(password)) {
    return "Parola en az bir harf ve bir rakam içermeli";
  }
  return null;
}
