/** بديل node:util المحدود: promisify فقط (المستخدمة مع scrypt). */
type Callback<T> = (error: Error | null, value: T) => void;

export function promisify<T>(fn: (...args: never[]) => void) {
  return (...args: unknown[]) =>
    new Promise<T>((resolve, reject) => {
      (fn as unknown as (...a: unknown[]) => void)(...args, ((error, value) => (error ? reject(error) : resolve(value))) as Callback<T>);
    });
}

export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export default { promisify, TextEncoder, TextDecoder };
