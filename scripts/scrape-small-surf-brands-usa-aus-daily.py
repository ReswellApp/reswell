#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-26.json

Integrity:
  - Official brand sites only
  - Named surfboard models only (no apparel, fins, bags, foil, SUP, gift cards)
  - Require image + name + description
  - Collapse size / color / construction duplicates
  - Reject the same product photo reused across models
  - Always capture a first-party logo
"""
from __future__ import annotations

import html as html_lib
import json
import re
import socket
import ssl
import time
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

socket.setdefaulttimeout(20)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-26.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin sets?|\bfins\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|custom order|voucher|gift voucher|"
    r"bodyboard|bellyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"workshop|kit\b|plans\b|paipo|sunscreen|keep cup|tote|"
    r"tea\b|coffee|lip zinc|chafe|sticker pack|key ?ring|book|"
    r"leg ?rope|tailpad|tail pad|nipper|rescue board|inflatable sled|"
    r"g-sled|seadonkey|stand up paddle|smock|sweatshirt|cd\b|recordings|"
    r"colour detailing|eps build)\b",
    re.I,
)
SERVICE = re.compile(
    r"\b(delivery fee|rush processing|custom surfboard|faq|gift card|deposit|"
    r"used personal|last chance|custom order|photos coming)\b",
    re.I,
)
LEADING_SIZE = re.compile(
    r"""^(?:NEW\s*[-–—]?\s*)?(?:\d+\s*['′]\s*\d*(?:[\"″]\d*)?|\d+['′]\s*\d*|\d+\s*ft|\d+[,\.]\d+)\s*""",
    re.I,
)
APPAREL = re.compile(
    r"\b(hoody|hoodie|sweat|tee|t-shirt|sticker|pocket tee|logo tee|"
    r"cap|hat|tank|fleece)\b",
    re.I,
)


def fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9"},
    )
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", "replace")


def fetch_json(url: str):
    return json.loads(fetch(url).decode("utf-8", "replace"))


def shopify_all(base: str, pages: int = 8) -> list[dict]:
    out: list[dict] = []
    seen: set[int] = set()
    for page in range(1, pages + 1):
        try:
            data = fetch_json(f"{base.rstrip('/')}/products.json?limit=250&page={page}")
        except Exception as exc:
            print(f"  shopify skip {base} page {page}: {type(exc).__name__}: {exc}")
            break
        batch = data.get("products") or []
        if not batch:
            break
        for product in batch:
            pid = product.get("id")
            if pid in seen:
                continue
            seen.add(pid)
            out.append(product)
        if len(batch) < 250:
            break
        time.sleep(0.15)
    return out


def strip_html(raw: str | None) -> str | None:
    if not raw:
        return None
    text = html_lib.unescape(raw)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"</p>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clip_desc(text: str | None, limit: int = 700) -> str | None:
    if not text:
        return None
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def image_of(product: dict) -> str | None:
    images = product.get("images") or []
    preferred: list[str] = []
    fallback: list[str] = []
    for image in images:
        src = (image.get("src") or "").split("?")[0]
        if not src:
            continue
        if src.casefold().endswith(".heic"):
            fallback.append(src)
        else:
            preferred.append(src)
    return (preferred or fallback or [None])[0]


def pretty_model_name(name: str) -> str:
    letters = [c for c in name if c.isalpha()]
    if letters and sum(1 for c in letters if c.isupper()) / len(letters) >= 0.7:
        return title_case_model(name)
    return name


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def title_case_model(name: str) -> str:
    small = {"and", "or", "the", "of", "a", "an"}
    words = re.split(r"(\s+)", name.strip())
    out: list[str] = []
    first = True
    for word in words:
        if not word.strip() or word.isspace():
            out.append(word)
            continue
        low = word.casefold()
        if not first and low in small:
            out.append(low)
        elif word.isupper() and len(word) <= 4:
            out.append(word)
        else:
            out.append(word[:1].upper() + word[1:].lower())
        first = False
    return "".join(out).strip()


def normalize_asset_url(url: str, base: str) -> str | None:
    url = url.split()[0].split(",")[0].strip()
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("/"):
        url = urljoin(base, url)
    if not url.startswith("http"):
        return None
    if any(skip in url.casefold() for skip in ("placeholder", "favicon.ico", "1x1", "pixel", "{width}")):
        return None
    return url.split("?")[0]


def extract_logo_from_html(html: str, base: str) -> str | None:
    patterns = [
        r'(?:src|content|href)="([^"]*(?:logo|Logo|LOGO|wordmark)[^"]+\.(?:png|jpg|jpeg|svg|webp)[^"]*)"',
        r'property="og:image"\s+content="([^"]+)"',
        r'rel="apple-touch-icon"[^>]+href="([^"]+)"',
    ]
    for pat in patterns:
        for raw in re.findall(pat, html, flags=re.I):
            url = normalize_asset_url(raw if isinstance(raw, str) else raw[0], base)
            if not url or "32x32" in url or "180x180" in url:
                continue
            low = url.casefold()
            if any(skip in low for skip in ("tee", "hoodie", "sweat", "sticker", "tshirt", "cropped")):
                continue
            return url
    for raw in re.findall(
        r'(//[^"\']+/cdn/shop/(?:files|t/\d+/assets)/[^"\']+\.(?:png|jpg|jpeg|webp|svg))',
        html,
        re.I,
    ):
        low = raw.casefold()
        if any(token in low for token in ("logo", "wordmark", "header", "brand")):
            if any(skip in low for skip in ("tee", "hoodie", "sweat", "sticker")):
                continue
            url = normalize_asset_url(raw, base)
            if url and "32x32" not in url:
                return url
    return None


def desc_mentions_name(desc: str | None, name: str) -> bool:
    if not desc:
        return False
    blob = desc.casefold()
    folded = name.casefold().strip()
    if folded and folded in blob:
        return True
    tokens = [t for t in re.split(r"[^a-z0-9]+", folded) if len(t) >= 3]
    if len(tokens) >= 2:
        return all(token in blob for token in tokens)
    if tokens:
        return tokens[0] in blob
    return False


def merge_model(models: dict[str, dict], name: str, image: str | None, desc: str | None) -> None:
    key = model_key(name)
    compact = key.replace("the", "")
    match_key = key
    for existing_key in list(models):
        if existing_key == key or existing_key.replace("the", "") == compact:
            match_key = existing_key
            break
    existing = models.get(match_key)
    if existing is None:
        models[match_key] = {
            "name": name,
            "image_url": image,
            "description": desc,
            "_score": 1,
        }
        return
    existing["_score"] += 1
    if not existing.get("image_url") and image:
        existing["image_url"] = image
    if desc:
        current = existing.get("description")
        desc_fits = desc_mentions_name(desc, existing["name"]) or desc_mentions_name(desc, name)
        current_fits = desc_mentions_name(current, existing["name"])
        if not current:
            existing["description"] = desc
        elif desc_fits and not current_fits:
            existing["description"] = desc
        elif desc_fits == current_fits and len(desc) > len(current or ""):
            existing["description"] = desc
    if len(name) < len(existing["name"]) and not re.search(r"\d+['′]", name):
        existing["name"] = name


def finalize_models(models: dict[str, dict], limit: int = 80) -> list[dict]:
    ranked = sorted(models.values(), key=lambda m: (-m["_score"], m["name"].casefold()))
    out: list[dict] = []
    for item in ranked[:limit]:
        if not item.get("image_url") or not item.get("description"):
            continue
        if HARD_EXCLUDE.search(item["name"]) or SERVICE.search(item["name"]):
            continue
        if len(item["name"]) < 2:
            continue
        out.append(
            {
                "name": pretty_model_name(item["name"]),
                "image_url": item["image_url"],
                "description": item["description"],
            }
        )
    return out


def brand_row(
    *,
    slug: str,
    name: str,
    website_url: str,
    location_label: str,
    short_description: str,
    models: list[dict],
    logo: str | None,
    founder_name: str | None = None,
    lead_shaper_name: str | None = None,
) -> dict:
    return {
        "slug": slug,
        "name": name,
        "website_url": website_url,
        "location_label": location_label,
        "founder_name": founder_name,
        "lead_shaper_name": lead_shaper_name,
        "short_description": short_description,
        "logo_url": logo,
        "models": models,
    }


def squarespace_prewrap_desc(html: str) -> str | None:
    blocks = re.findall(r'<p[^>]*style="white-space:pre-wrap;"[^>]*>([\s\S]*?)</p>', html)
    texts: list[str] = []
    for block in blocks:
        text = strip_html(block)
        if not text:
            continue
        if text.casefold().startswith(("length", "available sizes", "includes", "contact")):
            continue
        if len(text) >= 40:
            texts.append(text)
    return clip_desc(" ".join(texts) if texts else None)


def first_unique_board_image(html: str, *needles: str) -> str | None:
    urls = re.findall(r'(https://images\.squarespace-cdn\.com/content/[^"\s]+)', html)
    cleaned: list[str] = []
    nav_skip = (
        "logo", "favicon", "icon", "text-logo", "screen+shot", "soapbox-derby",
        "slice1", "board-models", "ryan-shaping", "about-ryan",
    )
    for raw in urls:
        url = raw.split("&quot;")[0].split("\\")[0].split("?")[0]
        low = url.casefold()
        if any(skip in low for skip in nav_skip):
            continue
        if url.casefold().endswith((".gif", ".ico", ".svg")):
            continue
        cleaned.append(url)
    for needle in needles:
        for url in cleaned:
            stem = url.rsplit("/", 1)[-1].casefold()
            if needle.casefold() in stem:
                return url
    # Page-specific camera photos (Sakal Scout and similar) — not nav thumbs.
    for url in cleaned:
        stem = url.rsplit("/", 1)[-1]
        if stem.upper().startswith("IMG_"):
            return url
    return None


# ---------------------------------------------------------------------------
# Ryan Sakal — Costa Mesa / North County San Diego. Squarespace model pages.
# ---------------------------------------------------------------------------
SAKAL_MODELS = [
    ("Howler Twinzer", "/howler", ("Howlzer", "Howler")),
    ("Sabre", "/sabre", ("Sabre", "sabre")),
    ("Soapbox Derby", "/soapbox-derby", ("Soapbox", "Derby")),
    ("Ranger", "/ranger", ("Ranger",)),
    ("Rambler", "/rambler", ("Rambler",)),
    ("Lasso", "/lasso", ("Lasso",)),
    ("HB Fish", "/hb-fish", ("HB", "Fish")),
    ("SD Fish", "/sd-fish", ("SD", "Fish")),
    ("Bandit", "/bandit", ("Bandit",)),
    ("Scout", "/scout", ("Scout",)),
    ("Haulin Oats", "/haulin-oats", ("Haulin", "Oats")),
    ("Weapon of Choice", "/weapon-of-choice", ("Weapon",)),
    ("Five O'Clock Shadow", "/five-oclock-shadow", ("Shadow", "Five")),
    ("Broseph", "/broseph", ("Broseph",)),
    ("Sith", "/sith", ("Sith",)),
    ("Chief", "/chief", ("Chief",)),
    ("Wounded Gull", "/wounded-gull", ("Wounded", "Gull")),
    ("Convoy", "/convoy", ("Convoy",)),
    ("Sting", "/sting", ("Sting",)),
    ("Little Wing", "/little-wing", ("Little", "Wing")),
    ("Cavalry", "/cavalry", ("Cavalry-Deck", "Cavalry-Bottom", "Cavalry")),
    ("Golden Bear", "/golden-bear", ("Golden", "Bear")),
]


def scrape_sakal() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, path, needles in SAKAL_MODELS:
        url = "https://www.ryansakalsurfboards.com" + path
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  sakal skip {path}: {exc}")
            continue
        desc = squarespace_prewrap_desc(html)
        image = first_unique_board_image(html, *needles, "deck", "bottom")
        if desc and image:
            merge_model(models, name, image, desc)
        time.sleep(0.12)
    logo = (
        "https://images.squarespace-cdn.com/content/v1/"
        "5e0fe08c27c1675a2a71fdb5/1579734785940-08SPORWHJP9QONKP3FWH/text-logo.png"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Natures Shapes — Sayville, Long Island. Skip SUPs.
# ---------------------------------------------------------------------------
NATURES_MODELS = [
    ("All Rounder", "/all-rounder", ("allrounder", "all-rounder", "AllRounder")),
    ("Snapper", "/snapper", ("snapper", "Snapper")),
    ("Stub Diamond", "/stub-diamond", ("stub", "diamond")),
    ("Go Kart", "/go-kart", ("gokart", "go-kart", "GoKart", "go_kart")),
    ("Disket", "/disket", ("disket", "Disket")),
    ("Q82 Fish", "/q82-fish", ("q82", "Q82")),
    ("K72 Fish", "/k72-fish", ("k72", "K72")),
    ("Hybrid", "/hybrid", ("hybrid", "Hybrid")),
    ("Hipster", "/hipster", ("hipster", "Hipster")),
    ("C-Dog", "/c-dog", ("cdog", "c-dog", "C-Dog", "CDog")),
    ("HP Mini", "/hp-mini", ("hpmini", "hp-mini", "HPMini")),
    ("HP1", "/hp1", ("hp1", "HP1")),
    ("HP2", "/hp2", ("hp2", "HP2")),
    ("NR1", "/nr1", ("nr1", "NR1")),
    ("NR2", "/nr2", ("nr2", "NR2")),
    ("Ditch Digger", "/ditch-digger", ("ditch", "Ditch")),
]


def scrape_natures() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, path, needles in NATURES_MODELS:
        url = "https://naturesshapes.com" + path
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  natures skip {path}: {exc}")
            continue
        desc = squarespace_prewrap_desc(html)
        image = first_unique_board_image(html, *needles, "board_")
        if desc and image:
            merge_model(models, name, image, desc)
        time.sleep(0.12)
    logo = (
        "https://images.squarespace-cdn.com/content/v1/"
        "5e1a25bcf86f5812d23bfc4e/1592241348398-1QWIJELH1FKIUAZR37M7/natures-shapes-logo-straight.png"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Zak Surfboards — Melbourne shop. Own-label named models only.
# ---------------------------------------------------------------------------
ZAK_SKIP_KEYS = {
    "zakcustomshorty",
    "customshorty",
    "zakcustomegg",
    "customegg",
    "zakminimal",
    "minimal",
}


def zak_model_name(title: str, product_type: str, vendor: str) -> str | None:
    if (vendor or "").strip() != "Zak Surfboards":
        return None
    if (product_type or "").strip() != "Surfboards":
        return None
    name = html_lib.unescape(title).strip()
    name = re.sub(r"^Zak Surfboards?\s*(?:X|x)?\s*", "", name).strip()
    name = re.sub(r"^Zak\s+", "", name).strip()
    name = re.sub(r"^[\s\-–—]+", "", name).strip()
    name = LEADING_SIZE.sub("", name).strip()
    name = re.sub(r"\s+\d+['′].*$", "", name).strip()
    name = re.sub(r"^['\"]+|['\"]+$", "", name).strip()
    name = re.sub(r"^[\s\-–—]+", "", name).strip()
    if not name or HARD_EXCLUDE.search(name) or APPAREL.search(name) or SERVICE.search(name):
        return None
    key = model_key(name)
    if key in ZAK_SKIP_KEYS or "comingsoon" in key:
        return None
    # Size-only rack leftovers without a real model write-up.
    if key in {"log", "longboard", "retrosinglefin"}:
        return None
    return name


def scrape_zak_melbourne() -> tuple[list[dict], str | None]:
    products = shopify_all("https://zaksurfboards.com.au")
    models: dict[str, dict] = {}
    for product in products:
        name = zak_model_name(
            product.get("title") or "",
            product.get("product_type") or "",
            product.get("vendor") or "",
        )
        if not name:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        image = image_of(product)
        if image and "photoscomingsoon" in image.casefold():
            continue
        if desc and len(desc) < 80 and not desc_mentions_name(desc, name):
            # Stock-size blurbs without a real model write-up.
            continue
        merge_model(models, name, image, desc)
    logo = (
        "https://melbournesurfboardshop.com.au/cdn/shop/files/"
        "Zak_Surfboards_-_Melbourne_Surfboard_Shop_640x640_"
        "cbe51534-bb9d-434d-a7f1-b33ead47f304.jpg"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Z Shapes — Zak Ogram, Dunsborough / Margaret River. WordPress model pages.
# ---------------------------------------------------------------------------
ZSHAPES_PAGES = [
    ("Asset", "https://zshapes.com.au/boards-asset/", ("asset",)),
    ("Denzel", "https://zshapes.com.au/boards-denzel/", ("denzel",)),
    ("Denzel Step Up", "https://zshapes.com.au/boards-denzel-step-up/", ("denzel-stepup", "stepup", "step-up")),
    ("Kinetic", "https://zshapes.com.au/boards-kinetic/", ("kinetic", "Screen-Shot")),
    ("Nectar", "https://zshapes.com.au/boards-nectar/", ("nectar",)),
    ("Mid", "https://zshapes.com.au/boards-mid/", ("mid",)),
    ("Oishii Fish", "https://zshapes.com.au/boards-oishii-fish/", ("oishii",)),
    ("Gun", "https://zshapes.com.au/boards-gun/", ("gun",)),
    ("GR Grom", "https://zshapes.com.au/boards-gr-grom/", ("gr-grom", "grom")),
]


def zshapes_desc(html: str) -> str | None:
    parts: list[str] = []
    for raw in re.findall(r"<p[^>]*>([\s\S]*?)</p>", html):
        text = strip_html(raw)
        if not text or len(text) < 40:
            continue
        low = text.casefold()
        if any(skip in low for skip in ("copyright", "subscribe", "newsletter", "call us", "email us")):
            continue
        parts.append(text)
    return clip_desc(" ".join(parts[:3]) if parts else None)


def zshapes_image(html: str, needles: tuple[str, ...]) -> str | None:
    urls = re.findall(r"(https://zshapes\.com\.au/wp-content/uploads/[^\"\s]+)", html)
    cleaned: list[str] = []
    for raw in urls:
        url = raw.split("?")[0]
        low = url.casefold()
        if any(skip in low for skip in ("logo", "icon", "favicon", "cropped", "-480x", "-123x", "-421x", "-632x", "-980x")):
            continue
        if not url.casefold().endswith((".png", ".jpg", ".jpeg", ".webp")):
            continue
        cleaned.append(url)
    for needle in needles:
        for url in cleaned:
            stem = url.rsplit("/", 1)[-1].casefold()
            if needle.casefold() in stem and not re.search(r"^\d", stem):
                return url
    # Prefer named outline renders over generic numbered PNGs.
    for url in cleaned:
        stem = url.rsplit("/", 1)[-1]
        if re.match(r"^[A-Za-z]", stem):
            return url
    return cleaned[0] if cleaned else None


def scrape_zshapes() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, url, needles in ZSHAPES_PAGES:
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  zshapes skip {name}: {exc}")
            continue
        desc = zshapes_desc(html)
        image = zshapes_image(html, needles)
        if desc and image:
            merge_model(models, name, image, desc)
        time.sleep(0.12)
    logo = (
        "https://zshapes.com.au/wp-content/uploads/2022/11/"
        "Z-SHAPES-LOGO_Pinline-110mm-2.png"
    )
    return finalize_models(models), logo


def main() -> None:
    rejected: list[str] = []
    brands_out: list[dict] = []

    print("Ryan Sakal Surfboards (Costa Mesa / Oceanside)...")
    models, logo = scrape_sakal()
    print(f"  sakal models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="ryan-sakal-surfboards",
            name="Ryan Sakal Surfboards",
            website_url="https://www.ryansakalsurfboards.com",
            location_label="Costa Mesa / Oceanside, California",
            founder_name="Ryan Sakal",
            lead_shaper_name="Ryan Sakal",
            short_description="Custom shortboards, fishes, mid-lengths, and twins from Ryan Sakal — shaped in North County San Diego with roots in the Sakal family shaping room.",
            models=models,
            logo=logo,
        )
    )

    print("Natures Shapes (Sayville, NY)...")
    models, logo = scrape_natures()
    print(f"  natures models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="natures-shapes",
            name="Natures Shapes",
            website_url="https://naturesshapes.com",
            location_label="Sayville, Long Island, New York",
            founder_name="Mike Becker",
            lead_shaper_name="Mike Becker",
            short_description="Long Island surfboards shaped and glassed by Mike Becker since 1993 — shortboards, fishes, mid-lengths, and logs built for East Coast beach breaks.",
            models=models,
            logo=logo,
        )
    )

    print("Zak Surfboards (Melbourne)...")
    models, logo = scrape_zak_melbourne()
    print(f"  zak melbourne models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="zak-surfboards",
            name="Zak Surfboards",
            website_url="https://zaksurfboards.com.au",
            location_label="Melbourne, Victoria, Australia",
            founder_name=None,
            lead_shaper_name="Doug Rogers",
            short_description="Victorian-made shortboards, twins, mid-lengths, and retro shapes from Zak Surfboards in Melbourne — own-label models shaped and finished locally.",
            models=models,
            logo=logo,
        )
    )

    print("Z Shapes (Dunsborough)...")
    models, logo = scrape_zshapes()
    print(f"  z shapes models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="z-shapes",
            name="Z Shapes",
            website_url="https://zshapes.com.au",
            location_label="Dunsborough, Western Australia",
            founder_name="Zak Ogram",
            lead_shaper_name="Zak Ogram",
            short_description="High-performance shortboards, fishes, mids, and guns from Zak Ogram in Dunsborough — shaped for Margaret River and South West reef waves.",
            models=models,
            logo=logo,
        )
    )

    usable: list[dict] = []
    for brand in brands_out:
        kept = []
        for model in brand["models"]:
            name = pretty_model_name((model.get("name") or "").strip())
            desc = (model.get("description") or "").strip()
            image_url = model.get("image_url") or ""
            if image_url.casefold().endswith(".heic"):
                continue
            if (
                name
                and image_url
                and len(desc) >= 40
                and not HARD_EXCLUDE.search(name)
                and not SERVICE.search(name)
                and not APPAREL.search(name)
            ):
                kept.append({**model, "name": name, "description": desc})
        unique: list[dict] = []
        seen_images: set[str] = set()
        for model in kept:
            image_key = (model.get("image_url") or "").split("?")[0].casefold()
            if image_key in seen_images:
                continue
            seen_images.add(image_key)
            unique.append(model)
        brand["models"] = unique
        if len(unique) >= 3 and brand.get("logo_url"):
            usable.append(brand)
        else:
            rejected.append(
                f"{brand['slug']}: after filter models={len(unique)} logo={bool(brand.get('logo_url'))}"
            )

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth of small USA and Australia surfboard-maker brands",
        "generated_on": "2026-08-26",
        "product_category_slug": "surfboards",
        "integrity": {
            "first_party_only": True,
            "surfboard_models_only": True,
            "require_image_name_description_logo": True,
        },
        "brands": usable,
        "rejected": rejected,
        "summary": {
            "brand_count": len(usable),
            "model_count": sum(len(b["models"]) for b in usable),
            "image_count": sum(1 for b in usable for m in b["models"] if m.get("image_url")),
            "logo_count": sum(1 for b in usable if b.get("logo_url")),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))
    print("rejected:")
    for row in rejected:
        print(" ", row)
    for brand in usable:
        print(f"  {brand['slug']:32} models={len(brand['models']):3} logo={brand.get('logo_url')}")
        for model in brand["models"]:
            print(f"    - {model['name']}")


if __name__ == "__main__":
    main()
