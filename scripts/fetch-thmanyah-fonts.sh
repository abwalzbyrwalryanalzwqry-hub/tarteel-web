#!/usr/bin/env bash
# يجلب خطوط ثمانية الرسمية لبناء تطبيق أندرويد فقط، من المستودعين الخاصين:
#   manar-fonts: Thmanyah Sans (5 أوزان) و Thmanyah Serif Display (عادي وعريض)
#   zen-fonts:   Thmanyah Serif Text (5 أوزان) — خط هوية ترتيل للنصوص
# ترخيص ثمانية (https://font.thmanyah.com/licenses) يجيز تضمين الخط داخل التطبيق ويمنع رفع ملفاته
# أو استضافتها؛ لذلك لا تُحفظ في هذا المستودع (.gitignore) ولا تُجلب في بناء نسخة الويب.
#
# المصادر (أيها وُجد):
#   TARTEEL_MANAR_FONTS_KEY / TARTEEL_ZEN_FONTS_KEY  مفتاحا نشر للقراءة فقط (أسرار GitHub)
#   TARTEEL_MANAR_FONTS_DIR / TARTEEL_ZEN_FONTS_DIR  مجلدان محليان فيهما الملفات (للتطوير)
# TARTEEL_REQUIRE_FONTS=true يجعل غياب أي ملف خطأً يوقف البناء (بناء main والإصدار).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/client/public/fonts/thmanyah"
OWNER="abwalzbyrwalryanalzwqry-hub"
REQUIRE="${TARTEEL_REQUIRE_FONTS:-false}"

MANAR_FILES=(
  thmanyah-sans-Light.woff2 thmanyah-sans-Regular.woff2 thmanyah-sans-Medium.woff2
  thmanyah-sans-Bold.woff2 thmanyah-sans-Black.woff2
  thmanyah-serif-display-Regular.woff2 thmanyah-serif-display-Bold.woff2
)
ZEN_FILES=(
  thmanyahseriftext-Light.woff2 thmanyahseriftext-Regular.woff2 thmanyahseriftext-Medium.woff2
  thmanyahseriftext-Bold.woff2 thmanyahseriftext-Black.woff2
)

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

fail_or_skip() {
  if [ "$REQUIRE" = "true" ]; then echo "::error::$1"; exit 1; fi
  echo "::warning::$1 — يُبنى التطبيق بالخطوط البديلة."
  echo "fetched=false" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
}

# يضع مصدر المستودع $1 في المجلد $2 (من مجلد محلي أو باستنساخ بمفتاح النشر).
source_repo() {
  local repo="$1" out="$2" dir="$3" key="$4"
  if [ -n "$dir" ]; then
    [ -d "$dir" ] || fail_or_skip "المجلد $dir غير موجود"
    cp -R "$dir/." "$out/"
  elif [ -n "$key" ]; then
    local keyfile="$TMP/$repo.key"
    printf '%s\n' "$key" > "$keyfile"
    chmod 600 "$keyfile"
    GIT_SSH_COMMAND="ssh -i $keyfile -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
      git clone --quiet --depth 1 "git@github.com:$OWNER/$repo.git" "$out" \
      || fail_or_skip "تعذّر جلب $repo"
    rm -f "$keyfile"
  else
    fail_or_skip "لا مفتاح ولا مجلد لمستودع $repo"
  fi
}

mkdir -p "$TMP/manar" "$TMP/zen"
source_repo manar-fonts "$TMP/manar" "${TARTEEL_MANAR_FONTS_DIR:-}" "${TARTEEL_MANAR_FONTS_KEY:-}"
source_repo zen-fonts "$TMP/zen" "${TARTEEL_ZEN_FONTS_DIR:-}" "${TARTEEL_ZEN_FONTS_KEY:-}"

# سلامة ملفات منار من SHA256SUMS المنشور معها.
if [ -f "$TMP/manar/SHA256SUMS" ]; then
  (cd "$TMP/manar" && grep -E "  ($(IFS='|'; echo "${MANAR_FILES[*]}"))$" SHA256SUMS | sha256sum -c --quiet -) \
    || fail_or_skip "فشل التحقق من SHA256SUMS لخطوط منار"
fi

mkdir -p "$DEST"
copied=0
for f in "${MANAR_FILES[@]}"; do src="$TMP/manar/$f"; [ -s "$src" ] || fail_or_skip "الملف $f غير موجود في manar-fonts"; cp "$src" "$DEST/$f"; copied=$((copied + 1)); done
for f in "${ZEN_FILES[@]}"; do src="$TMP/zen/$f"; [ -s "$src" ] || fail_or_skip "الملف $f غير موجود في zen-fonts"; cp "$src" "$DEST/$f"; copied=$((copied + 1)); done

# كل ملف WOFF2 يبدأ بالتوقيع wOF2.
for f in "$DEST"/*.woff2; do
  [ "$(head -c 4 "$f")" = "wOF2" ] || fail_or_skip "الملف $(basename "$f") ليس WOFF2 صالحاً"
done

echo "تم جلب $copied ملف خط من خطوط ثمانية إلى client/public/fonts/thmanyah"
echo "fetched=true" >> "${GITHUB_OUTPUT:-/dev/null}"
