/**
 * Vergi kimlik numarası (VKN) doğrulaması: 10 hane ve resmî sağlama algoritması.
 */
export function isValidVkn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 9; i += 1) {
    const tmp = (digits[i]! + (9 - i)) % 10;
    let result = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && result === 0) result = 9;
    sum += result;
  }

  const check = (10 - (sum % 10)) % 10;
  return check === digits[9];
}

/** İlk 9 haneden sağlama hanesini üretir (test ve örnek veri için). */
export function vknCheckDigit(firstNine: string): number {
  if (!/^\d{9}$/.test(firstNine)) throw new Error("9 haneli sayı bekleniyor");

  const digits = firstNine.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    const tmp = (digits[i]! + (9 - i)) % 10;
    let result = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && result === 0) result = 9;
    sum += result;
  }
  return (10 - (sum % 10)) % 10;
}
