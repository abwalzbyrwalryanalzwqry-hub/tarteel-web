/**
 * إعداد التحقق عبر واتساب وفحصه من الخادم.
 *
 *   docker compose exec app node dist/whatsapp-setup.js token       # يولّد WHATSAPP_VERIFY_TOKEN
 *   docker compose exec app node dist/whatsapp-setup.js check       # يفحص .env وWebhook وGraph API
 *   docker compose exec app node dist/whatsapp-setup.js subscribe   # يشترك التطبيق في WABA (لازم مرة واحدة)
 *
 * خيار: --url https://… لفحص Webhook على عنوان غير PUBLIC_APP_URL.
 * محلياً: pnpm whatsapp:check (و pnpm whatsapp:setup subscribe).
 */
import "dotenv/config";
import {
  checkEnv,
  checkGraph,
  checkWebhook,
  generateVerifyToken,
  subscribeApp,
  type CheckResult,
} from "../server/_core/whatsappSetup";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

function print(section: string, results: CheckResult[]) {
  console.log(`\n${section}`);
  for (const result of results)
    console.log(
      `  ${result.ok ? "✓" : "✗"} ${result.label}${result.detail ? ` — ${result.detail}` : ""}`
    );
  return results.every(result => result.ok);
}

async function main() {
  const command = process.argv[2] ?? "check";
  if (command === "token") {
    console.log(generateVerifyToken());
    return 0;
  }
  if (command === "subscribe") {
    const result = await subscribeApp(process.env);
    print("اشتراك التطبيق في WABA", [result]);
    if (result.ok) print("التحقق", await checkGraph(process.env));
    return result.ok ? 0 : 1;
  }
  if (command !== "check") {
    console.error("الأوامر: token | check | subscribe");
    return 2;
  }
  const envOk = print("متغيرات البيئة", checkEnv(process.env));
  const base = arg("url") ?? process.env.PUBLIC_APP_URL ?? "";
  const webhookOk = base
    ? print("Webhook", await checkWebhook(base, process.env))
    : false;
  // فحوص Graph اختيارية: غيابها لا يُفشل الفحص لأن التحقق يعمل بدون رمز وصول.
  const graph = await checkGraph(process.env);
  print("Meta Graph API", graph);
  const ok = envOk && webhookOk;
  console.log(
    ok
      ? "\nجاهز. جرّب: «حساب جديد ← برقم الهاتف ← تحقق من الرقم عبر واتساب»."
      : "\nأصلح البنود المعلّمة بـ ✗ ثم أعد الفحص."
  );
  return ok ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
