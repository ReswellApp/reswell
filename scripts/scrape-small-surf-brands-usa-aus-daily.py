#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-09-02.json

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
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-09-02.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin sets?|\bfins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|voucher|gift voucher|"
    r"bodyboard|bellyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"wakesurf|wake ?board|skim\b|"
    r"workshop|kit\b|plans\b|paipo|wetsuit|ripcurl|"
    r"poster|jacket|hoodie|sticker|baggie|"
    r"b2b|copy\b|fin placement|material|colour|tint)\b",
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
    text = html_lib.unescape(html_lib.unescape(raw))
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
    text = re.sub(r"^\ufeff+", "", text).strip()
    text = re.sub(
        r"^(Description|Details|Shaper Notes:?|BOARD SUMMARIZATION)\s+",
        "",
        text,
        flags=re.I,
    ).strip()
    text = re.sub(r"\*SHIPPING NOTICE\*.*?(?=[A-Z])", "", text, flags=re.I).strip()
    text = re.sub(r"\(?function\s*\(\$\).*", "", text, flags=re.I).strip()
    text = re.sub(r"div\s*>\s*\.uk-panel[\s\S]*", "", text, flags=re.I).strip()
    after_desc = re.search(r"\bDescription:\s*(.+)$", text, flags=re.I)
    if after_desc:
        text = after_desc.group(1).strip()
    else:
        text = re.sub(
            r"\bMeasurements:\s*\S.*?(?=\s+[A-Z][a-z]|\s*$)",
            "",
            text,
            flags=re.I,
        ).strip()
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
    name = re.sub(r"\s*\|\s*EXO\s*$", "", name, flags=re.I).strip()
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
    keep = {"HP", "CAT", "M1V5", "CH", "EXO"}
    words = re.split(r"(\s+|/|-)", name.strip())
    out: list[str] = []
    first = True
    for word in words:
        if not word.strip() or word.isspace() or word in {"/", "-"}:
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
    return re.sub(r"\s+", " ", "".join(out)).strip()


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
    if desc and (
        not existing.get("description") or len(desc) > len(existing.get("description") or "")
    ):
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


# ---------------------------------------------------------------------------
# Mana Surfboards — Central Coast NSW. Own-label Shopify catalog.
# ---------------------------------------------------------------------------
MANA_CATEGORY = {
    "sabre": "groveler",
    "footsoldier": "groveler",
    "apexstepup": "step-up-gun",
    "m1v5": "shortboard",
    "ventura": "hybrid",
    "mammothgun": "step-up-gun",
}
MANA_OPTION_TITLES = {
    "fins",
    "finplacement",
    "material",
    "colour",
    "color",
    "tint",
}


def scrape_mana() -> tuple[list[dict], str | None]:
    products = shopify_all("https://manasurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        raw_name = html_lib.unescape(product.get("title") or "").strip()
        if not raw_name:
            continue
        if model_key(raw_name) in MANA_OPTION_TITLES:
            continue
        if HARD_EXCLUDE.search(raw_name) or SERVICE.search(raw_name):
            continue
        images = product.get("images") or []
        if not images:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        image = image_of(product)
        category = MANA_CATEGORY.get(model_key(raw_name))
        if desc and image:
            merge_model(models, raw_name, image, desc, category)
    logo = "https://manasurfboards.com/cdn/shop/files/Mana-Circular-jaws-Jaws.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Campbell Designed — Noosa, QLD. Own-label Shopify; gift cards dropped.
# ---------------------------------------------------------------------------
CAMPBELL_CATEGORY = {
    "twincam": "fish",
    "missletoe": "shortboard",
    "wingman": "fish",
    "hiptoe": "groveler",
    "middletoe": "hybrid",
    "sacrifishal": "fish",
    "littletoe": "shortboard",
    "campbelltoe": "step-up-gun",
    "thetoe": "shortboard",
    "chtoe": "groveler",
    "chunkytoe": "groveler",
}


def scrape_campbell() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.campbelldesigned.com")
    models: dict[str, dict] = {}
    for product in products:
        ptype = (product.get("product_type") or "").strip().casefold()
        if ptype not in {"surfboards", "surfboard"}:
            continue
        raw_name = html_lib.unescape(product.get("title") or "").strip()
        if not raw_name:
            continue
        if HARD_EXCLUDE.search(raw_name) or SERVICE.search(raw_name):
            continue
        display = raw_name
        if model_key(raw_name) in {"chtoe", "chtoeexo"}:
            display = "Chunky Toe"
        desc = clip_desc(strip_html(product.get("body_html")))
        image = image_of(product)
        category = CAMPBELL_CATEGORY.get(model_key(display)) or CAMPBELL_CATEGORY.get(
            model_key(raw_name)
        )
        if desc and image:
            merge_model(models, display, image, desc, category)
    logo = "https://www.campbelldesigned.com/cdn/shop/files/cambelldesigned.png?v=1637198707"
    return finalize_models(models), logo


def main() -> None:
    brands: list[dict] = []

    print("Mana Surfboards")
    mana_models, mana_logo = scrape_mana()
    print(f"  kept {len(mana_models)} models logo={bool(mana_logo)}")
    if mana_models and mana_logo:
        brands.append(
            brand_row(
                slug="mana-surfboards",
                name="Mana Surfboards",
                website_url="https://manasurfboards.com",
                location_label="Central Coast, New South Wales, Australia",
                founder_name="Dan McManus",
                lead_shaper_name="Dan McManus",
                short_description="Performance custom surfboards by Central Coast shaper Dan McManus — high-performance shortboards, grovelers, mid-length trackers, and heavy-water guns.",
                models=mana_models,
                logo=mana_logo,
            )
        )

    print("Campbell Designed")
    campbell_models, campbell_logo = scrape_campbell()
    print(f"  kept {len(campbell_models)} models logo={bool(campbell_logo)}")
    if campbell_models and campbell_logo:
        brands.append(
            brand_row(
                slug="campbell-designed",
                name="Campbell Designed",
                website_url="https://www.campbelldesigned.com",
                location_label="Noosa, Queensland, Australia",
                founder_name="Stuart Campbell",
                lead_shaper_name="Stuart Campbell",
                short_description="Noosa father-and-son label from Stuart and Ryan Campbell — performance shortboards, fishes, and mid-lengths built with patented Exo Flex construction.",
                models=campbell_models,
                logo=campbell_logo,
            )
        )

    payload = {
        "generated_for": "reswell daily small USA / Australia surfboard catalog growth",
        "generated_on": "2026-09-02",
        "product_category_slug": "surfboards",
        "integrity": {
            "first_party_only": True,
            "surfboard_models_only": True,
            "require_unique_image_description_logo": True,
            "collapsed_size_color_construction_variants": True,
            "dropped_misc": [
                "Mana Shopify option SKUs (fins, fin placement, material, colour, tint)",
                "Campbell Designed gift cards",
            ],
            "scanned_but_not_imported": [
                "Senator / James Fulbright (Galveston) — sold through multi-brand Strictly Hardcore shop; no clean first-party Senator wordmark; many SKUs are sized one-offs",
                "Strive Surfboards (Santa Cruz) — named copy exists but the official page does not pair a unique board photo to each model",
                "Leatherman Surfboards (Oregon) — named families exist; Squarespace photos are portraits and lineups, not unique product shots",
                "BLANCS (Tweed / Byron) — custom-order form only",
                "Donald Brink / Brink Surf — custom-only, no named production catalog",
                "LAD Surfboards (Margaret River) — no public first-party catalog",
                "Yahoo Surfboards / Dave Macaulay — SiteGround image CDN still blocked",
                "Sanctum Surf (Warriewood) — shop feed still 403",
                "Aloha Australia boardstore — stocks MF Softboards and other labels; not a small single-shaper catalog",
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
