import { createHash, randomBytes } from "node:crypto";

export function normalizeAccessCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function hashAccessCode(value: string) {
  return createHash("sha256").update(normalizeAccessCode(value)).digest("hex");
}

export function createAccessCodeSecret() {
  const entropy = randomBytes(10).toString("hex").toUpperCase();
  return `TRT-${entropy.slice(0, 5)}-${entropy.slice(5, 10)}-${entropy.slice(10, 15)}-${entropy.slice(15, 20)}`;
}

export function getAccessCodeHint(code: string) {
  return `••••${normalizeAccessCode(code).slice(-4)}`;
}
