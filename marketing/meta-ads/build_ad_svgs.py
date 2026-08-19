"""
Builds the Reswell giveaway Meta ad creatives as SVG.

All copy is shaped with HarfBuzz against the real Stack Sans webfonts and emitted as
vector outlines, so the artwork carries exact brand typography without depending on
installed system fonts. Creatives are type, colour, and drawn shapes only — no photography.

Usage: python build_ad_svgs.py <out-dir> <static-fonts-dir>
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

# Brand tokens mirrored from tailwind.config.ts
INK = "#04070E"
BRAND = "#355185"
DEEP = "#001A4A"
ABYSS = "#041730"
SKY = "#8FB0E0"
OFFWHITE = "#F8FAFC"
BORDER = "#E2E8F0"
MUTED = "#64748B"
WHITE = "#FFFFFF"

DEADLINE = "September 30"
DRAW_DATE = "October 3"
SITE = "reswell.com/giveaways"

BRANDS = [
    "Channel Islands",
    "Lost",
    "JS",
    "Sharpeye",
    "Hayden Shapes",
    "Lovemachine",
]


class Face:
    """A single weight of a Stack Sans cut, ready to shape and outline."""

    def __init__(self, path: Path):
        data = path.read_bytes()
        self.tt = TTFont(path)
        self.upem = self.tt["head"].unitsPerEm
        self.ascent = self.tt["hhea"].ascent / self.upem
        self.descent = abs(self.tt["hhea"].descent) / self.upem
        self.glyphset = self.tt.getGlyphSet()
        self.order = self.tt.getGlyphOrder()
        self.hb_font = hb.Font(hb.Face(data))
        self._outlines: dict[str, str] = {}

    def outline(self, name: str) -> str:
        if name not in self._outlines:
            pen = SVGPathPen(self.glyphset)
            self.glyphset[name].draw(pen)
            self._outlines[name] = pen.getCommands()
        return self._outlines[name]

    def shape(self, text: str, size: float, tracking: float = 0.0):
        """Returns (glyphs, width) where glyphs are (glyph_name, x, y) in px."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf, {"kern": True, "liga": True})

        scale = size / self.upem
        glyphs = []
        x = 0.0
        infos = buf.glyph_infos
        for i, (info, pos) in enumerate(zip(infos, buf.glyph_positions)):
            name = self.order[info.codepoint]
            glyphs.append((name, x + pos.x_offset * scale, pos.y_offset * scale))
            x += pos.x_advance * scale
            if i < len(infos) - 1:
                x += tracking
        return glyphs, x

    def measure(self, text: str, size: float, tracking: float = 0.0) -> float:
        return self.shape(text, size, tracking)[1]

    def draw(
        self,
        text: str,
        size: float,
        x: float,
        baseline: float,
        fill: str,
        tracking: float = 0.0,
        opacity: float | None = None,
    ) -> str:
        glyphs, _ = self.shape(text, size, tracking)
        scale = size / self.upem
        parts = []
        for name, gx, gy in glyphs:
            d = self.outline(name)
            if not d:
                continue
            px = round(x + gx, 2)
            py = round(baseline - gy, 2)
            parts.append(
                f'<path transform="translate({px} {py}) scale({scale:.6f} {-scale:.6f})" d="{d}"/>'
            )
        if not parts:
            return ""
        op = f' opacity="{opacity}"' if opacity is not None else ""
        return f'<g fill="{fill}"{op}>' + "".join(parts) + "</g>"

    def wrap(self, text: str, size: float, max_width: float, tracking: float = 0.0):
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and self.measure(candidate, size, tracking) > max_width:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines


@dataclass
class Fonts:
    head: dict[int, Face]
    text: dict[int, Face]

    @classmethod
    def load(cls, fonts_dir: Path) -> "Fonts":
        weights = (300, 400, 500, 600, 700)
        return cls(
            head={w: Face(fonts_dir / f"SSHead{w}.ttf") for w in weights},
            text={w: Face(fonts_dir / f"SSText{w}.ttf") for w in weights},
        )


@dataclass
class Size:
    id: str
    w: int
    h: int
    pad: int
    scale: float
    safe_top: int = 0
    safe_bottom: int = 0
    # Share of leftover space pulled off the bottom so tall crops are not top-heavy.
    lift: float = 0.0


SIZES = [
    Size("1080x1080", 1080, 1080, pad=82, scale=0.92),
    Size("1080x1350", 1080, 1350, pad=92, scale=1.0, lift=0.4),
    Size(
        "1080x1920",
        1080,
        1920,
        pad=92,
        scale=1.06,
        safe_top=200,
        safe_bottom=290,
        lift=0.45,
    ),
]


@dataclass
class Canvas:
    """Collects SVG fragments and tracks a vertical cursor for stacked blocks."""

    size: Size
    fonts: Fonts
    body: list[str] = field(default_factory=list)
    defs: list[str] = field(default_factory=list)
    y: float = 0.0

    @property
    def left(self) -> float:
        return self.size.pad

    @property
    def content_width(self) -> float:
        return self.size.w - self.size.pad * 2

    def add(self, fragment: str) -> None:
        if fragment:
            self.body.append(fragment)

    def line_metrics(self, face: Face, size: float, line_height: float):
        box = size * line_height
        inner = (face.ascent + face.descent) * size
        offset = (box - inner) / 2 + face.ascent * size
        return box, offset

    def paragraph(
        self,
        face: Face,
        lines: list[tuple[str, str]] | list[str],
        size: float,
        line_height: float,
        fill: str = INK,
        tracking: float = 0.0,
        opacity: float | None = None,
        measure_only: bool = False,
    ) -> float:
        box, offset = self.line_metrics(face, size, line_height)
        for entry in lines:
            text, colour = entry if isinstance(entry, tuple) else (entry, fill)
            if not measure_only:
                self.add(
                    face.draw(
                        text, size, self.left, self.y + offset, colour, tracking, opacity
                    )
                )
            self.y += box
        return box * len(lines)

    def gap(self, amount: float) -> None:
        self.y += amount

    def pill(
        self,
        label: str,
        size: float,
        bg: str,
        fg: str,
        pad_x: float,
        pad_y: float,
        weight: int = 500,
    ) -> None:
        face = self.fonts.text[weight]
        text_w = face.measure(label, size)
        arrow_w = size * 0.78
        gap = size * 0.5
        inner = (face.ascent + face.descent) * size
        height = inner + pad_y * 2
        width = text_w + gap + arrow_w + pad_x * 2
        top = self.y
        radius = height / 2
        self.add(
            f'<rect x="{self.left:.1f}" y="{top:.1f}" width="{width:.1f}" '
            f'height="{height:.1f}" rx="{radius:.1f}" fill="{bg}"/>'
        )
        baseline = top + pad_y + face.ascent * size
        self.add(face.draw(label, size, self.left + pad_x, baseline, fg))
        # Arrow, drawn rather than iconified so the creative stays vector-only.
        ax = self.left + pad_x + text_w + gap
        ay = top + height / 2
        half = arrow_w / 2
        stroke = max(2.4, size * 0.075)
        self.add(
            f'<g stroke="{fg}" stroke-width="{stroke:.2f}" stroke-linecap="round" '
            f'stroke-linejoin="round" fill="none">'
            f'<path d="M{ax:.1f} {ay:.1f} H{ax + arrow_w:.1f}"/>'
            f'<path d="M{ax + arrow_w - half * 0.62:.1f} {ay - half * 0.62:.1f} '
            f"L{ax + arrow_w:.1f} {ay:.1f} "
            f'L{ax + arrow_w - half * 0.62:.1f} {ay + half * 0.62:.1f}"/>'
            f"</g>"
        )
        self.y = top + height

    def render(self, background: str) -> str:
        defs = f"<defs>{''.join(self.defs)}</defs>" if self.defs else ""
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.size.w}" '
            f'height="{self.size.h}" viewBox="0 0 {self.size.w} {self.size.h}">'
            f"{defs}{background}{''.join(self.body)}</svg>"
        )


def swell_lines(size: Size, stroke: str, opacity: float) -> str:
    """Drawn swell strokes — decoration without using any imagery."""
    w, h = size.w, size.h
    paths = []
    for i, t in enumerate((0.30, 0.40, 0.50, 0.60, 0.70)):
        y = h * t
        amp = 60 + i * 16
        paths.append(
            f'<path d="M{-w * 0.08:.0f} {y:.0f} C {w * 0.28:.0f} {y - amp:.0f}, '
            f"{w * 0.58:.0f} {y + amp:.0f}, {w * 1.08:.0f} {y - amp * 0.35:.0f}\" "
            f'fill="none" stroke="{stroke}" stroke-width="{3 + i * 0.7:.1f}" '
            f'stroke-linecap="round" opacity="{opacity}"/>'
        )
    return "".join(paths)


def wordmark(c: Canvas, fill: str) -> None:
    face = c.fonts.head[700]
    size = 33 * c.size.scale
    baseline = c.size.pad + c.size.safe_top + face.ascent * size
    c.add(face.draw("RESWELL", size, c.left, baseline, fill, tracking=-0.01 * size))


def place_stack(c: Canvas, blocks_height: float) -> None:
    """Anchors the copy block to the bottom safe edge, lifted for taller crops."""
    wordmark_zone = c.size.pad + c.size.safe_top + 33 * c.size.scale * 1.3 + 48 * c.size.scale
    bottom = c.size.h - c.size.pad - c.size.safe_bottom
    y = bottom - blocks_height
    free = y - wordmark_zone
    if free > 0:
        y -= free * c.size.lift
    c.y = y


# --------------------------------------------------------------------------- #
# Creatives                                                                    #
# --------------------------------------------------------------------------- #


def hero_ad(size: Size, fonts: Fonts) -> str:
    """A — the page headline, deep-ocean gradient, one clear action."""
    c = Canvas(size, fonts)
    s = size.scale
    c.defs.append(
        f'<linearGradient id="g" x1="0" y1="0" x2="0.75" y2="1">'
        f'<stop offset="0" stop-color="{ABYSS}"/>'
        f'<stop offset="0.45" stop-color="{DEEP}"/>'
        f'<stop offset="1" stop-color="{BRAND}"/></linearGradient>'
    )
    bg = (
        f'<rect width="{size.w}" height="{size.h}" fill="url(#g)"/>'
        + swell_lines(size, WHITE, 0.13)
    )

    def stack(measure_only: bool = False) -> float:
        start = c.y
        c.paragraph(
            fonts.text[600],
            [f"Giveaway · Ends {DEADLINE}"],
            19 * s,
            1.2,
            "#FFFFFF",
            tracking=0.2 * 19 * s,
            opacity=0.72,
            measure_only=measure_only,
        )
        c.gap(22 * s)
        c.paragraph(
            fonts.head[700],
            ["List a board.", "Win a custom."],
            116 * s,
            0.98,
            WHITE,
            tracking=-0.035 * 116 * s,
            measure_only=measure_only,
        )
        c.gap(28 * s)
        c.paragraph(
            fonts.text[300],
            fonts.text[300].wrap(
                "Publish a surfboard on Reswell and you\u2019re entered to win a custom "
                "from the shaper you pick.",
                36 * s,
                c.content_width * 0.86,
            ),
            36 * s,
            1.34,
            WHITE,
            opacity=0.88,
            measure_only=measure_only,
        )
        c.gap(46 * s)
        if measure_only:
            c.y += (fonts.text[500].ascent + fonts.text[500].descent) * 33 * s + 30 * s * 2
        else:
            c.pill("List a surfboard to enter", 33 * s, WHITE, INK, 46 * s, 30 * s)
        c.gap(32 * s)
        c.paragraph(
            fonts.text[300],
            [
                f"Free to list. No sale required. Winner drawn {DRAW_DATE}.",
                SITE,
            ],
            21 * s,
            1.45,
            WHITE,
            opacity=0.62,
            measure_only=measure_only,
        )
        return c.y - start

    c.y = 0
    height = stack(measure_only=True)
    c.body.clear()
    place_stack(c, height)
    stack()
    wordmark(c, WHITE)
    return c.render(bg)


def brands_ad(size: Size, fonts: Fonts) -> str:
    """B — mirrors the on-page brand picker so the ad matches the landing page."""
    c = Canvas(size, fonts)
    s = size.scale
    bg = f'<rect width="{size.w}" height="{size.h}" fill="{OFFWHITE}"/>'

    chip_h = 84 * s
    chip_gap = 18 * s
    chips_h = chip_h * 3 + chip_gap * 2

    def chips(measure_only: bool) -> None:
        if measure_only:
            c.y += chips_h
            return
        col_w = (c.content_width - chip_gap) / 2
        face = fonts.text[600]
        fsize = 29 * s
        for i, name in enumerate(BRANDS):
            row, col = divmod(i, 2)
            x = c.left + col * (col_w + chip_gap)
            y = c.y + row * (chip_h + chip_gap)
            selected = name == "Hayden Shapes"
            fill = BRAND if selected else WHITE
            stroke = BRAND if selected else BORDER
            colour = WHITE if selected else INK
            c.add(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{col_w:.1f}" height="{chip_h:.1f}" '
                f'rx="{26 * s:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
            )
            baseline = y + chip_h / 2 + face.ascent * fsize - (face.ascent + face.descent) * fsize / 2
            c.add(face.draw(name, fsize, x + 28 * s, baseline, colour))
            if selected:
                cx = x + col_w - 46 * s
                cy = y + chip_h / 2
                r = 9 * s
                c.add(
                    f'<path d="M{cx - r:.1f} {cy:.1f} L{cx - r * 0.25:.1f} {cy + r * 0.7:.1f} '
                    f'L{cx + r:.1f} {cy - r * 0.75:.1f}" fill="none" stroke="{WHITE}" '
                    f'stroke-width="{3.2 * s:.1f}" stroke-linecap="round" stroke-linejoin="round"/>'
                )
        c.y += chips_h

    def stack(measure_only: bool = False) -> float:
        start = c.y
        c.paragraph(
            fonts.text[600],
            [f"Giveaway · Ends {DEADLINE}"],
            19 * s,
            1.2,
            BRAND,
            tracking=0.2 * 19 * s,
            measure_only=measure_only,
        )
        c.gap(20 * s)
        c.paragraph(
            fonts.head[700],
            ["Win a custom from", "the shaper you", "actually want."],
            84 * s,
            1.0,
            INK,
            tracking=-0.035 * 84 * s,
            measure_only=measure_only,
        )
        c.gap(24 * s)
        c.paragraph(
            fonts.text[300],
            ["Pick your brand, list a surfboard, and you\u2019re in the raffle."],
            31 * s,
            1.34,
            MUTED,
            measure_only=measure_only,
        )
        c.gap(40 * s)
        chips(measure_only)
        c.gap(42 * s)
        if measure_only:
            c.y += (fonts.text[500].ascent + fonts.text[500].descent) * 33 * s + 30 * s * 2
        else:
            c.pill("Pick your brand", 33 * s, BRAND, WHITE, 46 * s, 30 * s)
        c.gap(28 * s)
        c.paragraph(
            fonts.text[300],
            fonts.text[300].wrap(
                "One entry per person. Free to list — no sale required. Winner drawn "
                f"{DRAW_DATE}. Not sponsored, endorsed, or administered by these brands. {SITE}",
                17 * s,
                c.content_width,
            ),
            17 * s,
            1.45,
            MUTED,
            measure_only=measure_only,
        )
        return c.y - start

    c.y = 0
    height = stack(measure_only=True)
    c.body.clear()
    place_stack(c, height)
    stack()
    wordmark(c, INK)
    return c.render(bg)


def steps_ad(size: Size, fonts: Fonts) -> str:
    """C — the three-step explainer for colder audiences."""
    c = Canvas(size, fonts)
    s = size.scale
    bg = f'<rect width="{size.w}" height="{size.h}" fill="{WHITE}"/>'

    steps = [
        ("Sign up", "Create a free Reswell account. Takes about a minute."),
        ("Pick a brand", "Choose the custom you want to ride."),
        ("List a surfboard", f"Publish a board by {DEADLINE}. That\u2019s your raffle ticket."),
    ]
    num_d = 62 * s
    title_size = 39 * s
    body_size = 26 * s
    step_gap = 34 * s

    def step_block(measure_only: bool) -> None:
        title_face = fonts.head[700]
        body_face = fonts.text[300]
        text_x = c.left + num_d + 26 * s
        max_w = c.content_width - (num_d + 26 * s)
        for i, (title, body) in enumerate(steps):
            top = c.y
            title_box, title_off = c.line_metrics(title_face, title_size, 1.1)
            body_lines = body_face.wrap(body, body_size, max_w)
            body_box, body_off = c.line_metrics(body_face, body_size, 1.34)
            if not measure_only:
                cy = top + num_d / 2
                c.add(
                    f'<circle cx="{c.left + num_d / 2:.1f}" cy="{cy:.1f}" '
                    f'r="{num_d / 2:.1f}" fill="{BRAND}"/>'
                )
                nface = fonts.head[700]
                nsize = 29 * s
                nw = nface.measure(str(i + 1), nsize)
                nbase = cy + nface.ascent * nsize - (nface.ascent + nface.descent) * nsize / 2
                c.add(
                    nface.draw(
                        str(i + 1), nsize, c.left + num_d / 2 - nw / 2, nbase, WHITE
                    )
                )
                c.add(
                    title_face.draw(
                        title,
                        title_size,
                        text_x,
                        top + title_off,
                        INK,
                        tracking=-0.02 * title_size,
                    )
                )
                for j, line in enumerate(body_lines):
                    c.add(
                        body_face.draw(
                            line,
                            body_size,
                            text_x,
                            top + title_box + 4 * s + body_off + j * body_box,
                            MUTED,
                        )
                    )
            block_h = max(num_d, title_box + 4 * s + body_box * len(body_lines))
            c.y = top + block_h
            if i < len(steps) - 1:
                c.y += step_gap

    def stack(measure_only: bool = False) -> float:
        start = c.y
        c.paragraph(
            fonts.text[600],
            [f"Giveaway · Ends {DEADLINE}"],
            19 * s,
            1.2,
            BRAND,
            tracking=0.2 * 19 * s,
            measure_only=measure_only,
        )
        c.gap(20 * s)
        c.paragraph(
            fonts.head[700],
            ["Three steps to", "a new custom."],
            84 * s,
            1.0,
            INK,
            tracking=-0.035 * 84 * s,
            measure_only=measure_only,
        )
        c.gap(46 * s)
        step_block(measure_only)
        c.gap(44 * s)
        if not measure_only:
            c.add(
                f'<rect x="{c.left:.1f}" y="{c.y:.1f}" width="{c.content_width:.1f}" '
                f'height="2" fill="{BORDER}"/>'
            )
        c.y += 2
        c.gap(40 * s)
        if measure_only:
            c.y += (fonts.text[500].ascent + fonts.text[500].descent) * 33 * s + 30 * s * 2
        else:
            c.pill("Start your listing", 33 * s, INK, WHITE, 46 * s, 30 * s)
        c.gap(26 * s)
        c.paragraph(
            fonts.text[300],
            [f"Free to list. No sale required. Winner drawn {DRAW_DATE}.", SITE],
            20 * s,
            1.45,
            MUTED,
            measure_only=measure_only,
        )
        return c.y - start

    c.y = 0
    height = stack(measure_only=True)
    c.body.clear()
    place_stack(c, height)
    stack()
    wordmark(c, INK)
    return c.render(bg)


def hook_ad(size: Size, fonts: Fonts) -> str:
    """D — highest-contrast scroll-stopper for cold traffic."""
    c = Canvas(size, fonts)
    s = size.scale
    bg = (
        f'<rect width="{size.w}" height="{size.h}" fill="{INK}"/>'
        + swell_lines(size, SKY, 0.16)
    )

    def stack(measure_only: bool = False) -> float:
        start = c.y
        c.paragraph(
            fonts.text[600],
            [f"Giveaway · Ends {DEADLINE}"],
            19 * s,
            1.2,
            WHITE,
            tracking=0.2 * 19 * s,
            opacity=0.6,
            measure_only=measure_only,
        )
        c.gap(24 * s)
        c.paragraph(
            fonts.head[700],
            [
                ("Your old board", WHITE),
                ("could win you", WHITE),
                ("a new one.", SKY),
            ],
            112 * s,
            0.98,
            WHITE,
            tracking=-0.035 * 112 * s,
            measure_only=measure_only,
        )
        c.gap(30 * s)
        c.paragraph(
            fonts.text[300],
            fonts.text[300].wrap(
                f"List any surfboard on Reswell before {DEADLINE} and you\u2019re entered "
                "to win a custom.",
                34 * s,
                c.content_width * 0.9,
            ),
            34 * s,
            1.34,
            WHITE,
            opacity=0.82,
            measure_only=measure_only,
        )
        c.gap(46 * s)
        if measure_only:
            c.y += (fonts.text[500].ascent + fonts.text[500].descent) * 33 * s + 30 * s * 2
        else:
            c.pill("List a surfboard", 33 * s, WHITE, INK, 46 * s, 30 * s)
        c.gap(30 * s)
        c.paragraph(
            fonts.text[300],
            [f"Free to list. No sale required. Winner drawn {DRAW_DATE}.", SITE],
            21 * s,
            1.45,
            WHITE,
            opacity=0.55,
            measure_only=measure_only,
        )
        return c.y - start

    c.y = 0
    height = stack(measure_only=True)
    c.body.clear()
    place_stack(c, height)
    stack()
    wordmark(c, WHITE)
    return c.render(bg)


CREATIVES = [
    ("a-hero", hero_ad),
    ("b-brands", brands_ad),
    ("c-how-to-enter", steps_ad),
    ("d-hook", hook_ad),
]


def main() -> int:
    out_dir = Path(sys.argv[1])
    fonts_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    fonts = Fonts.load(fonts_dir)
    for slug, build in CREATIVES:
        for size in SIZES:
            svg = build(size, fonts)
            target = out_dir / f"reswell-giveaway-{slug}-{size.id}.svg"
            target.write_text(svg)
            print(f"✓ {target.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
