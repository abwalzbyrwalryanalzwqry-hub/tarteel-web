/** بديل node:crypto في النسخة المحلية: نفس الصيغ (scrypt$N$r$p$...) لتبقى كلمات المرور متوافقة مع الخادم عند المزامنة. */
import { Buffer } from "buffer";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

type BinaryLike = string | Uint8Array;
const toBytes = (value: BinaryLike) => (typeof value === "string" ? new TextEncoder().encode(value) : value);

export function randomBytes(size: number): Buffer {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size)));
}

export function randomInt(min: number, max?: number): number {
  const [lo, hi] = max === undefined ? [0, min] : [min, max];
  const range = hi - lo;
  if (!(range > 0)) throw new RangeError("randomInt: invalid range");
  const limit = Math.floor(0xffffffff / range) * range;
  const buf = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return lo + (buf[0] % range);
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

const HASHES = { sha256, sha512 } as const;
type HashName = keyof typeof HASHES;

function digestOutput(bytes: Uint8Array, encoding?: string): Buffer | string {
  const buf = Buffer.from(bytes);
  return encoding ? buf.toString(encoding as BufferEncoding) : buf;
}

export function createHash(algorithm: string) {
  const fn = HASHES[algorithm.toLowerCase() as HashName];
  if (!fn) throw new Error(`Hash ${algorithm} غير مدعوم في النسخة المحلية`);
  const parts: Uint8Array[] = [];
  const api = {
    update(data: BinaryLike) {
      parts.push(toBytes(data));
      return api;
    },
    digest(encoding?: string) {
      const total = Buffer.concat(parts.map((p) => Buffer.from(p)));
      return digestOutput(fn(total), encoding) as never;
    },
  };
  return api;
}

export function createHmac(algorithm: string, key: BinaryLike) {
  const fn = HASHES[algorithm.toLowerCase() as HashName];
  if (!fn) throw new Error(`HMAC ${algorithm} غير مدعوم في النسخة المحلية`);
  const parts: Uint8Array[] = [];
  const api = {
    update(data: BinaryLike) {
      parts.push(toBytes(data));
      return api;
    },
    digest(encoding?: string) {
      const total = Buffer.concat(parts.map((p) => Buffer.from(p)));
      return digestOutput(hmac(fn, toBytes(key), total), encoding) as never;
    },
  };
  return api;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) throw new RangeError("Input buffers must have the same byte length");
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

type ScryptOptions = { N?: number; r?: number; p?: number; maxmem?: number; cost?: number; blockSize?: number; parallelization?: number };
type ScryptCallback = (error: Error | null, key: Buffer) => void;

export function scrypt(password: BinaryLike, salt: BinaryLike, keylen: number, optionsOrCallback: ScryptOptions | ScryptCallback, maybeCallback?: ScryptCallback) {
  const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
  const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback)!;
  const N = options.N ?? options.cost ?? 16384;
  const r = options.r ?? options.blockSize ?? 8;
  const p = options.p ?? options.parallelization ?? 1;
  scryptAsync(toBytes(password), toBytes(salt), { N, r, p, dkLen: keylen, maxmem: Math.max(options.maxmem ?? 0, 128 * N * r * p + 1024 * 1024), asyncTick: 25 })
    .then((key) => callback(null, Buffer.from(key)))
    .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), Buffer.alloc(0)));
}

const webcrypto = globalThis.crypto;
export { webcrypto };
export default { randomBytes, randomInt, randomUUID, createHash, createHmac, timingSafeEqual, scrypt, webcrypto };
