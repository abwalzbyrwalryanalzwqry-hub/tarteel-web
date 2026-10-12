/**
 * إنشاء المدير العام لترتيل أو إصدار رابط تعيين كلمة مرور لمستخدم موجود.
 *
 *   pnpm auth:create-admin --email you@example.com --name "اسمك" [--password ...]
 *   pnpm auth:setup-link --email old-user@example.com        # لمستخدم قديم بلا كلمة مرور
 *   pnpm auth:setup-link --user-id 42
 *
 * إن لم تُمرَّر --password تُولَّد كلمة مرور قوية وتُطبع مرة واحدة.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { createLocalUser, createPasswordSetupToken } from "../server/auth/localAuth";
import { getPasswordPolicyError, normalizeEmail } from "../server/auth/password";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const command = process.argv[2];
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL غير مضبوط أو قاعدة البيانات غير متاحة");
  const baseUrl = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  if (command === "create-admin") {
    const email = arg("email");
    const name = arg("name") ?? "المدير العام";
    if (!email) throw new Error("--email مطلوب");
    const password = arg("password") ?? `${randomBytes(9).toString("base64url")}9a`;
    const policy = getPasswordPolicyError(password);
    if (policy) throw new Error(policy);
    const user = await createLocalUser({ name, email, password, role: "admin" });
    console.log(`✓ أُنشئ المدير العام #${user.id} (${normalizeEmail(email)})`);
    if (!arg("password")) console.log(`  كلمة المرور المؤقتة: ${password}\n  غيّرها من «الإعدادات» بعد أول دخول.`);
    process.exit(0);
  }

  if (command === "setup-link") {
    const email = arg("email");
    const userId = arg("user-id");
    const row = userId
      ? (await db.select().from(users).where(eq(users.id, Number(userId))).limit(1))[0]
      : email
        ? (await db.select().from(users).where(and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt))).limit(1))[0]
        : undefined;
    if (!row) throw new Error("المستخدم غير موجود (استخدم --email أو --user-id)");
    const link = await createPasswordSetupToken(row.id, null);
    console.log(`✓ رابط تعيين كلمة المرور للمستخدم #${row.id} ${row.name ?? ""} (صالح ${link.expiresInHours} ساعة، مرة واحدة):`);
    console.log(`  ${baseUrl || "https://YOUR-DOMAIN"}${link.path}`);
    process.exit(0);
  }

  console.log("الاستخدام: tsx scripts/create-admin.ts create-admin --email ... [--name ...] [--password ...]\n           tsx scripts/create-admin.ts setup-link (--email ... | --user-id ...)");
  process.exit(1);
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});
