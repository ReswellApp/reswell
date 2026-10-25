#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-27.json

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
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-27.json")

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
    r"used personal|last chance|custom order|photos coming|coming soon)\b",
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


def clean_yahoo_desc(text: str | None) -> str | None:
    if not text:
        return None
    text = re.sub(r"\(\d{2}\)\s*\d{4}\s*\d{4}", " ", text)
    text = re.sub(r"\d{8,}", " ", text)
    text = re.sub(r"yahoo@yahoosurfboards\.com\.au", " ", text, flags=re.I)
    text = re.sub(r"\bRead More\b", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return clip_desc(text)


def wp_page_desc(html: str) -> str | None:
    parts: list[str] = []
    for raw in re.findall(r"<(?:p|h1|h2|div)[^>]*>([\s\S]*?)</(?:p|h1|h2|div)>", html, flags=re.I):
        text = strip_html(raw)
        if not text or len(text) < 40:
            continue
        low = text.casefold()
        if any(
            skip in low
            for skip in (
                "copyright",
                "subscribe",
                "newsletter",
                "naturaliste terrace",
                "give us a call",
                "opening hours",
                "scroll",
                "more about",
                "view range",
                "let’s start talking",
                "lets start talking",
                "yahoo@yahoosurfboards",
            )
        ):
            continue
        if re.fullmatch(r"[\d\s()+.-]+", text):
            continue
        if text not in parts:
            parts.append(text)
    return clean_yahoo_desc(" ".join(parts[:4]) if parts else None)


def yahoo_board_image(html: str, *needles: str) -> str | None:
    urls = re.findall(r"(https://www\.yahoosurfboards\.com\.au/wp-content/uploads/[^\"\s]+)", html)
    cleaned: list[str] = []
    skip = (
        "logo",
        "favicon",
        "icon",
        "yahoo-home",
        "white-concrete",
        "video-thumb",
        "shaping",
        "mark-ogram-shapes",
        "barrie-mckinnon",
    )
    for raw in urls:
        url = raw.split("?")[0]
        low = url.casefold()
        if any(token in low for token in skip):
            continue
        if not url.casefold().endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        if url not in cleaned:
            cleaned.append(url)
    for needle in needles:
        for url in cleaned:
            stem = url.rsplit("/", 1)[-1].casefold()
            if needle.casefold() in stem:
                return url
    for url in cleaned:
        stem = url.rsplit("/", 1)[-1].casefold()
        if "deck" in stem or "bottom" in stem:
            return url
    return cleaned[0] if cleaned else None


# ---------------------------------------------------------------------------
# Cronin Surfboards — New Smyrna Beach, Florida. Shopify named models.
# ---------------------------------------------------------------------------
CRONIN_SKIP = {"dr"}


def scrape_cronin() -> tuple[list[dict], str | None]:
    products = shopify_all("https://croninsurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        if (product.get("product_type") or "").strip() != "All Models":
            continue
        name = html_lib.unescape(product.get("title") or "").strip()
        name = re.sub(r"\s+-\s+3 Models$", "", name).strip()
        if not name or model_key(name) in CRONIN_SKIP:
            continue
        if HARD_EXCLUDE.search(name) or SERVICE.search(name) or APPAREL.search(name):
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        if desc:
            desc = re.sub(r"^(Description|Details)\s+", "", desc).strip()
        image = image_of(product)
        if desc and image:
            merge_model(models, name, image, desc)
    logo = "https://croninsurfboards.com/cdn/shop/t/2/assets/logo.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Yahoo Surfboards — Mark Ogram own-label only (Dunsborough, WA).
# Zak Ogram models stay on z-shapes. Skip custom-order pages.
# ---------------------------------------------------------------------------
YAHOO_MARK_PAGES = [
    ("Kelvinator", "https://www.yahoosurfboards.com.au/boards/mark-ogram/kelvinator/", ("kelvinator",)),
    ("Impersonator", "https://www.yahoosurfboards.com.au/boards/mark-ogram/impersonator/", ("impersonator",)),
    ("Captain Morgan", "https://www.yahoosurfboards.com.au/boards/mark-ogram/captain-morgan/", ("captain-morgan", "captain_morgan", "morgan")),
    ("Sir Francis", "https://www.yahoosurfboards.com.au/boards/mark-ogram/sir-francis/", ("sir-francis", "francis")),
    ("Blackbeard", "https://www.yahoosurfboards.com.au/boards/mark-ogram/blackbeard/", ("blackbeard",)),
    ("Yallingup Hippy", "https://www.yahoosurfboards.com.au/boards/mark-ogram/yallingup-hippy/", ("hippy", "yallingup-hippy")),
    ("HG", "https://www.yahoosurfboards.com.au/boards/mark-ogram/hg/", ("_hg-", "hg-deck", "hg-bottom", "yahoo_surfboards")),
    ("Dhufish", "https://www.yahoosurfboards.com.au/boards/mark-ogram/dhufish/", ("dhufish",)),
    ("Wahoo", "https://www.yahoosurfboards.com.au/boards/mark-ogram/wahoo/", ("wahoo",)),
    ("Premier", "https://www.yahoosurfboards.com.au/boards/mark-ogram/premier/", ("premier",)),
    ("Twin Fun", "https://www.yahoosurfboards.com.au/boards/mark-ogram/twin-fun/", ("twin-fun", "twinfun", "twin_fun")),
    ("Keel Fish", "https://www.yahoosurfboards.com.au/boards/mark-ogram/keel-fish/", ("keel-fish", "keelfish", "keel_fish")),
    ("Single Fin", "https://www.yahoosurfboards.com.au/boards/mark-ogram/single-fin/", ("single-fin", "singlefin", "single_fin")),
    ("Moana", "https://www.yahoosurfboards.com.au/boards/mark-ogram/moana/", ("moana",)),
    ("Yallingup Blue", "https://www.yahoosurfboards.com.au/boards/mark-ogram/yallingup-blue/", ("yallingup-blue", "blue")),
    ("Foredeck", "https://www.yahoosurfboards.com.au/boards/mark-ogram/foredeck/", ("foredeck",)),
    ("Marilyn", "https://www.yahoosurfboards.com.au/boards/mark-ogram/marilyn/", ("marilyn",)),
    ("Log", "https://www.yahoosurfboards.com.au/boards/mark-ogram/log/", ("log",)),
    ("Red Beard", "https://www.yahoosurfboards.com.au/boards/yahoo-epoxy-boards/red-beard/", ("red-beard", "redbeard")),
    ("Red Herring", "https://www.yahoosurfboards.com.au/boards/yahoo-epoxy-boards/red-herring/", ("red-herring", "redherring")),
]


def scrape_yahoo() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, url, needles in YAHOO_MARK_PAGES:
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  yahoo skip {name}: {exc}")
            continue
        desc = wp_page_desc(html)
        image = yahoo_board_image(html, *needles, "deck", "bottom")
        if desc and image:
            merge_model(models, name, image, desc)
        else:
            print(f"  yahoo incomplete {name} desc={bool(desc)} image={bool(image)}")
        time.sleep(0.12)
    logo = "https://www.yahoosurfboards.com.au/wp-content/uploads/2018/05/yahoo-logo.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Geraghty Shapes — Dean Geraghty, Sunshine Coast. Product-detail pages.
# Skip deposit-only copy; keep first-party model sentences + unique OG photos.
# ---------------------------------------------------------------------------
GERAGHTY_PRODUCTS = [
    ("Nighthawk", "nighthawk"),
    ("Wingfish", "wingfish"),
    ("Ignite", "ignite"),
    ("Utopia", "utopia"),
    ("Feel Good", "feel-good"),
    ("EP-Pro", "ep-pro"),
    ("EP-Pro 2.0", "ep-pro-2-0"),
    ("Flow-Rider", "flow-rider"),
    ("ANON", "anon"),
]


def geraghty_desc(html: str, name: str) -> str | None:
    og = re.search(r'property="og:description"\s+content="([^"]+)"', html)
    raw = html_lib.unescape(og.group(1)) if og else ""
    raw = re.sub(r"Pay AU\$[\d,\.\s]+(?:or AU\$[\d,\.\s]+)?(?:deposit)?\.?", " ", raw, flags=re.I)
    raw = re.sub(r"AU\$\s*[\d,\.]+", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    if not raw or len(raw) < 40:
        return None
    if not desc_mentions_name(raw, name):
        raw = f"The {name}. {raw}"
    return clip_desc(raw)


def scrape_geraghty() -> tuple[list[dict], str | None]:
    models: dict[str, dict] = {}
    for name, slug in GERAGHTY_PRODUCTS:
        url = f"https://www.geraghtyshapes.com/product-details/product/{slug}"
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  geraghty skip {name}: {exc}")
            continue
        desc = geraghty_desc(html, name)
        image = None
        ogi = re.search(r'property="og:image"\s+content="([^"]+)"', html)
        if ogi:
            image = ogi.group(1).split("?")[0]
        if desc and image:
            merge_model(models, name, image, desc)
        else:
            print(f"  geraghty incomplete {name} desc={bool(desc)} image={bool(image)}")
        time.sleep(0.12)
    logo = (
        "https://assets.cdn.filesafe.space/XsMTdNmvtHj2xyumgbrG/media/"
        "6997cbbcf8345326f05a46ed.png"
    )
    return finalize_models(models), logo


def main() -> None:
    rejected: list[str] = []
    brands_out: list[dict] = []

    print("Cronin Surfboards (New Smyrna Beach, FL)...")
    models, logo = scrape_cronin()
    print(f"  cronin models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="cronin-surfboards",
            name="Cronin Surfboards",
            website_url="https://croninsurfboards.com",
            location_label="New Smyrna Beach, Florida",
            founder_name="Craig Cronin",
            lead_shaper_name="Craig Cronin",
            short_description="East Coast shortboards, grovelers, hybrids, and logs from Craig Cronin in New Smyrna Beach — named models shaped for Florida beach breaks.",
            models=models,
            logo=logo,
        )
    )

    print("Yahoo Surfboards / Mark Ogram (Dunsborough, WA)...")
    models, logo = scrape_yahoo()
    print(f"  yahoo models={len(models)} logo={bool(logo)} (images 403 from this IP — not imported)")

    print("Geraghty Shapes (Sunshine Coast, QLD)...")
    models, logo = scrape_geraghty()
    print(f"  geraghty models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="geraghty-shapes",
            name="Geraghty Shapes",
            website_url="https://www.geraghtyshapes.com",
            location_label="Buderim, Sunshine Coast, Queensland",
            founder_name="Dean Geraghty",
            lead_shaper_name="Dean Geraghty",
            short_description="Custom shortboards, hybrids, mid-lengths, and logs from Dean Geraghty on the Sunshine Coast — named models refined across 35 years of shaping.",
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
                print(f"  drop reused image {brand['slug']}/{model['name']}")
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
        "generated_on": "2026-08-27",
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
