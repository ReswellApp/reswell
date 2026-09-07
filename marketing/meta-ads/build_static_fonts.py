"""
Converts the Stack Sans variable woff2 webfonts into static TTFs so librvsg/pango
(via sharp) can render the ad SVGs with the real brand type.

Each weight becomes its own font family (e.g. "SSHead700") so text rendering never
depends on bold synthesis or fontconfig weight matching.

Usage: python build-static-fonts.py <repo-fonts-dir> <out-dir>
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WEIGHTS = (300, 400, 500, 600, 700)
SOURCES = (
    ("stack-sans-headline-latin.woff2", "SSHead"),
    ("stack-sans-text-latin.woff2", "SSText"),
)

NAME_IDS = {1: None, 2: "Regular", 3: None, 4: None, 6: None, 16: None, 17: None}


def rename(font: TTFont, family: str) -> None:
    table = font["name"]
    for record in list(table.names):
        if record.nameID not in NAME_IDS:
            continue
        if record.nameID == 2:
            value = "Regular"
        elif record.nameID == 6:
            value = f"{family}-Regular"
        else:
            value = family
        table.setName(value, record.nameID, record.platformID, record.platEncID, record.langID)
    # Drop typographic family/subfamily so each file resolves as its own family.
    table.names = [r for r in table.names if r.nameID not in (16, 17)]
    if "OS/2" in font:
        font["OS/2"].usWeightClass = 400
        font["OS/2"].fsSelection = (font["OS/2"].fsSelection & ~0x21) | 0x40


def main() -> int:
    fonts_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    for filename, prefix in SOURCES:
        src = fonts_dir / filename
        for weight in WEIGHTS:
            font = TTFont(src)
            if "fvar" in font:
                font = instantiateVariableFont(font, {"wght": weight}, inplace=True)
            family = f"{prefix}{weight}"
            rename(font, family)
            font.flavor = None
            target = out_dir / f"{family}.ttf"
            font.save(target)
            print(f"✓ {target.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
