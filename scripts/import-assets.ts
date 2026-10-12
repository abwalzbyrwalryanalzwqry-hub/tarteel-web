/**
 * نسخ ملفات التخزين (صفحات المصحف SVG ومناطق الآيات، التفسير، نص التنزيل، الخطوط، شعارات المراكز)
 * من نسخة ترتيل منشورة إلى مجلد التخزين المحلي، لتُخدم من خادمك تحت /storage/.
 *
 *   pnpm assets:import --from https://old-tarteel.example [--source-prefix /storage/] [--out ./data/uploads] [--keys-file keys.txt]
 *
 * - --source-prefix: مسار الملفات في الخادم المصدر إن اختلف عن /storage/ (في الاستضافة القديمة
 *   كان مسار الملفات مختلفاً؛ مرّره هنا). تُعاد كتابة الروابط داخل ملفات JSON/JS/CSS إلى /storage/.
 * - يكتشف الملفات تلقائياً بدءاً من المراجع في الكود ثم يتتبع الروابط داخل ملفات JSON/JS/CSS.
 * - يتخطى الملفات الموجودة مسبقاً (يمكن إعادة تشغيله بأمان بعد انقطاع)، ويصحح روابطها إن لزم.
 * - --keys-file: مفاتيح إضافية (سطر لكل مفتاح)، مثل logoKey من جدولي centers وreporting_preferences:
 *     SELECT logoKey FROM centers WHERE logoKey IS NOT NULL UNION SELECT logoKey FROM reporting_preferences WHERE logoKey IS NOT NULL;
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const PREFIX = "/storage/";
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const normalizePrefix = (value: string) => `/${value.replace(/^\/+|\/+$/g, "")}/`;
const SOURCE_PREFIX = normalizePrefix(arg("source-prefix", PREFIX)!);
const REF = new RegExp(`(?:${escapeRegExp(PREFIX)}|${escapeRegExp(SOURCE_PREFIX)})([A-Za-z0-9_.\\-/%]+)`, "g");
const rewrite = (buffer: Buffer) => {
  if (SOURCE_PREFIX === PREFIX) return buffer;
  const text = buffer.toString("utf8");
  return text.includes(SOURCE_PREFIX) ? Buffer.from(text.split(SOURCE_PREFIX).join(PREFIX)) : buffer;
};
const TEXT_EXT = new Set([".js", ".json", ".css", ".html"]);
const SOURCE_DIRS = ["client", "shared", "server"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".css", ".html", ".js", ".json"]);

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.has(path.extname(entry.name))) yield full;
  }
}

function extractKeys(text: string) {
  const keys: string[] = [];
  for (const match of text.matchAll(REF)) {
    const key = decodeURIComponent(match[1]).replace(/[.,;]+$/, "");
    // تجاهل القوالب مثل ${...} في ملفات الاختبار
    if (key && !key.includes("${") && !key.includes("..")) keys.push(key);
  }
  return keys;
}

async function main() {
  const from = arg("from")?.replace(/\/+$/, "");
  if (!from) throw new Error("--from مطلوب (رابط نسخة ترتيل المصدر)");
  const out = path.resolve(arg("out", process.env.STORAGE_DIR ?? "./data/uploads")!);
  const concurrency = Number(arg("concurrency", "8"));
  await fs.mkdir(out, { recursive: true });

  const queue = new Set<string>();
  for (const dir of SOURCE_DIRS) {
    for await (const file of walk(dir)) {
      if (file.includes(".test.")) continue;
      for (const key of extractKeys(await fs.readFile(file, "utf8"))) queue.add(key);
    }
  }
  const keysFile = arg("keys-file");
  if (keysFile) for (const line of (await fs.readFile(keysFile, "utf8")).split(/\r?\n/)) if (line.trim()) queue.add(line.trim().replace(/^\/+/, "").replace(SOURCE_PREFIX.slice(1), "").replace(PREFIX.slice(1), ""));

  const done = new Set<string>();
  const failed: string[] = [];
  let downloaded = 0, skipped = 0, bytes = 0;

  async function handle(key: string) {
    const target = path.resolve(out, key);
    if (!target.startsWith(out + path.sep)) return;
    let content: Buffer | null = null;
    const exists = await fs.stat(target).then((s) => s.isFile() && s.size > 0).catch(() => false);
    if (exists) {
      skipped++;
      if (TEXT_EXT.has(path.extname(key))) {
        const original = await fs.readFile(target);
        content = rewrite(original);
        if (content !== original) await fs.writeFile(target, content);
      }
    } else {
      for (let attempt = 1; attempt <= 3 && !content; attempt++) {
        try {
          const res = await fetch(`${from}${SOURCE_PREFIX}${encodeURI(key)}`, { redirect: "follow" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          content = Buffer.from(await res.arrayBuffer());
          if (TEXT_EXT.has(path.extname(key))) content = rewrite(content);
        } catch (error) {
          if (attempt === 3) { failed.push(`${key} (${(error as Error).message})`); return; }
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
      if (!content) return;
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(`${target}.part`, content);
      await fs.rename(`${target}.part`, target);
      downloaded++; bytes += content.length;
    }
    if (content && TEXT_EXT.has(path.extname(key))) {
      for (const ref of extractKeys(content.toString("utf8"))) if (!done.has(ref)) queue.add(ref);
    }
  }

  while (queue.size) {
    const batch = Array.from(queue).filter((k) => !done.has(k));
    queue.clear();
    for (let i = 0; i < batch.length; i += concurrency) {
      const slice = batch.slice(i, i + concurrency);
      slice.forEach((k) => done.add(k));
      await Promise.all(slice.map(handle));
      if (process.stdout.isTTY) process.stdout.write(`\r  ${done.size} ملفاً — نُزّل ${downloaded}، موجود ${skipped}، فشل ${failed.length}`);
    }
  }

  console.log(`\n✓ اكتمل النسخ إلى ${out}: ${done.size} ملفاً (${(bytes / 1048576).toFixed(1)} MB جديدة).`);
  if (failed.length) {
    console.log(`✗ تعذر نسخ ${failed.length}:\n  ${failed.slice(0, 30).join("\n  ")}`);
    process.exit(2);
  }
}

main().catch((error) => { console.error("✗", error instanceof Error ? error.message : error); process.exit(1); });
