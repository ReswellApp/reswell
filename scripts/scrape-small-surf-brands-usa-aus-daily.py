#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-25.json

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
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-25.json")

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
    r"used personal|last chance|custom order)\b",
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
            if not url or "32x32" in url:
                continue
            low = url.casefold()
            if any(skip in low for skip in ("tee", "hoodie", "sweat", "sticker", "tshirt")):
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


def meta_content(html: str, name: str) -> str | None:
    pat = rf'(?:name|property)="{re.escape(name)}"\s+content="([^"]+)"'
    match = re.search(pat, html, re.I)
    if match:
        return html_lib.unescape(match.group(1)).strip()
    pat = rf'content="([^"]+)"\s+(?:name|property)="{re.escape(name)}"'
    match = re.search(pat, html, re.I)
    return html_lib.unescape(match.group(1)).strip() if match else None


def first_jpg(html: str, prefer: tuple[str, ...] = ()) -> str | None:
    urls = re.findall(
        r'(https?://[^"\'\\\s]+\.(?:jpg|jpeg|png|webp))',
        html,
        re.I,
    )
    cleaned: list[str] = []
    for raw in urls:
        url = raw.split("&quot;")[0].split("\\")[0].split("?")[0]
        low = url.casefold()
        if any(skip in low for skip in ("logo", "icon", "favicon", "emoji", "1x1", "pixel")):
            continue
        if url.casefold().endswith(".gif"):
            continue
        cleaned.append(url)
    for needle in prefer:
        for url in cleaned:
            if needle in url.casefold():
                return url
    return cleaned[0] if cleaned else None


# ---------------------------------------------------------------------------
# WRV — Virginia Beach. Own-label stock only; collapse sized SKUs.
# ---------------------------------------------------------------------------
WRV_SKIP = {
    "mayhempuddlejumpersting",
    "puddlejumpersting",
}


def wrv_model_name(title: str, product_type: str, vendor: str) -> str | None:
    if (product_type or "").casefold() != "surfboard":
        return None
    if "wave riding" not in (vendor or "").casefold() and "wrv" not in (vendor or "").casefold():
        return None
    name = LEADING_SIZE.sub("", html_lib.unescape(title)).strip()
    name = re.sub(r"\s*\(\d+\)\s*$", "", name).strip()
    if not name or HARD_EXCLUDE.search(name) or APPAREL.search(name):
        return None
    if model_key(name) in WRV_SKIP or "mayhem" in name.casefold() or "lost" in name.casefold():
        return None
    return name


def scrape_wrv() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.waveridingvehicles.com")
    models: dict[str, dict] = {}
    for product in products:
        name = wrv_model_name(
            product.get("title") or "",
            product.get("product_type") or "",
            product.get("vendor") or "",
        )
        if not name:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        merge_model(models, name, image_of(product), desc)
    logo = (
        "https://www.waveridingvehicles.com/cdn/shop/files/2026_WEBSITE_HEADER_LOGO_2.png"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Grace — Torquay longboards. Apparel SKUs stripped.
# ---------------------------------------------------------------------------
GRACE_BOARDS = {
    "silverfox",
    "singlefin",
    "theglider",
    "glider",
    "demibu",
    "allrounder",
    "noserider",
    "theheritage",
    "heritage",
}


def scrape_grace() -> tuple[list[dict], str | None]:
    products = shopify_all("https://gracesurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        title = html_lib.unescape(product.get("title") or "").strip()
        if APPAREL.search(title) or HARD_EXCLUDE.search(title):
            continue
        key = model_key(title)
        if key not in GRACE_BOARDS:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        merge_model(models, title, image_of(product), desc)
    logo = (
        "https://cdn.shopify.com/s/files/1/0576/2380/6049/files/Grace_Sticker.pdf.jpg"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Ron Wade — Mona Vale. Collapse sized / sold stock into named models.
# ---------------------------------------------------------------------------
WADE_CANONICAL = [
    ("blackfeather", "Blackfeather"),
    ("black feather", "Blackfeather"),
    ("f1 11 twin", "F1-11 Twin"),
    ("f1-11 twin", "F1-11 Twin"),
    ("f1-11", "F1-11"),
    ("f1 11", "F1-11"),
    ("mid-length", "Mid-Length"),
    ("mid length", "Mid-Length"),
    ("longboard", "Longboard"),
]


def wade_model_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    low = name.casefold()
    if APPAREL.search(name) or HARD_EXCLUDE.search(name):
        return None
    for needle, canonical in WADE_CANONICAL:
        if needle in low:
            return canonical
    return None


def scrape_ron_wade() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.ronwadesurfboards.com.au")
    models: dict[str, dict] = {}
    ranked = sorted(
        products,
        key=lambda p: (0 if "sold" not in (p.get("title") or "").casefold() else 1),
    )
    for product in ranked:
        name = wade_model_name(product.get("title") or "")
        if not name:
            continue
        merge_model(models, name, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = "https://www.ronwadesurfboards.com.au/cdn/shop/files/logo-white-trans-2.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Shortie — East Coast NSW. Official named model pages.
# ---------------------------------------------------------------------------
SHORTIE_PAGES = [
    ("717", "https://www.shortiesurfboards.com/surfboard-models/p/717", ("717-1.jpg", "717-")),
    (
        "Crazy Swayze",
        "https://www.shortiesurfboards.com/surfboard-models/p/crazy-swayze",
        ("crazyswayze-front.jpg", "crazyswayze-"),
    ),
    (
        "Twinkle Toes 2.0",
        "https://www.shortiesurfboards.com/surfboard-models/p/tan-white",
        ("tan+white-front.jpg", "tan%2bwhite-front", "white-front"),
    ),
    (
        "Micro Mid",
        "https://www.shortiesurfboards.com/surfboard-models/p/micro-mid",
        ("micromid-front.jpg", "micromid-"),
    ),
    (
        "HP Camel",
        "https://www.shortiesurfboards.com/surfboard-models/p/product-3-szb2y-gzh2r-jl4lx",
        ("hpcamel-front.jpg", "hpcamel-"),
    ),
]


def scrape_shortie() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, url, prefer in SHORTIE_PAGES:
        html = fetch_text(url)
        time.sleep(0.1)
        desc = clip_desc(meta_content(html, "description"))
        image = first_jpg(html, prefer)
        merge_model(models, name, image, desc)
    logo = (
        "https://static1.squarespace.com/static/69c0e2823d16373084c9b460/"
        "t/69cdb7997a9698137bd9aa6f/1775089561307/shortieretro+sticker01+%281%29.png"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# A Mano — Byron Bay. Dedicated model pages; skip fins / tees / deposits.
# ---------------------------------------------------------------------------
AMANO_PAGES = [
    ("Twin Pin", "https://www.amanosurf.com/twin-pin"),
    ("Stage Two Twin Pin", "https://www.amanosurf.com/stage-two-twin-pin"),
    ("Step Up Twin Pin", "https://www.amanosurf.com/step-up-twin-pin"),
    ("Fish", "https://www.amanosurf.com/fish"),
    ("Long Fish", "https://www.amanosurf.com/long-fish"),
    ("Egg", "https://www.amanosurf.com/egg"),
    ("Classic Single", "https://www.amanosurf.com/classic-single"),
    ("Mini Simmons", "https://www.amanosurf.com/big-stage-two-twin-pin"),
]


def scrape_amano() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, url in AMANO_PAGES:
        html = fetch_text(url)
        time.sleep(0.1)
        desc = clip_desc(meta_content(html, "description"))
        image = meta_content(html, "og:image")
        if image:
            image = image.split("?")[0]
        if not image:
            image = first_jpg(html)
        merge_model(models, name, image, desc)
    logo = (
        "https://static1.squarespace.com/static/5e8c0a572c2c9840f7db0b98/"
        "t/69d5c9274f547d722ece73d1/logo.png"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# POG — Sunshine Coast. First-party model pages. Soft-tops? No. Skip SUP.
# ---------------------------------------------------------------------------
POG_PAGES = {
    "https://www.pogsurfboards.com/the-fish-shop-surfboards/": [
        (
            "Flying Fish",
            "A throwback to the late 70s and 80s with its distinctive semi-retro single-flyer swallowtail plan shape. With a little extra width and thickness, the Flying Fish will improve your wave count even on the smaller days. Designed with a single to double concave and a pulled-in tail, the Flying Fish thruster delivers powerful, top-to-bottom performance even on bigger days.",
            ("Flying-Fish-1.png", "Flying-Fish-2.jpg", "Flying-Fish-1"),
        ),
        (
            "Flying Fish Twin",
            "A single flyer swallow tail twin fin throw-back to the late 70s and early 80s with heavy influences of Mark Richards and Larry Bertlemann. The plan shape of the Twin version has been tweaked to produce a shorter tail behind the fins to deliver drive while maintaining the looseness and speed of the Twin.",
            ("Flying-Fish-twin-top", "Flying-Fish-Twin-Top", "510_-Flying-Fish-twin-top"),
        ),
        (
            "Flying Fish Single",
            "Single flyer swallow tail with a pulled in nose and narrower tail — the Flying Fish as a dedicated single fin for longer lines and a more classic feel.",
            ("Flying-Fish-Single-Fin", "Flying-Fish-Single-Bottom"),
        ),
        (
            "Sick Squid",
            "Another all-rounder with a fuller nose and outline than the Flying Fish, this one lends itself to the single board quiver as well. Extra girth for paddle power in fatter conditions, with the versatility of a quad/thruster setup across a very broad range of surf.",
            ("Sick-Squid-Top", "Sick-Squid"),
        ),
        (
            "Fryed Fish",
            "A modernised Steve Lis or Skip Frye twin keel fish with a wide deep swallow tail. A full nose with extra volume and width and low rocker allows the Fryed Fish to catch waves like a Malibu and surf like a skateboard.",
            ("Fryed-Fish", "Fried-Fish"),
        ),
        (
            "Sprat",
            "The Sprat is a single flyer swallow tail twinzer with a wider tail and a wide round nose. This board has a concave chined hull forward into a double concave through the fins.",
            ("The-Sprat", "Sprat"),
        ),
        (
            "Cuttle Fish",
            "The Cuttle Fish is a classic egg plan shape and a great all-rounder. Extremely versatile, it can be set up as a single, quad/thruster or even a twin. The simple plan shape is enhanced by a forward chined concave to double concave bottom.",
            ("Cuttle-Fish-Top.jpg", "Cuttle-Fish-Top"),
        ),
        (
            "Soul Fish",
            "The Soul Fish is not really a fish at all but a modernised single fin for the retro purist. Pulled-in nose and reduced tail area produce longer cleaner lines, complimented by a pin, rounded pin, or small swallow. A go-to for reef and solid point breaks.",
            ("Soul-Fish-Top-1", "Soul-Fish-Top"),
        ),
    ],
    "https://www.pogsurfboards.com/no-brainers/": [
        (
            "No Brainer",
            "A post-apocalyptic modern shortboard for those who just want to shred in and above the lip. The No Brainer is a high-performance comp-light model for advanced surfers in all kinds of waves. Speed is maximised by a single concave running from the front foot to the back fin, usually set up with a thruster/quad option.",
            ("No-Brainer", "no-brainer", "Thruster"),
        ),
    ],
    "https://www.pogsurfboards.com/longboard-surfboards/": [
        (
            "Mal",
            "Whether you prefer old-style logs with pinched rails or modern mals with noseriding rockers and concaves for manoeuvrability, POG custom mals are designed with the features you want on a classic longboard.",
            ("Malibu-Longboard-Surfboard-Top.png", "Malibu-Longboard-Surfboard-Top"),
        ),
    ],
}

POG_HARD_IMAGES = {
    "Flying Fish": "https://www.pogsurfboards.com/wp-content/uploads/Flying-Fish-1.png",
    "Flying Fish Twin": "https://www.pogsurfboards.com/wp-content/uploads/510_-Flying-Fish-twin-top.png",
    "Flying Fish Single": "https://www.pogsurfboards.com/wp-content/uploads/Flying-Fish-Single-Fin.jpg",
    "Sick Squid": "https://www.pogsurfboards.com/wp-content/uploads/Sick-Squid-Top.jpg",
    "Fryed Fish": "https://www.pogsurfboards.com/wp-content/uploads/Fried-Fish-Bottom.jpg",
    "Sprat": "https://www.pogsurfboards.com/wp-content/uploads/Sprat-Top.png",
    "Cuttle Fish": "https://www.pogsurfboards.com/wp-content/uploads/Cuttle-Fish-Top.jpg",
    "Soul Fish": "https://www.pogsurfboards.com/wp-content/uploads/66_-Soul-Fish-Top-1.png",
    "No Brainer": "https://www.pogsurfboards.com/wp-content/uploads/6022-thruster-No-Brainer-single-concave-squash-tail-1.jpg",
    "Mal": "https://www.pogsurfboards.com/wp-content/uploads/Malibu-Longboard-Surfboard-Top.png",
}


def scrape_pog() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for url, entries in POG_PAGES.items():
        html = fetch_text(url)
        time.sleep(0.1)
        for name, desc, prefer in entries:
            image = POG_HARD_IMAGES.get(name) or first_jpg(html, prefer)
            if image and "ribbon-of-boards" in image.casefold():
                image = POG_HARD_IMAGES.get(name)
            merge_model(models, name, image, clip_desc(desc))
    logo = (
        "https://www.pogsurfboards.com/wp-content/uploads/"
        "Pog-Surfboards-Logo-Transparent-Background.png"
    )
    return finalize_models(models), logo


def main() -> None:
    rejected: list[str] = []
    brands_out: list[dict] = []

    print("Wave Riding Vehicles (Virginia Beach)...")
    models, logo = scrape_wrv()
    print(f"  wrv models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="wrv-surfboards",
            name="Wave Riding Vehicles",
            website_url="https://www.waveridingvehicles.com",
            location_label="Virginia Beach, Virginia",
            founder_name=None,
            lead_shaper_name=None,
            short_description="East Coast factory surfboards from Virginia Beach — WRV's own-label shortboards, fishes, mid-lengths, and logs shaped in-house for Atlantic beach-break and point surf.",
            models=models,
            logo=logo,
        )
    )

    print("Grace Surfboards (Torquay)...")
    models, logo = scrape_grace()
    print(f"  grace models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="grace-surfboards",
            name="Grace Surfboards",
            website_url="https://gracesurfboards.com",
            location_label="Torquay, Victoria, Australia",
            founder_name="Phil Grace",
            lead_shaper_name="Phil Grace",
            short_description="Classic and performance longboards from Phil Grace in Torquay — Silver Fox, Demibu, Glider, Nose Rider, and Heritage templates refined on Australian and Basque point waves.",
            models=models,
            logo=logo,
        )
    )

    print("Ron Wade Surfboards (Mona Vale)...")
    models, logo = scrape_ron_wade()
    print(f"  ron wade models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="ron-wade-surfboards",
            name="Ron Wade Surfboards",
            website_url="https://www.ronwadesurfboards.com.au",
            location_label="Mona Vale, New South Wales, Australia",
            founder_name="Ron Wade",
            lead_shaper_name="Ron Wade",
            short_description="Australian-made shortboards, mid-lengths, and longboards from Ron Wade in Mona Vale — Blackfeather, F1-11, and classic logs.",
            models=models,
            logo=logo,
        )
    )

    print("Shortie Surfboards (East Coast NSW)...")
    models, logo = scrape_shortie()
    print(f"  shortie models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="shortie-surfboards",
            name="Shortie Surfboards",
            website_url="https://www.shortiesurfboards.com",
            location_label="Redhead, New South Wales, Australia",
            founder_name="Sam Ayton",
            lead_shaper_name="Sam Ayton",
            short_description="Hand-shaped East Coast Australian shortboards and mid-lengths from Sam Ayton — 717, Crazy Swayze, Twinkle Toes 2.0, Micro Mid, and HP Camel.",
            models=models,
            logo=logo,
        )
    )

    print("A Mano (Byron Bay)...")
    models, logo = scrape_amano()
    print(f"  a mano models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="a-mano-surf",
            name="A Mano",
            website_url="https://www.amanosurf.com",
            location_label="Ewingsdale, Byron Bay, New South Wales, Australia",
            founder_name="Simon",
            lead_shaper_name="Simon",
            short_description="Hand-shaped twin pins, fishes, eggs, and single fins from Simon's Byron Hinterland bay — every A Mano board is shaped start to finish in-house.",
            models=models,
            logo=logo,
        )
    )

    print("POG Surfboards (Sunshine Coast)...")
    models, logo = scrape_pog()
    print(f"  pog models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="pog-surfboards",
            name="POG Surfboards",
            website_url="https://www.pogsurfboards.com",
            location_label="Sunshine Coast, Queensland, Australia",
            founder_name="Paul O'Grady",
            lead_shaper_name="Paul O'Grady",
            short_description="Custom and off-the-rack boards from Paul O'Grady on the Sunshine Coast since 1981 — Flying Fish, Sick Squid, No Brainer, and classic mals.",
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
                f"{brand['slug']}: after filter models={len(kept)} logo={bool(brand.get('logo_url'))}"
            )

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth of small USA and Australia surfboard-maker brands",
        "generated_on": "2026-08-25",
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
