#!/usr/bin/env python3
"""
يبني أيقونات ترتيل الرسمية من الصورة الأصلية branding/tarteel-icon-source.png دون أي تعديل في رسمها:
تصغير بجودة عالية (LANCZOS) وقصّ الإطار الخارجي فقط حيث يلزم، وحفظ بلا فقد (PNG/WebP lossless).

  python3 scripts/build-app-icons.py

- أندرويد التكيّفية (8.0+): الطبقة الأمامية = داخل الأيقونة (دون الحافة البارزة) بنسبة 72 من 108dp،
  فيبقى «ترتيل» كاملاً داخل أي قناع (دائرة، مربع مستدير، squircle)، والخلفية لون من الصورة نفسها.
- أندرويد القديمة: الصورة كما هي (مربع مستدير بزوايا شفافة)، والدائرية = نفسها بقناع دائري.
- الويب: icon-192/512 كما هي، وmaskable داخل المنطقة الآمنة، وapple-touch معتمة.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "branding" / "tarteel-icon-source.png"
RES = ROOT / "mobile-android" / "android" / "app" / "src" / "main" / "res"
WEB = ROOT / "client" / "public" / "icons"
EXPO = ROOT / "mobile-android" / "assets"

# داخل الأيقونة دون الحافة البارزة الخارجية (بكسلات الصورة الأصلية 1069×1083).
INNER = (34, 41, 1034, 1041)
# لون خلفية الطبقة التكيّفية: مأخوذ من حواف داخل الأيقونة؛ لا يظهر إلا في حركات بعض المشغّلات.
BG = (236, 140, 6, 255)
BG_HEX = "#EC8C06"
ADAPTIVE_SCALE = 72 / 108

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def load() -> Image.Image:
    im = Image.open(SRC)
    im.load()
    return im.convert("RGBA")


def fit_square(im: Image.Image, size: int) -> Image.Image:
    """الصورة كاملة كما هي داخل مربع (الصورة 1069×1083: هامش شفاف بكسلات قليلة)."""
    scale = size / max(im.size)
    w, h = round(im.width * scale), round(im.height * scale)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(im.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return out


def inner_on_canvas(im: Image.Image, size: int, scale: float, background=None) -> Image.Image:
    inner = im.crop(INNER)
    s = round(size * scale)
    out = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    out.alpha_composite(inner.resize((s, s), Image.LANCZOS), ((size - s) // 2, (size - s) // 2))
    return out


def circle(im: Image.Image) -> Image.Image:
    big = 4
    mask = Image.new("L", (im.width * big, im.height * big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, mask.width - 1, mask.height - 1), fill=255)
    mask = mask.resize(im.size, Image.LANCZOS)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def webp(im: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", lossless=True, quality=100, method=6, exact=False)


def png(im: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)


def main():
    im = load()
    for name, d in DENSITIES.items():
        legacy = round(48 * d)
        adaptive = round(108 * d)
        webp(fit_square(im, legacy), RES / f"mipmap-{name}" / "ic_launcher.webp")
        # الدائرية: داخل الأيقونة يملأ الدائرة، فيبقى الرسم كاملاً دون زوايا المربع.
        webp(circle(inner_on_canvas(im, legacy, 1.0, BG)), RES / f"mipmap-{name}" / "ic_launcher_round.webp")
        webp(inner_on_canvas(im, adaptive, ADAPTIVE_SCALE), RES / f"mipmap-{name}" / "ic_launcher_foreground.webp")

    png(inner_on_canvas(im, 1024, ADAPTIVE_SCALE), EXPO / "icon-foreground.png")
    png(fit_square(im, 1024), EXPO / "icon.png")

    png(fit_square(im, 192), WEB / "icon-192.png")
    png(fit_square(im, 512), WEB / "icon-512.png")
    png(fit_square(im, 48), WEB / "favicon-48.png")
    # maskable: المحتوى داخل دائرة الأمان (نصف قطر 40%) — نصف قطر الرسم ≈ 0.486 من عرض الداخل.
    png(inner_on_canvas(im, 512, 0.80, BG), WEB / "icon-maskable-512.png")
    png(inner_on_canvas(im, 180, 1.0, BG).convert("RGB"), WEB / "apple-touch-icon.png")
    # أيقونة Google Play (512×512 معتمة؛ Play يدوّر الزوايا بنفسه).
    png(inner_on_canvas(im, 512, 1.0, BG).convert("RGB"), ROOT / "branding" / "play-store-icon-512.png")
    print("colors.xml iconBackground =", BG_HEX)


if __name__ == "__main__":
    main()
