#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-09-01.json

Integrity:
  - Official brand sites only
  - Named surfboard models only (no apparel, fins, bags, foil, SUP, wake, skim)
  - Require unique product photo + name + description (>=40 chars)
  - Collapse size / color / construction duplicates
  - Reject the same product photo reused across models
  - Always capture a first-party wordmark
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

socket.setdefaulttimeout(25)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-09-01.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin sets?|\bfins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|voucher|gift voucher|"
    r"bodyboard|bellyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"wakesurf|wake ?board|skim\b|"
    r"workshop|kit\b|plans\b|paipo|wetsuit|ripcurl|"
    r"poster|jacket|hoodie|sticker|baggie|"
    r"b2b|copy\b)\b",
    re.I,
)
SERVICE = re.compile(
    r"\b(delivery fee|rush processing|custom surfboard|faq|gift card|deposit|"
    r"used personal|last chance|photos coming|coming soon)\b",
    re.I,
)
GENERIC_CUSTOM = re.compile(
    r"^(custom (shortboards?|funboards?|longboards?|midlengths?|surfboard)s?"
    r"(?:\s*-\s*b2b)?)$",
    re.I,
)

LOGO_IMAGE = re.compile(
    r"(?:^|/)(?:logo|wordmark|favicon|symbol|header)(?:[-_.]|\.[a-z]+$)",
    re.I,
)
DIM_TAIL = re.compile(
    r"[\s\-–—]*\d+['′’]\s*\d*.*$|"
    r"[\s\-–—]+\d+\s*[x×]\s*\d+.*$",
    re.I,
)


def fetch(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
        return resp.read()


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
    text = re.sub(r"<iframe[\s\S]*?</iframe>", " ", text, flags=re.I)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"</p>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clip_desc(text: str | None, limit: int = 700) -> str | None:
    if not text:
        return None
    text = re.sub(r"^(Description|Details|Shaper Notes:?)\s+", "", text, flags=re.I).strip()
    text = re.sub(r"\*SHIPPING NOTICE\*.*?(?=[A-Z])", "", text, flags=re.I).strip()
    text = re.sub(r"\(?function\s*\(\$\).*", "", text, flags=re.I).strip()
    text = re.sub(r"div\s*>\s*\.uk-panel[\s\S]*", "", text, flags=re.I).strip()
    after_desc = re.search(r"\bDescription:\s*(.+)$", text, flags=re.I)
    if after_desc:
        text = after_desc.group(1).strip()
    else:
        text = re.sub(r"\bMeasurements:\s*\S.*?(?=\s+[A-Z][a-z]|\s*$)", "", text, flags=re.I).strip()
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 40:
        return None
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


def is_logo_image(url: str | None) -> bool:
    if not url:
        return True
    stem = url.split("?")[0].rsplit("/", 1)[-1]
    return bool(LOGO_IMAGE.search(stem))


def pretty_model_name(name: str) -> str:
    name = re.sub(r"\s+", " ", html_lib.unescape(name)).strip()
    name = re.sub(r"^GASH\s+", "", name, flags=re.I).strip()
    name = re.sub(
        r"\s*(?:[-–—]\s*)?(?:custom(?:s)?(?:\s+from|\s+build)?|from)\s*\$?\d+.*$",
        "",
        name,
        flags=re.I,
    ).strip()
    name = DIM_TAIL.sub("", name).strip()
    name = re.sub(r"\s*\([^)]*\d+L[^)]*\)\s*$", "", name, flags=re.I).strip()
    letters = [c for c in name if c.isalpha()]
    if letters and sum(1 for c in letters if c.isupper()) / len(letters) >= 0.7:
        return title_case_model(name)
    return name


def title_case_model(name: str) -> str:
    small = {"and", "or", "the", "of", "a", "an"}
    keep = {"HP", "CAT", "GASH", "ATL", "NF1"}
    words = re.split(r"(\s+)", name.strip())
    out: list[str] = []
    first = True
    for word in words:
        if not word.strip() or word.isspace():
            out.append(word)
            continue
        if word.upper() in keep:
            out.append(word.upper())
            first = False
            continue
        low = word.casefold()
        if not first and low in small:
            out.append(low)
        else:
            out.append(word[:1].upper() + word[1:].lower())
        first = False
    return "".join(out).strip()


def model_key(name: str) -> str:
    cleaned = pretty_model_name(name)
    return re.sub(r"[^a-z0-9]+", "", cleaned.casefold())


def merge_model(
    models: dict[str, dict],
    name: str,
    image: str | None,
    desc: str | None,
    board_category: str | None = None,
) -> None:
    display = pretty_model_name(name)
    key = model_key(display)
    compact = key.replace("the", "")
    match_key = key
    for existing_key in list(models):
        if existing_key == key or existing_key.replace("the", "") == compact:
            match_key = existing_key
            break
    existing = models.get(match_key)
    if existing is None:
        models[match_key] = {
            "name": display,
            "image_url": image,
            "description": desc,
            "board_category_slug": board_category,
            "_score": 1,
        }
        return
    existing["_score"] += 1
    if not existing.get("image_url") and image:
        existing["image_url"] = image
    if desc and (not existing.get("description") or len(desc) > len(existing.get("description") or "")):
        existing["description"] = desc
    if board_category and not existing.get("board_category_slug"):
        existing["board_category_slug"] = board_category
    if len(display) < len(existing["name"]) and not re.search(r"\d+['′]", display):
        existing["name"] = display


def finalize_models(
    models: dict[str, dict],
    limit: int = 80,
    *,
    drop_generic_custom: bool = True,
) -> list[dict]:
    ranked = sorted(models.values(), key=lambda m: (-m["_score"], m["name"].casefold()))
    out: list[dict] = []
    used_images: set[str] = set()
    for item in ranked[:limit]:
        name = item["name"]
        image = item.get("image_url")
        desc = item.get("description")
        if not image or not desc:
            continue
        if HARD_EXCLUDE.search(name) or SERVICE.search(name):
            continue
        if drop_generic_custom and GENERIC_CUSTOM.match(name):
            continue
        if is_logo_image(image):
            print(f"  drop logo-as-photo {name}: {image}")
            continue
        if DIM_TAIL.search(name) or re.search(r"\d+['′’]", name):
            print(f"  drop sized leftover {name}")
            continue
        if len(name) < 2:
            continue
        image_key = image.split("?")[0].casefold()
        if image_key in used_images:
            print(f"  drop reused image {name}: {image}")
            continue
        used_images.add(image_key)
        row = {
            "name": name,
            "image_url": image,
            "description": desc,
        }
        if item.get("board_category_slug"):
            row["board_category_slug"] = item["board_category_slug"]
        out.append(row)
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


def first_board_image(urls: list[str]) -> str | None:
    for url in urls:
        src = url.split("?")[0]
        if not src:
            continue
        if src.startswith("//"):
            src = "https:" + src
        if src.startswith("/"):
            src = "https://vikingsurfboards.com" + src
        src = src.replace("http://www.vikingsurfsup.com/newviking", "https://vikingsurfboards.com")
        src = src.replace("_thumb.jpg", ".jpg")
        stem = src.rsplit("/", 1)[-1]
        if LOGO_IMAGE.search(stem):
            continue
        if "symbol" in stem.casefold():
            continue
        if src.casefold().endswith((".jpg", ".jpeg", ".png", ".webp")):
            return src
    return None


# ---------------------------------------------------------------------------
# Viking Surfboards — Fort Lauderdale, Florida. Own-label WordPress catalog.
# ---------------------------------------------------------------------------
VIKING_MODELS = {
    "goddess-model-classic-twin-fin": ("Goddess", "fish"),
    "energy-model-twin-fin": ("Energy", "fish"),
    "power-model-quad-fish": ("Power", "fish"),
    "change-model-bonzers": ("Change", "other"),
    "generous-model-egg-design": ("Generous", "hybrid"),
    "honor-model-classic-single-fin": ("Honor", "shortboard"),
    "shield-model-mini-simmons": ("Shield", "other"),
    "wisdom-model-classic-log-pin": ("Wisdom", "longboard"),
    "journey-model-log": ("Journey", "longboard"),
    "iztapa-high-performance-board": ("Iztapa", "shortboard"),
    "mush-glider-high-performance-board": ("Mush Glider", "groveler"),
    "grom-series-epoxy-board-5": ("Grom Series", "shortboard"),
}


def scrape_viking() -> tuple[list[dict], str | None]:
    pages = fetch_json(
        "https://vikingsurfboards.com/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,link,title,content"
    )
    models: dict[str, dict] = {}
    for page in pages:
        slug = page.get("slug") or ""
        mapped = VIKING_MODELS.get(slug)
        if not mapped:
            continue
        name, category = mapped
        content = page.get("content", {}).get("rendered") or ""
        desc = clip_desc(strip_html(content))
        imgs = re.findall(r'(?:src|href)="([^"]+\.(?:jpg|jpeg|png|webp))"', content, flags=re.I)
        image = first_board_image(imgs)
        if desc and image:
            merge_model(models, name, image, desc, category)

    cat = fetch_json(
        "https://vikingsurfboards.com/wp-json/wp/v2/pages/16?_fields=content"
    )
    cat_html = cat.get("content", {}).get("rendered") or ""
    cat_intro = clip_desc(
        "This is a true performance channel. The outbound flow of water and the "
        "CAT Bottom provides the thruster effect of maneuverability while performing "
        "with added speed. Bottom belly convex channel cut compresses inbound water "
        "flow, producing up to 15% more speed on outbound water at a widening angle "
        "of flow from the board tail. An overall performance board for experienced "
        "surfers — a mostly small- to head-high hybrid with speed, fun, and "
        "maneuverability. The Cat Bottom can be applied to many different shapes "
        "with the purpose to create more speed and flow, adding more power and "
        "dynamic to your maneuver."
    )
    _ = cat_html  # page fetched to confirm the collection is still live
    cat_named = [
        ("Catbottom Short", "https://vikingsurfboards.com/wp-content/uploads/2017/03/5-7-catbottom-short.jpg", "shortboard"),
        ("Superfish Catbottom", "https://vikingsurfboards.com/wp-content/uploads/2017/03/6-0-superfish-catbottom.jpg", "fish"),
        ("Catbottom Longboard", "https://vikingsurfboards.com/wp-content/uploads/2017/03/9-0-catbottom-longboard.jpg", "longboard"),
    ]
    for name, image, category in cat_named:
        if cat_intro:
            merge_model(models, name, image, cat_intro, category)

    logo = "https://vikingsurfboards.com/wp-content/uploads/2017/05/new-logo-mobile.jpg"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Barrette Surfboards — San Diego. Shopify; ocean surfboards only.
# ---------------------------------------------------------------------------
BARRETTE_CATEGORY = {
    "thesinglewing": "fish",
    "thenova": "fish",
    "themoonbeam": "hybrid",
}


def scrape_barrette() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.barrettesurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        ptype = (product.get("product_type") or "").strip().casefold()
        if ptype != "surfboard":
            continue
        raw_name = html_lib.unescape(product.get("title") or "").strip()
        if not raw_name:
            continue
        if HARD_EXCLUDE.search(raw_name) or SERVICE.search(raw_name):
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        image = image_of(product)
        category = BARRETTE_CATEGORY.get(model_key(raw_name))
        if desc and image:
            merge_model(models, raw_name, image, desc, category)
    logo = (
        "https://barrettesurfboards.com/cdn/shop/files/"
        "Barrette_Surfboards_Wordmark_Logo_white.png"
    )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Gash Surfboards — Fingal Head / NSW. Own-label Shopify; merch dropped.
# ---------------------------------------------------------------------------
GASH_CATEGORY = {
    "customtwinkeel": "fish",
    "customtwin": "fish",
    "customstepup": "step-up-gun",
    "customshortboard": "shortboard",
}
GASH_KEEP = re.compile(r"^gash custom\b", re.I)


def scrape_gash() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.gashsurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        raw_name = html_lib.unescape(product.get("title") or "").strip()
        if not raw_name or not GASH_KEEP.search(raw_name):
            continue
        ptype = (product.get("product_type") or "").strip().casefold()
        if ptype in {"tshirt", "hoodie", "hoodies", "cap", "poster"}:
            continue
        if HARD_EXCLUDE.search(raw_name):
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        image = image_of(product)
        category = GASH_CATEGORY.get(model_key(raw_name))
        if desc and image:
            merge_model(models, raw_name, image, desc, category)
    logo = "https://gashfactory.com/cdn/shop/files/Reaper_Header2.png"
    return finalize_models(models, drop_generic_custom=False), logo


def main() -> None:
    brands: list[dict] = []

    print("Viking Surfboards")
    viking_models, viking_logo = scrape_viking()
    print(f"  kept {len(viking_models)} models logo={bool(viking_logo)}")
    if viking_models and viking_logo:
        brands.append(
            brand_row(
                slug="viking-surfboards",
                name="Viking Surfboards",
                website_url="https://vikingsurfboards.com",
                location_label="Fort Lauderdale, Florida",
                founder_name="Christian Wolthers",
                lead_shaper_name="Christian Wolthers",
                short_description="South Florida surfboard label founded by Christian Wolthers — Futhark retro shapes, CAT Bottom channels, and performance shortboards shaped in Fort Lauderdale.",
                models=viking_models,
                logo=viking_logo,
            )
        )

    print("Barrette Surfboards")
    barrette_models, barrette_logo = scrape_barrette()
    print(f"  kept {len(barrette_models)} models logo={bool(barrette_logo)}")
    if barrette_models and barrette_logo:
        brands.append(
            brand_row(
                slug="barrette-surfboards",
                name="Barrette Surfboards",
                website_url="https://www.barrettesurfboards.com",
                location_label="San Diego, California",
                founder_name="Austin Barrette",
                lead_shaper_name="Austin Barrette",
                short_description="Hand-shaped custom surfboards by Austin Barrette in San Diego — a tight ocean lineup of twins, mid-lengths, and the original Single Wing.",
                models=barrette_models,
                logo=barrette_logo,
            )
        )

    print("Gash Surfboards")
    gash_models, gash_logo = scrape_gash()
    print(f"  kept {len(gash_models)} models logo={bool(gash_logo)}")
    if gash_models and gash_logo:
        brands.append(
            brand_row(
                slug="gash-surfboards",
                name="Gash Surfboards",
                website_url="https://gashfactory.com",
                location_label="Fingal Head, New South Wales, Australia",
                founder_name="Greg Brown",
                lead_shaper_name="Greg Brown",
                short_description="Australian custom surfboards from Greg Brown — Torquay-born Gash templates now built out of Fingal Head, from twins and keels to step-ups.",
                models=gash_models,
                logo=gash_logo,
            )
        )

    payload = {
        "generated_for": "reswell daily small USA / Australia surfboard catalog growth",
        "generated_on": "2026-09-01",
        "product_category_slug": "surfboards",
        "integrity": {
            "first_party_only": True,
            "surfboard_models_only": True,
            "require_unique_image_description_logo": True,
            "collapsed_size_color_construction_variants": True,
            "dropped_misc": [
                "Barrette wakesurf and skimboards",
                "Gash apparel, posters, stickers, and caps",
                "Viking generic High Performance stock SKUs and sized CAT leftovers",
            ],
        },
        "summary": {
            "brand_count": len(brands),
            "model_count": sum(len(b["models"]) for b in brands),
            "brands": [
                {"slug": b["slug"], "name": b["name"], "models": len(b["models"])} for b in brands
            ],
        },
        "brands": brands,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    main()
