#!/usr/bin/env python3
"""
يدمج مجموعتي Amiri العربية واللاتينية (من @fontsource/amiri) في خط واحد لكل وزن،
فيظهر في PDF العربي الأرقام والرموز والأسماء اللاتينية دون مربعات فارغة.

  pip install fonttools && python3 scripts/build-pdf-fonts.py

الناتج: server/export/fonts/TarteelAmiri-{Regular,Bold}.woff (رخصة OFL: fonts/OFL-Amiri.txt).
"""
from pathlib import Path
import tempfile

from fontTools import merge
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "node_modules" / "@fontsource" / "amiri" / "files"
OUT = ROOT / "server" / "export" / "fonts"

for weight, name in (("400", "Regular"), ("700", "Bold")):
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for subset in ("arabic", "latin"):
            font = TTFont(SRC / f"amiri-{subset}-{weight}-normal.woff")
            font.flavor = None
            path = Path(tmp) / f"{subset}.ttf"
            font.save(path)
            parts.append(str(path))
        merged = merge.Merger().merge(parts)
        merged.flavor = "woff"
        target = OUT / f"TarteelAmiri-{name}.woff"
        merged.save(target)
        print(target.relative_to(ROOT), target.stat().st_size)
