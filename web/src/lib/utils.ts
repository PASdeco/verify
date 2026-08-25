import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** EAN-8/EAN-13/UPC-A/UPC-E check-digit validation (GTIN). */
export function isValidGtin(raw: string): boolean {
  const code = raw.trim();
  if (!/^\d{6,18}$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) {
    // 6-7 and 15-18 digit codes: accept structurally but no check digit rule
    return code.length >= 6 && code.length <= 18;
  }
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const weight = (digits.length - i) % 2 === 0 ? 1 : 3;
    sum += digits[i] * weight;
  }
  return (10 - (sum % 10)) % 10 === check;
}

export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}
