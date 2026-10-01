#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-23.json

Integrity:
  - Official brand sites only
  - Named surfboard models only (no apparel, fins, bags, foil, SUP, gift cards)
  - Require image + name + description
  - Collapse size / color / construction duplicates
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
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-23.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin sets?|\bfins\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|custom order|voucher|gift voucher|"
    r"bodyboard|bellyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"stubby|workshop|kit\b|plans\b|paipo|sunscreen|keep cup|tote|"
    r"tea\b|coffee|lip zinc|chafe|sticker pack|key ?ring|book)\b",
    re.I,
)
SERVICE = re.compile(
    r"\b(delivery fee|rush processing|custom surfboard|faq|gift card|deposit|"
    r"used personal)\b",
    re.I,
)
LEADING_SIZE = re.compile(
    r"""^(?:NEW\s*[-–—]?\s*)?(?:\d+\s*['′]\s*\d*(?:[\"″]\d*)?|\d+['′]\s*\d*|\d+\s*ft)\s*""",
    re.I,
)
TRAILING_SIZE = re.compile(
    r"""\s+(?:\d+\s*['′]\s*\d*(?:[\"″]\d*)?(?:\s*[x×].*)?)$""",
    re.I,
)
CONSTRUCTION_TAIL = re.compile(
    r"\s+(?:CorkRail|CedarRail|GreenRail|OG Construction|EPS|PU|epoxy)\s*$",
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
            if url and "32x32" not in url:
                return url
    for raw in re.findall(r'(//[^"\']+/cdn/shop/(?:files|t/\d+/assets)/[^"\']+\.(?:png|jpg|jpeg|webp|svg))', html, re.I):
        low = raw.casefold()
        if any(token in low for token in ("logo", "wordmark", "header", "brand")):
            url = normalize_asset_url(raw, base)
            if url and "32x32" not in url:
                return url
    return None


def shopify_logo(base: str) -> str | None:
    try:
        html = fetch_text(base)
    except Exception:
        return None
    return extract_logo_from_html(html, base)


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
        if "thunderbolt" in compact and "thunderbolt" in existing_key:
            match_key = existing_key
            name = "Thunderbolt"
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


def clean_grain_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    name = re.sub(r"^NEW\s*[-–—]?\s*", "", name, flags=re.I)
    name = re.sub(r"\s*[-–—]\s*Own A Piece of Grain History\s*$", "", name, flags=re.I)
    name = re.sub(r"^Jon Wegener\s*[-–—]?\s*", "", name, flags=re.I)
    name = LEADING_SIZE.sub("", name).strip(" -–—")
    name = CONSTRUCTION_TAIL.sub("", name).strip(" -–—")
    name = re.sub(r"\s+A Wegener/Grain Collab Model\s*$", "", name, flags=re.I)
    name = re.sub(r"^Lovelace[-–—]\s*", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" -–—")
    if name.casefold() in {
        "biologic surfboards",
        "design your own surfboard deposit",
        "the ci biscuit",
        "ci biscuit",
        "thick lizzy",
        "the puffin",
        "puffin",
    }:
        return None
    if name.isupper() and len(name) > 3:
        name = title_case_model(name)
    if HARD_EXCLUDE.search(name) or SERVICE.search(name):
        return None
    if len(name) < 2:
        return None
    return name


def scrape_grain() -> tuple[list[dict], str | None]:
    products = shopify_all("https://grainsurfboards.com")
    allowed = {"surfboard", "midlength", "fish", "big wave", "longboard", "specialty"}
    models: dict[str, dict] = {}
    for product in products:
        ptype = (product.get("product_type") or "").casefold()
        title = product.get("title") or ""
        if ptype not in allowed:
            continue
        if HARD_EXCLUDE.search(title):
            continue
        if re.search(r"\bpaipo\b", f"{title} {ptype}", re.I):
            continue
        name = clean_grain_name(title)
        if not name:
            continue
        merge_model(models, name, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = shopify_logo("https://grainsurfboards.com")
    if not logo:
        logo = "https://grainsurfboards.com/cdn/shop/files/grain-logo.png"
    return finalize_models(models), logo


def clean_south_coast_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    name = name.replace("’", "'").replace("‘", "'")
    if HARD_EXCLUDE.search(name) or SERVICE.search(name):
        return None
    if re.search(r"\b(stubby|voucher|deposit|gift)\b", name, re.I):
        return None
    name = LEADING_SIZE.sub("", name)
    name = re.sub(r"^\d+[’”']?\s*", "", name)
    name = re.sub(r"\s+", " ", name).strip(" -–—")
    if len(name) < 3:
        return None
    return title_case_model(name)


def scrape_south_coast() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.southcoastsurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        ptype = (product.get("product_type") or "").casefold()
        title = product.get("title") or ""
        vendor = (product.get("vendor") or "").casefold()
        if ptype != "surfboard":
            continue
        if vendor and "south coast" not in vendor and "southcoast" not in vendor:
            continue
        if re.search(r"\bsharpeye\b", title, re.I):
            continue
        name = clean_south_coast_name(title)
        if not name:
            continue
        merge_model(models, name, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = shopify_logo("https://www.southcoastsurfboards.com")
    if not logo or "img_0567" in (logo or "").casefold() or logo.endswith(".png"):
        logo = (
            "https://www.southcoastsurfboards.com/cdn/shop/files/"
            "IMG_0650_dc9c7de1-d8c6-41c3-b7b3-bb18020a2bd3.jpg"
        )
    return finalize_models(models), logo


def scrape_darcy() -> tuple[list[dict], str | None]:
    products = shopify_all("https://darcysurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        title = html_lib.unescape(product.get("title") or "").strip()
        ptype = (product.get("product_type") or "").casefold()
        if not title or HARD_EXCLUDE.search(title) or SERVICE.search(title):
            continue
        if "gift" in title.casefold():
            continue
        if ptype and "surfboard" not in ptype:
            continue
        merge_model(models, title, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = shopify_logo("https://darcysurfboards.com")
    return finalize_models(models), logo


WAYNE_CANONICAL = [
    ("unison longboard", "Unison Longboard"),
    ("unison", "Unison Longboard"),
    ("evo", "Evo"),
    ("hybrid", "Hybrid"),
    ("single fin", "Single Fin"),
    ("performance", "Performance"),
]


def wayne_model_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    low = name.casefold()
    if any(token in low for token in ("tee", "cap", "glide wls", "glide evolution", "used personal")):
        return None
    if HARD_EXCLUDE.search(name):
        return None
    for needle, canonical in WAYNE_CANONICAL:
        if needle in low:
            return canonical
    return None


def scrape_wayne_lynch() -> tuple[list[dict], str | None]:
    products = shopify_all("https://waynelynchsurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        title = product.get("title") or ""
        name = wayne_model_name(title)
        if not name:
            continue
        merge_model(models, name, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = shopify_logo("https://waynelynchsurfboards.com")
    return finalize_models(models), logo


def clean_simon_jones_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    if re.search(r"\b(custom order|gift card|board sock|surf wax|raked twin|keels|upright twins)\b", name, re.I):
        return None
    name = re.sub(r"\s*\[PLACEHOLDER\]\s*", "", name, flags=re.I)
    name = re.sub(r"\s*[-–—]\s*Used\b.*$", "", name, flags=re.I)
    name = re.sub(r"\s+Double Stringer\b", "", name, flags=re.I)
    name = re.sub(r"\s+[-–—]\s+ID:.*$", "", name, flags=re.I)
    name = re.sub(r"\s+\d+['′].*$", "", name)
    name = re.sub(r"\s+", " ", name).strip(" -–—")
    if HARD_EXCLUDE.search(name) or SERVICE.search(name):
        return None
    if len(name) < 2:
        return None
    return name


def scrape_simon_jones() -> tuple[list[dict], str | None]:
    products = shopify_all("https://simonjonesdesigns.com")
    models: dict[str, dict] = {}
    ranked = sorted(
        products,
        key=lambda p: (0 if "[PLACEHOLDER]" in (p.get("title") or "") else 1),
        reverse=True,
    )
    for product in ranked:
        title = product.get("title") or ""
        ptype = (product.get("product_type") or "").casefold()
        if ptype in {"fins", "board bags", "wax", "custom board"}:
            continue
        name = clean_simon_jones_name(title)
        if not name:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        labeled = None
        if desc:
            match = re.search(r"Surfboard Model:\s*([^\n<]+)", desc, re.I)
            if match:
                labeled = clean_simon_jones_name(match.group(1))
        if labeled and model_key(labeled).replace("the", "") != model_key(name).replace("the", ""):
            if model_key(name) not in model_key(labeled):
                desc = None
        if "[PLACEHOLDER]" in title and desc and not desc_mentions_name(desc, name):
            desc = None
        merge_model(models, name, image_of(product), desc)
    logo = (
        "https://simonjonesdesigns.com/cdn/shop/files/"
        "ef7a98_4d29fe1d11274d2286f14b0b72069db6_mv2.png"
    )
    return finalize_models(models), logo


COLE_MODELS = [
    ("Loose Cannon", "looseCannon.html"),
    ("Batfish", "batfish.html"),
    ("Pistol", "pistol.html"),
    ("Slingshot", "slingshot.html"),
    ("Firefly", "firefly.html"),
    ("Grasshopper", "grasshopper.html"),
    ("V12", "v12.html"),
    ("Road Tripper", "roadTripper.html"),
    ("X10", "x10.html"),
    ("Wrecking Ball", "wreckingball.html"),
    ("Bullet Fish", "bulletfish.html"),
    ("Skeleton Fish", "skeletonFish.html"),
    ("Single Barrel", "singleBarrel.html"),
    ("Soy Saucer", "soySaucer.html"),
    ("Flight Deck", "flightDeck.html"),
    ("Trunk Board", "trunkboard.html"),
]


def scrape_cole() -> tuple[list[dict], str | None]:
    models: list[dict] = []
    logo = "https://colesurfboards.com/images/coleLogoWebNav.png"
    nav = (
        "SURFBOARDS LOOSE CANNON BATFISH PISTOL SLINGSHOT FIREFLY GRASSHOPPER V12 "
        "ROAD TRIPPER X10 WRECKING BALL BULLET FISH SKELETON FISH SINGLE BARREL "
        "SOY SAUCER FLIGHT DECK TRUNK BOARD"
    )
    for name, path in COLE_MODELS:
        url = urljoin("https://colesurfboards.com/", path)
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  cole skip {path}: {exc}")
            continue
        time.sleep(0.12)
        imgs = re.findall(r'src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"', html, re.I)
        image = None
        skip_img = (
            "logo", "home.png", "about.png", "team.png", "contact.png",
            "social", "footer", "nav", "surfboards.png",
        )
        for raw in imgs:
            low = raw.casefold()
            if any(skip in low for skip in skip_img):
                continue
            if "board" in low or name.split()[0].casefold().replace(" ", "") in low.replace(" ", ""):
                image = urljoin("https://colesurfboards.com/", raw)
                break
        if not image:
            for raw in imgs:
                low = raw.casefold()
                if raw.startswith("images/") and not any(skip in low for skip in skip_img):
                    image = urljoin("https://colesurfboards.com/", raw)
                    break
        text = strip_html(html) or ""
        text = text.replace(nav, " ")
        text = re.sub(r"^.*?CUSTOM SHAPES.*?Phone:\s*\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\s*", "", text)
        idx = text.casefold().find(name.casefold())
        chunk = text[idx:] if idx >= 0 else text
        chunk = re.sub(rf"^{re.escape(name)}\s+", "", chunk, flags=re.I)
        desc = clip_desc(chunk)
        if not image or not desc or len(desc) < 60:
            print(f"  cole incomplete {name}: img={bool(image)} desc={len(desc or '')}")
            continue
        models.append({"name": name, "image_url": image, "description": desc})
    return models, logo


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


def main() -> None:
    rejected: list[str] = []
    brands_out: list[dict] = []

    print("Grain Surfboards (York, Maine)...")
    models, logo = scrape_grain()
    print(f"  grain models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="grain-surfboards",
            name="Grain Surfboards",
            website_url="https://grainsurfboards.com",
            location_label="York, Maine",
            founder_name="Mike LaVecchia",
            lead_shaper_name="Mike LaVecchia",
            short_description="Wooden surfboards built in York, Maine from northern white cedar — hollow cedar-rail craft with named everyday, fish, mid-length, and longboard models.",
            models=models,
            logo=logo,
        )
    )

    print("Cole Surfboards (San Clemente)...")
    models, logo = scrape_cole()
    print(f"  cole models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="cole-surfboards",
            name="Cole Surfboards",
            website_url="https://colesurfboards.com",
            location_label="San Clemente, California",
            founder_name="Cole Simler",
            lead_shaper_name="Cole Simler",
            short_description="USA-made custom shortboards, fishes, and grovelers from Cole Simler in San Clemente.",
            models=models,
            logo=logo,
        )
    )

    print("South Coast Surfboards (Torquay)...")
    models, logo = scrape_south_coast()
    print(f"  south-coast models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="south-coast-surfboards",
            name="South Coast Surfboards",
            website_url="https://www.southcoastsurfboards.com",
            location_label="Torquay, Victoria, Australia",
            founder_name="Ian Chisholm",
            lead_shaper_name="Ian Chisholm",
            short_description="Family-owned Torquay factory shaping and glassing traditional longboards, mid-lengths, and small-wave boards by hand since 1995.",
            models=models,
            logo=logo,
        )
    )

    print("D'Arcy Surfboards (Gold Coast)...")
    models, logo = scrape_darcy()
    print(f"  darcy models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="darcy-surfboards",
            name="D'Arcy Surfboards",
            website_url="https://darcysurfboards.com",
            location_label="Gold Coast, Queensland, Australia",
            founder_name="Stuart D'Arcy",
            lead_shaper_name="Stuart D'Arcy",
            short_description="Gold Coast custom performance, mid-length, and fish designs from shaper Stuart D'Arcy.",
            models=models,
            logo=logo,
        )
    )

    print("Wayne Lynch Surfboards (Victoria)...")
    models, logo = scrape_wayne_lynch()
    print(f"  wayne-lynch models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="wayne-lynch-surfboards",
            name="Wayne Lynch Surfboards",
            website_url="https://waynelynchsurfboards.com",
            location_label="Fairhaven, Victoria, Australia",
            founder_name="Wayne Lynch",
            lead_shaper_name="Wayne Lynch",
            short_description="Victorian surf craft from Australian surfing legend Wayne Lynch, including the Evo, Hybrid, Performance, and Unison longboard.",
            models=models,
            logo=logo,
        )
    )

    print("Simon Jones Designs (Byron Bay)...")
    models, logo = scrape_simon_jones()
    print(f"  simon-jones models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="simon-jones-designs",
            name="Simon Jones Designs",
            website_url="https://simonjonesdesigns.com",
            location_label="Byron Bay, New South Wales, Australia",
            founder_name="Simon Jones",
            lead_shaper_name="Simon Jones",
            short_description="Family-run Byron Bay label handcrafting stock and custom shortboards and mid-lengths since 1983.",
            models=models,
            logo=logo,
        )
    )

    usable: list[dict] = []
    for brand in brands_out:
        kept = []
        for m in brand["models"]:
            name = pretty_model_name((m.get("name") or "").strip())
            desc = (m.get("description") or "").strip()
            image_url = m.get("image_url") or ""
            if image_url.casefold().endswith(".heic"):
                continue
            if (
                name
                and image_url
                and len(desc) >= 40
                and not HARD_EXCLUDE.search(name)
                and not SERVICE.search(name)
            ):
                kept.append({**m, "name": name, "description": desc})
        brand["models"] = kept
        if len(kept) >= 3 and brand.get("logo_url"):
            usable.append(brand)
        else:
            rejected.append(
                f"{brand['slug']}: after filter models={len(kept)} logo={bool(brand.get('logo_url'))}"
            )

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth of small USA and Australia surfboard-maker brands",
        "generated_on": "2026-08-23",
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
