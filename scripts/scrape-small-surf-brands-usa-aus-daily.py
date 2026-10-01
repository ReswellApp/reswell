#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-28.json

Integrity:
  - Official brand sites only
  - Named surfboard models only (no apparel, fins, bags, foil, SUP, gift cards)
  - Require unique product photo + name + description (>=40 chars)
  - Collapse size / color / construction / B2B duplicates
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

socket.setdefaulttimeout(20)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-28.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin sets?|\bfins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|voucher|gift voucher|"
    r"bodyboard|bellyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"workshop|kit\b|plans\b|paipo|wetsuit|ripcurl|"
    r"b2b|copy\b)\b",
    re.I,
)
SERVICE = re.compile(
    r"\b(delivery fee|rush processing|custom surfboard|faq|gift card|deposit|"
    r"used personal|last chance|photos coming|coming soon|eps build|"
    r"colour detailing|color detailing)\b",
    re.I,
)
GENERIC_CUSTOM = re.compile(
    r"^(custom (shortboards?|funboards?|longboards?|midlengths?|surfboard)s?"
    r"(?:\s*-\s*b2b)?)$",
    re.I,
)

BOARD_CATEGORY_BY_HINT = {
    "longboards": "longboard",
    "long boards": "longboard",
    "midlengths": "hybrid",
    "mid lengths": "hybrid",
    "shortboards": "shortboard",
    "short boards": "shortboard",
    "fun boards": "fish",
    "step ups": "step-up-gun",
    "grom boards": "shortboard",
    "stock boards": None,
}


def fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9"},
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
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"</p>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clip_desc(text: str | None, limit: int = 700) -> str | None:
    if not text:
        return None
    text = re.sub(r"^(Description|Details|Shaper Notes:?)\s+", "", text, flags=re.I).strip()
    text = re.sub(
        r"^(Build (Your|Custom)|Builder Your|Custom Board Builder)[^.]*\.?\s*",
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


LOGO_IMAGE = re.compile(r"(?:^|/)(?:logo|wordmark|bauer|favicon)(?:[-_.]|\.[a-z]+$)", re.I)
DIM_TAIL = re.compile(
    r"[\s\-–—]*\d+['′’]\s*\d*.*$|"
    r"[\s\-–—]+\d+\s*[x×]\s*\d+.*$",
    re.I,
)


def is_logo_image(url: str | None) -> bool:
    if not url:
        return True
    stem = url.split("?")[0].rsplit("/", 1)[-1]
    return bool(LOGO_IMAGE.search(stem))


def pretty_model_name(name: str) -> str:
    name = re.sub(r"\s+", " ", html_lib.unescape(name)).strip()
    name = re.sub(
        r"\s*(?:[-–—]\s*)?(?:custom(?:s)?(?:\s+from|\s+build)?|from)\s*\$?\d+.*$",
        "",
        name,
        flags=re.I,
    ).strip()
    name = re.sub(r"\s*[-–—]\s*(?:B2B|Custom Build)\s*$", "", name, flags=re.I).strip()
    name = re.sub(r"\s+EPOXY\s+EPS\b.*$", "", name, flags=re.I).strip()
    name = DIM_TAIL.sub("", name).strip()
    name = re.sub(r"\s*\([^)]*\d+L[^)]*\)\s*$", "", name, flags=re.I).strip()
    letters = [c for c in name if c.isalpha()]
    if letters and sum(1 for c in letters if c.isupper()) / len(letters) >= 0.7:
        return title_case_model(name)
    return name


def title_case_model(name: str) -> str:
    small = {"and", "or", "the", "of", "a", "an"}
    keep = {"V3", "T2", "TFL", "XLR8", "MLOW", "HP", "NR", "ED"}
    words = re.split(r"(\s+)", name.strip())
    out: list[str] = []
    first = True
    for word in words:
        if not word.strip() or word.isspace():
            out.append(word)
            continue
        if word.upper() in keep or re.fullmatch(r"[A-Z0-9]{2,6}", word):
            out.append(word.upper() if word.upper() in keep else word)
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


def finalize_models(models: dict[str, dict], limit: int = 80) -> list[dict]:
    ranked = sorted(models.values(), key=lambda m: (-m["_score"], m["name"].casefold()))
    out: list[dict] = []
    used_images: set[str] = set()
    for item in ranked[:limit]:
        name = item["name"]
        image = item.get("image_url")
        desc = item.get("description")
        if not image or not desc:
            continue
        if HARD_EXCLUDE.search(name) or SERVICE.search(name) or GENERIC_CUSTOM.match(name):
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
# Bauer Surfboards — Port Angeles, Washington. Own-label Shopify stock models.
# ---------------------------------------------------------------------------
BAUER_CATEGORY = {
    "longboards": "longboard",
    "midlengths": "hybrid",
    "shortboards": None,
}
BAUER_MODEL_CATEGORY = {
    "retrofish": "fish",
    "thelongfish": "fish",
    "channeltwinpin": "fish",
    "hpgrovellersquash": "groveler",
    "hpdriverroundtail": "shortboard",
    "singlewingswallow": "shortboard",
    "spicolisspeedegg": "hybrid",
    "minimalibu": "hybrid",
    "glider": "longboard",
    "bullkelp": "longboard",
    "bullwhipcompnr": "longboard",
}


def scrape_bauer() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.bauersurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        raw_name = html_lib.unescape(product.get("title") or "").strip()
        if not raw_name:
            continue
        tags = " ".join(product.get("tags") or []).casefold()
        if "b2b" in tags or raw_name.casefold().endswith("- b2b"):
            continue
        if "(copy)" in raw_name.casefold():
            continue
        if HARD_EXCLUDE.search(raw_name) or SERVICE.search(raw_name) or GENERIC_CUSTOM.match(raw_name):
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        image = image_of(product)
        ptype = (product.get("product_type") or "").strip().casefold()
        category = BAUER_MODEL_CATEGORY.get(model_key(raw_name)) or BAUER_CATEGORY.get(ptype)
        if desc and image:
            merge_model(models, raw_name, image, desc, category)
    logo = "https://www.bauersurfboards.com/cdn/shop/files/bauerCovered.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Carabine Surfboards — Bellambi / Wollongong, NSW. Own-label WooCommerce.
# Shop also stocks Rip Curl wetsuits and merch — those are dropped.
# ---------------------------------------------------------------------------
CARABINE_KEEP_CATS = {
    "short boards",
    "fun boards",
    "mid lengths",
    "long boards",
    "step ups",
    "grom boards",
    "stock boards",
}
CARABINE_MODEL_CATEGORY = {
    "ifish": "fish",
    "whippa": "fish",
    "taka": "hybrid",
    "quadzilla": "fish",
    "mudrat": "fish",
    "modfish": "fish",
    "mred": "hybrid",
    "kong": "hybrid",
    "hornet": "hybrid",
    "spacepig": "longboard",
    "pinhead": "longboard",
    "thesub": "longboard",
    "shakey": "longboard",
    "nickoff": "longboard",
    "xlr8": "step-up-gun",
    "mlow": "step-up-gun",
    "v3": "shortboard",
    "tfl": "shortboard",
    "t2": "shortboard",
    "no12": "shortboard",
    "modelt": "shortboard",
    "thebull": "shortboard",
    "bomb": "shortboard",
    "bigo": "shortboard",
    "minifrother": "shortboard",
    "evilmonkey": "shortboard",
}


def scrape_carabine() -> tuple[list[dict], str | None]:
    products: list[dict] = []
    page = 1
    while True:
        batch = fetch_json(f"https://carabine.surf/wp-json/wc/store/v1/products?per_page=100&page={page}")
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 100:
            break
        page += 1
        time.sleep(0.1)

    models: dict[str, dict] = {}
    for product in products:
        cats = {(c.get("name") or "").strip().casefold() for c in (product.get("categories") or [])}
        if not (cats & CARABINE_KEEP_CATS):
            continue
        if "merch" in cats:
            continue
        raw_name = html_lib.unescape(product.get("name") or "").strip()
        if not raw_name:
            continue
        if HARD_EXCLUDE.search(raw_name) or SERVICE.search(raw_name) or GENERIC_CUSTOM.match(raw_name):
            continue
        desc = clip_desc(strip_html(product.get("description") or product.get("short_description")))
        images = product.get("images") or []
        image = None
        for image_row in images:
            src = (image_row.get("src") or "").split("?")[0]
            if src and not src.casefold().endswith(".heic"):
                image = src
                break
        category = CARABINE_MODEL_CATEGORY.get(model_key(raw_name))
        if not category:
            for cat in cats:
                mapped = BOARD_CATEGORY_BY_HINT.get(cat)
                if mapped:
                    category = mapped
                    break
        if desc and image:
            merge_model(models, raw_name, image, desc, category)
    logo = "https://carabine.surf/wp-content/uploads/2019/10/Carabine-Surf-Text-Blue.png"
    return finalize_models(models), logo


def main() -> None:
    brands: list[dict] = []

    print("Bauer Surfboards")
    bauer_models, bauer_logo = scrape_bauer()
    print(f"  kept {len(bauer_models)} models logo={bool(bauer_logo)}")
    if bauer_models and bauer_logo:
        brands.append(
            brand_row(
                slug="bauer-surfboards",
                name="Bauer Surfboards",
                website_url="https://www.bauersurfboards.com",
                location_label="Port Angeles, Washington",
                founder_name="Chris Bauer",
                lead_shaper_name="Chris Bauer",
                short_description="Hand-shaped Pacific Northwest surfboards from Chris Bauer in Port Angeles — stock models tested in cold-water beach breaks.",
                models=bauer_models,
                logo=bauer_logo,
            )
        )

    print("Carabine Surfboards")
    carabine_models, carabine_logo = scrape_carabine()
    print(f"  kept {len(carabine_models)} models logo={bool(carabine_logo)}")
    if carabine_models and carabine_logo:
        brands.append(
            brand_row(
                slug="carabine-surfboards",
                name="Carabine Surfboards",
                website_url="https://carabine.surf",
                location_label="Bellambi, New South Wales, Australia",
                short_description="Wollongong-area custom surfboards from Carabine — shortboards, fishes, mid-lengths, and longboards shaped and glassed on site.",
                models=carabine_models,
                logo=carabine_logo,
            )
        )

    payload = {
        "generated_for": "reswell daily small USA / Australia surfboard catalog growth",
        "generated_on": "2026-08-28",
        "product_category_slug": "surfboards",
        "integrity": {
            "first_party_only": True,
            "surfboard_models_only": True,
            "require_unique_image_description_logo": True,
            "collapsed_size_color_construction_variants": True,
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
