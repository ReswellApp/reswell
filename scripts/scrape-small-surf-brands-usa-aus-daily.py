#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-22.json

Integrity:
  - Official brand sites only
  - Named surfboard models only (no apparel, fins, bags, foil, SUP, gift cards)
  - Require image + name + description
  - Collapse size / color / duplicate titles
  - Always capture a first-party logo
"""
from __future__ import annotations

import html as html_lib
import json
import re
import socket
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

socket.setdefaulttimeout(20)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-22.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin set|\bfins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|custom order|voucher|"
    r"bodyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"changing robe|changing mat|grip\b|pad\b)\b",
    re.I,
)
BOARD = re.compile(
    r"\b(surfboards?|softboards?|soft[\s-]?tops?|longboards?|shortboards?|"
    r"funboards?|mid[\s-]?lengths?|eggs?|fishes?|twin|single[\s-]?fin|"
    r"groveler|gun|malibu|mini[\s-]?mal|log|glider|step[\s-]?up)\b",
    re.I,
)
SERVICE = re.compile(
    r"\b(delivery fee|rush processing|custom surfboard|faq|gift card|deposit)\b",
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


def fetch_json(url: str) -> dict:
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
        time.sleep(0.2)
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
    if images and images[0].get("src"):
        return images[0]["src"].split("?")[0]
    return None


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def clean_model_name(title: str, brand_name: str) -> str:
    name = html_lib.unescape(title).strip()
    for prefix in [brand_name, brand_name.replace("&", "and")]:
        if name.casefold().startswith(prefix.casefold()):
            name = name[len(prefix) :].lstrip(" -|:/")
    name = re.sub(r"\s+", " ", name).strip(" -|:/")
    name = re.sub(r"\s+[–—-]\s+Next Gen\s*$", "", name, flags=re.I)
    name = re.sub(r"\s+Next Gen\s*$", "", name, flags=re.I)
    m = re.match(
        r"(.+?)(?:\s+[-–—]\s+|\s+)(\d+['′]\d*(?:[\"″]\d*)?(?:\s*[x×].*)?)$",
        name,
    )
    if m and len(m.group(1).strip()) >= 3:
        candidate = m.group(1).strip(" -|:/")
        if not re.match(r"^\d+", candidate):
            name = candidate
    return name[:120].strip()


def is_surfboard_product(product: dict, allowed_types: set[str] | None = None) -> bool:
    title = product.get("title") or ""
    product_type = product.get("product_type") or ""
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    if SERVICE.search(title):
        return False
    if HARD_EXCLUDE.search(title) or HARD_EXCLUDE.search(product_type):
        return False
    if allowed_types:
        return product_type.casefold() in {t.casefold() for t in allowed_types}
    blob = f"{title} {product_type} {tags}"
    if re.search(r"soft\s*-?\s*(board|top)|surfboard|longboard|shortboard|funboard", product_type, re.I):
        return True
    if not product_type:
        return not HARD_EXCLUDE.search(title) and not SERVICE.search(title)
    return bool(BOARD.search(blob))


def products_to_models(
    products: list[dict],
    brand_name: str,
    *,
    allowed_types: set[str] | None = None,
    limit: int = 80,
) -> list[dict]:
    models: dict[str, dict] = {}
    for product in products:
        if not is_surfboard_product(product, allowed_types):
            continue
        title = (product.get("title") or "").strip()
        if not title:
            continue
        name = clean_model_name(title, brand_name)
        if len(name) < 2 or SERVICE.search(name) or HARD_EXCLUDE.search(name):
            continue
        key = model_key(name)
        if not key:
            continue
        # Merge near-duplicates (Hog Fish / Hogfish, Slab Slayer / Slabslayer)
        aliases = [key]
        compact = key.replace("the", "")
        aliases.append(compact)
        match_key = key
        for existing_key in list(models):
            if existing_key == key or existing_key.replace("the", "") == compact:
                match_key = existing_key
                break
        image = image_of(product)
        desc = clip_desc(strip_html(product.get("body_html")))
        existing = models.get(match_key)
        if existing is None:
            models[match_key] = {
                "name": name,
                "image_url": image,
                "description": desc,
                "_score": 1,
            }
        else:
            existing["_score"] += 1
            if not existing.get("image_url") and image:
                existing["image_url"] = image
            if not existing.get("description") and desc:
                existing["description"] = desc
            if len(name) < len(existing["name"]) and not re.search(r"\d+['′]", name):
                existing["name"] = name
    ranked = sorted(models.values(), key=lambda m: (-m["_score"], m["name"].casefold()))
    out = []
    for item in ranked[:limit]:
        if not item.get("image_url") or not item.get("description"):
            continue
        out.append(
            {
                "name": item["name"],
                "image_url": item["image_url"],
                "description": item["description"],
            }
        )
    return out


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
        r'(?:src|content|href)="([^"]*(?:logo|Logo|LOGO)[^"]+\.(?:png|jpg|jpeg|svg|webp)[^"]*)"',
        r'//[^"\']+/cdn/shop/files/(?:PIPEDREAM|pd3|logo)[^"\']+\.(?:png|jpg|jpeg|webp)',
        r'property="og:image"\s+content="([^"]+)"',
        r'rel="apple-touch-icon"[^>]+href="([^"]+)"',
    ]
    for pat in patterns:
        for raw in re.findall(pat, html, flags=re.I):
            url = normalize_asset_url(raw if isinstance(raw, str) else raw[0], base)
            if url:
                return url
    # Shopify header wordmark / icon files
    for raw in re.findall(r'(//[^"\']+/cdn/shop/files/[^"\']+\.(?:png|jpg|jpeg|webp))', html, re.I):
        low = raw.casefold()
        if any(token in low for token in ("logo", "pipedream", "pd3", "wordmark", "header")):
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


def first_http_image(candidates: list[str], *, prefer: list[str] | None = None) -> str | None:
    cleaned: list[str] = []
    for raw in candidates:
        for part in re.split(r"\s+", raw):
            part = part.strip().rstrip(",")
            if part.startswith("//"):
                part = "https:" + part
            if part.startswith("http") and re.search(r"\.(jpg|jpeg|png|webp)(?:$|\?)", part, re.I):
                cleaned.append(part.split("?")[0])
    if not cleaned:
        return None
    if prefer:
        for token in prefer:
            for url in cleaned:
                if token in url.casefold() and "stock-dims" not in url.casefold() and "logo" not in url.casefold():
                    return url
    for url in cleaned:
        low = url.casefold()
        if any(skip in low for skip in ("logo", "stock-dims", "1-6.jpg", "icon", "favicon")):
            continue
        return url
    return cleaned[0]


# ---------------------------------------------------------------------------
# HTML scrapers
# ---------------------------------------------------------------------------

THREAD_MODEL_PATHS = [
    "/surfboards/grovelers/astro",
    "/surfboards/grovelers/boom-box-2",
    "/surfboards/grovelers/boom-box-2-pro",
    "/surfboards/grovelers/keg",
    "/surfboards/grovelers/the-egg",
    "/surfboards/grovelers/g6",
    "/pillow/",
    "/surfboards/grovelers/twin-fin",
    "/surfboards/alternative/the-blowfish",
    "/surfboards/alternative/butterblock",
    "/surfboards/alternative/winged-syngl",
    "/surfboards/alternative/syngl-fin",
    "/surfboards/alternative/the-pescado",
    "/surfboards/performance/cafe-latte",
    "/surfboards/performance/colt-45",
    "/surfboards/performance/hybrid",
    "/surfboards/performance/koozie",
    "/surfboards/performance/koozie-rt",
    "/surfboards/performance/pink-sabbath",
    "/surfboards/performance/pirate-hooker",
    "/surfboards/performance/record-setter",
    "/surfboards/big-wave/koozie-step-up",
    "/surfboards/big-wave/record-setter-step-up",
    "/surfboards/big-wave/the-gun",
    "/surfboards/big-wave/tube-hound",
]


def scrape_thread() -> tuple[list[dict], str | None]:
    models: list[dict] = []
    logo = None
    for path in THREAD_MODEL_PATHS:
        url = urljoin("https://threadsurfboards.com", path)
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  thread skip {path}: {exc}")
            continue
        time.sleep(0.15)
        title_m = re.search(r"<title>([^<]+)", html, re.I)
        name = html_lib.unescape(title_m.group(1) if title_m else "")
        name = re.sub(r"\s*[–—-]\s*Thread Surfboards.*$", "", name, flags=re.I).strip()
        if not name:
            slug = path.rstrip("/").rsplit("/", 1)[-1]
            name = slug.replace("-", " ").title()
        if HARD_EXCLUDE.search(name):
            continue
        desc = None
        dm = re.search(
            r"(?:Description:|</h[1-3]>\s*)(.{80,1200}?)(?:Designed For:|Stock Dims:|$)",
            strip_html(html) or "",
            re.I,
        )
        if dm:
            desc = clip_desc(dm.group(1))
        if not desc:
            text = strip_html(html) or ""
            # Pull the first substantial paragraph after the model name
            idx = text.casefold().find(name.casefold())
            chunk = text[idx + len(name) :] if idx >= 0 else text
            chunk = re.sub(r"^(Pay Deposit|My Account|Checkout|Cart|Surfboards).{0,200}", "", chunk)
            desc = clip_desc(chunk)
        imgs = re.findall(r'(?:src|srcset|data-src)="([^"]+)"', html, re.I)
        image = first_http_image(imgs, prefer=["-front", "front", name.split()[0].lower()])
        if not image or not desc:
            print(f"  thread incomplete {name}: img={bool(image)} desc={bool(desc)}")
            continue
        models.append({"name": name, "image_url": image, "description": desc})
    # Soft-top foamies from WooCommerce (surfboards, not accessories)
    try:
        wc = fetch_json("https://threadsurfboards.com/wp-json/wc/store/products?per_page=100")
        for product in wc:
            cats = " ".join(
                str(c.get("name") or c.get("slug") or "") for c in (product.get("categories") or [])
            )
            if "soft" not in cats.casefold():
                continue
            name = html_lib.unescape(product.get("name") or "").strip()
            if not name or HARD_EXCLUDE.search(name):
                continue
            imgs = product.get("images") or []
            image = imgs[0].get("src") if imgs else None
            desc = clip_desc(strip_html(product.get("description") or product.get("short_description")))
            if image and desc:
                models.append({"name": name, "image_url": image.split("?")[0], "description": desc})
    except Exception as exc:
        print(f"  thread wc: {exc}")
    try:
        home = fetch_text("https://threadsurfboards.com/surfboards/grovelers/astro/")
        logo = extract_logo_from_html(home, "https://threadsurfboards.com/")
        if logo and "nitrocdn.com" in logo:
            logo = "https://threadsurfboards.com/wp-content/uploads/2020/12/Thread-B.png"
        if not logo:
            logo = "https://threadsurfboards.com/wp-content/uploads/2020/12/Thread-B.png"
    except Exception:
        logo = "https://threadsurfboards.com/wp-content/uploads/2020/12/Thread-B.png"
    return dedupe_models(models), logo


def scrape_dylan() -> tuple[list[dict], str | None]:
    listing = fetch_text("https://dylansurfboards.com/boards/")
    paths = sorted(set(re.findall(r'href="(https://dylansurfboards.com/surfboard/[^"#]+)"', listing)))
    models: list[dict] = []
    for url in paths:
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  dylan skip {url}: {exc}")
            continue
        time.sleep(0.12)
        title_m = re.search(r"<title>([^<]+)", html, re.I)
        name = html_lib.unescape(title_m.group(1) if title_m else "")
        name = re.sub(r"\s*[–—-]\s*Dylan Surfboards.*$", "", name, flags=re.I).strip()
        if not name:
            name = url.rstrip("/").rsplit("/", 1)[-1].replace("-", " ").title()
        if HARD_EXCLUDE.search(name) or name.casefold() in {"boards", "home"}:
            continue
        text = strip_html(html) or ""
        # Drop nav chrome
        text = re.sub(r"^.*?CONTACT US\s+", "", text, count=1)
        desc = clip_desc(text)
        imgs = re.findall(r'(?:src|srcset|data-src)="([^"]+)"', html, re.I)
        image = first_http_image(imgs, prefer=["1600x1600", "surfboard", name.split()[0].lower()])
        if not image or not desc:
            print(f"  dylan incomplete {name}: img={bool(image)} desc={bool(desc)}")
            continue
        models.append({"name": name, "image_url": image, "description": desc})
    logo = extract_logo_from_html(listing, "https://dylansurfboards.com/")
    return dedupe_models(models), logo


BATES_PAGES = [
    ("Wing", "/wing-1"),
    ("Egg", "/egg-2/"),
    ("Bonzer", "/bonzer-2/"),
    ("Classic Single Fin", "/single-fin-1/"),
    ("Modern Single Fin", "/modern-single-fin-2/"),
    ("Evolver", "/evolver-2/"),
    ("Sunset Semigun", "/sunset-semigun-1/"),
    ("Classic Fish", "/classic-fish-2/"),
    ("Advanced Fish", "/advanced-fish-2/"),
    ("Modern Keel Fish", "/modern-keel-fish-1/"),
    ("Twinzer", "/twinzer-3/"),
    ("Continental", "/continental-2/"),
    ("Lady Log", "/lady-log-2/"),
    ("Noserider", "/noserider-2/"),
    ("Traditional", "/traditional-2/"),
    ("Glider", "/glider-2/"),
    ("Tupira Special", "/tupira-special-2/"),
    ("Thruster", "/thruster-2/"),
    ("5'5 Drifter", "/55-drifter"),
    ("6'4 Drifter", "/64-drifter-2"),
    ("7'2 Drifter", "/72-drifter-2"),
]


def scrape_bryan_bates() -> tuple[list[dict], str | None]:
    models: list[dict] = []
    logo = None
    for name, path in BATES_PAGES:
        url = urljoin("https://www.bryanbates.com.au", path)
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  bates skip {path}: {exc}")
            continue
        time.sleep(0.12)
        text = strip_html(html) or ""
        desc = clip_desc(text)
        imgs = re.findall(r'(?:src|srcset|data-src|content)="([^"]+)"', html, re.I)
        image = first_http_image(
            imgs,
            prefer=["squarespace-cdn.com/content", "static1.squarespace"],
        )
        if image and ("logo" in image.casefold() or "icon" in image.casefold()):
            image = None
            for raw in imgs:
                cand = first_http_image([raw])
                if cand and "logo" not in cand.casefold() and "icon" not in cand.casefold():
                    image = cand
                    break
        if not image or not desc or len(desc) < 60:
            print(f"  bates incomplete {name}: img={bool(image)} desc={bool(desc)}")
            continue
        models.append({"name": name, "image_url": image, "description": desc})
    try:
        home = fetch_text("https://www.bryanbates.com.au/")
        logo = extract_logo_from_html(home, "https://www.bryanbates.com.au/")
    except Exception:
        logo = None
    return dedupe_models(models), logo


def scrape_leatherman() -> tuple[list[dict], str | None]:
    try:
        html = fetch_text("https://www.leathermansurfboards.com/")
    except Exception as exc:
        print(f"  leatherman home: {exc}")
        return [], None
    logo = extract_logo_from_html(html, "https://www.leathermansurfboards.com/")
    links = sorted(set(re.findall(r'href="([^"]+)"', html)))
    model_urls = []
    for href in links:
        full = urljoin("https://www.leathermansurfboards.com/", href)
        if "leathermansurfboards.com" not in full:
            continue
        if any(skip in full for skip in ("#", "cart", "account", "policy", "blog", "contact")):
            continue
        if re.search(r"/(boards?|models?|surfboard|longboard|mid|fish|short)", full, re.I):
            model_urls.append(full)
    print(f"  leatherman candidate urls={len(model_urls)}")
    models: list[dict] = []
    for url in model_urls[:30]:
        try:
            page = fetch_text(url)
        except Exception:
            continue
        title_m = re.search(r"<title>([^<]+)", page, re.I)
        name = html_lib.unescape(title_m.group(1) if title_m else "").strip()
        name = re.sub(r"\s*[-|]\s*Leatherman.*$", "", name, flags=re.I).strip()
        name = re.sub(r"\s+[–—]\s+Leatherman.*$", "", name, flags=re.I).strip()
        if len(name) < 3 or HARD_EXCLUDE.search(name):
            continue
        if name.casefold() in {"home", "longboards", "mid-length", "fish", "guns", "alternative", "surfboards"}:
            continue
        desc = clip_desc(strip_html(page))
        image = first_http_image(re.findall(r'(?:src|srcset)="([^"]+)"', page, re.I))
        if image and desc and len(desc) > 80:
            models.append({"name": name, "image_url": image, "description": desc})
    return dedupe_models(models), logo


def scrape_neto() -> tuple[list[dict], str | None]:
    try:
        html = fetch_text("https://netoshapes.com/")
    except Exception as exc:
        print(f"  neto home: {exc}")
        return [], None
    logo = extract_logo_from_html(html, "https://netoshapes.com/")
    links = sorted(set(re.findall(r'href="([^"]+)"', html)))
    model_urls = []
    for href in links:
        full = urljoin("https://netoshapes.com/", href)
        if "netoshapes.com" not in full:
            continue
        if re.search(r"/(surfboard|boards?|models?|custom)", full, re.I):
            model_urls.append(full)
    print(f"  neto candidate urls={len(model_urls)}")
    models: list[dict] = []
    for url in model_urls[:25]:
        try:
            page = fetch_text(url)
        except Exception:
            continue
        title_m = re.search(r"<title>([^<]+)", page, re.I)
        name = html_lib.unescape(title_m.group(1) if title_m else "").strip()
        name = re.sub(r"\s*[-|]\s*Neto.*$", "", name, flags=re.I).strip()
        name = re.sub(r"\s+[–—]\s+Neto.*$", "", name, flags=re.I).strip()
        if len(name) < 3 or HARD_EXCLUDE.search(name):
            continue
        desc = clip_desc(strip_html(page))
        image = first_http_image(re.findall(r'(?:src|srcset)="([^"]+)"', page, re.I))
        if image and desc and len(desc) > 80 and "custom" not in name.casefold():
            models.append({"name": name, "image_url": image, "description": desc})
    return dedupe_models(models), logo


def scrape_mc_surf() -> tuple[list[dict], str | None]:
    for base in ("https://www.mcsurfdesigns.com/", "https://www.mcsurf.com.au/"):
        try:
            html = fetch_text(base)
        except Exception as exc:
            print(f"  mc surf {base}: {exc}")
            continue
        logo = extract_logo_from_html(html, base)
        # Named models listed on the homepage copy
        names = [
            "Ripper 1",
            "Ripper 2",
            "MC Hot Rod",
            "MC Fish",
            "Lip Hit",
            "Islander",
            "Stubbie",
            "Speed Fish",
            "Dart Fish",
            "Whale Fish",
            "Twin Fin",
            "7T",
            "Malibu Gun",
            "Hawaiian Gun",
            "High Performance Longboard",
            "Modern Classic Longboard",
            "Mini Malibu",
        ]
        text = strip_html(html) or ""
        imgs = re.findall(r'(?:src|srcset)="([^"]+)"', html, re.I)
        image = first_http_image(imgs)
        models = []
        if image and len(text) > 200:
            # Only keep names that actually appear on the page
            for name in names:
                if name.casefold() in text.casefold():
                    # Shared homepage photo is not a per-model image — skip.
                    # Require a dedicated model page later.
                    pass
        print(f"  mc surf {base} logo={bool(logo)} dedicated_models=0 (homepage list only)")
        return [], logo
    return [], None


def dedupe_models(models: list[dict]) -> list[dict]:
    out: dict[str, dict] = {}
    for model in models:
        key = model_key(model["name"])
        if key in out:
            if not out[key].get("description") and model.get("description"):
                out[key]["description"] = model["description"]
            if not out[key].get("image_url") and model.get("image_url"):
                out[key]["image_url"] = model["image_url"]
            continue
        out[key] = model
    return sorted(out.values(), key=lambda m: m["name"].casefold())


SHOPIFY_BRANDS = [
    {
        "slug": "m10-surfboards",
        "name": "M10 Surfboards",
        "website_url": "https://m10surfboards.com",
        "shopify_base": "https://m10surfboards.com",
        "location_label": "Santa Cruz, California",
        "founder_name": "Geoff Rashe",
        "lead_shaper_name": "Geoff Rashe",
        "short_description": "Santa Cruz custom shortboards and alternative shapes from Geoff Rashe / M10.",
        "allowed_types": None,
        "pages": 3,
    },
    {
        "slug": "gen4-surfboards",
        "name": "Gen4 Surfboards",
        "website_url": "https://gen4surf.com",
        "shopify_base": "https://gen4surf.com",
        "location_label": "Tweed Heads, New South Wales, Australia",
        "founder_name": "Jye Gudenswager",
        "lead_shaper_name": "Jye Gudenswager",
        "short_description": "Fourth-generation Australian custom boards from Jye Gudenswager in Tweed Heads.",
        "allowed_types": {"surfboard"},
        "pages": 3,
    },
    {
        "slug": "pipedream-surfboards",
        "name": "Pipedream Surfboards",
        "website_url": "https://pipedreamsurfboards.com",
        "shopify_base": "https://pipedreamsurfboards.com",
        "location_label": "Currumbin Waters, Queensland, Australia",
        "founder_name": "Murray Bourton",
        "lead_shaper_name": "Murray Bourton",
        "short_description": "Gold Coast custom shapes since 1975, skewed toward fun and exploratory surfing.",
        "allowed_types": {"Surfboard"},
        "pages": 4,
    },
]


def main() -> None:
    brands_out: list[dict] = []
    rejected: list[str] = []

    print("Shopify catalogs...")
    for brand in SHOPIFY_BRANDS:
        products = shopify_all(brand["shopify_base"], pages=int(brand["pages"]))
        models = products_to_models(
            products,
            brand["name"],
            allowed_types=brand.get("allowed_types"),
        )
        logo = shopify_logo(brand["website_url"])
        if brand["slug"] == "pipedream-surfboards" and not logo:
            logo = "https://pipedreamsurfboards.com/cdn/shop/files/PIPEDREAM_320x.jpg"
        print(
            f"  {brand['slug']}: products={len(products)} models={len(models)} "
            f"logo={bool(logo)}"
        )
        if len(models) < 3 or not logo:
            rejected.append(f"{brand['slug']}: models={len(models)} logo={bool(logo)}")
            continue
        brands_out.append(
            {
                "slug": brand["slug"],
                "name": brand["name"],
                "website_url": brand["website_url"],
                "location_label": brand.get("location_label"),
                "founder_name": brand.get("founder_name"),
                "lead_shaper_name": brand.get("lead_shaper_name"),
                "short_description": brand.get("short_description"),
                "logo_url": logo,
                "models": models,
            }
        )

    print("Thread Surfboards (Costa Mesa)...")
    models, logo = scrape_thread()
    print(f"  thread models={len(models)} logo={bool(logo)}")
    if len(models) >= 3 and logo:
        brands_out.append(
            {
                "slug": "thread-surfboards",
                "name": "Thread Surfboards",
                "website_url": "https://threadsurfboards.com",
                "location_label": "Costa Mesa, California",
                "short_description": "Costa Mesa custom grovelers, performance shortboards, and USA-made soft-tops.",
                "logo_url": logo,
                "models": models,
            }
        )
    else:
        rejected.append(f"thread-surfboards: models={len(models)} logo={bool(logo)}")

    print("Dylan Surfboards (Port Kembla)...")
    models, logo = scrape_dylan()
    print(f"  dylan models={len(models)} logo={bool(logo)}")
    if len(models) >= 3 and logo:
        brands_out.append(
            {
                "slug": "dylan-surfboards",
                "name": "Dylan Surfboards",
                "website_url": "https://dylansurfboards.com",
                "location_label": "Port Kembla, New South Wales, Australia",
                "founder_name": "Dylan Longbottom",
                "lead_shaper_name": "Dylan Longbottom",
                "short_description": "Port Kembla performance and alternative shapes from surfer-shaper Dylan Longbottom.",
                "logo_url": logo,
                "models": models,
            }
        )
    else:
        rejected.append(f"dylan-surfboards: models={len(models)} logo={bool(logo)}")

    print("Bryan Bates (Sawtell / Arrawarra)...")
    models, logo = scrape_bryan_bates()
    print(f"  bates models={len(models)} logo={bool(logo)}")
    if len(models) >= 3 and logo:
        brands_out.append(
            {
                "slug": "bryan-bates-surfboards",
                "name": "Bryan Bates Surfboards",
                "website_url": "https://www.bryanbates.com.au",
                "location_label": "Sawtell / Arrawarra, New South Wales, Australia",
                "founder_name": "Bryan Bates",
                "lead_shaper_name": "Bryan Bates",
                "short_description": "Hand-shaped, glassed, and finished one-off boards from Bryan Bates on the NSW mid-north coast.",
                "logo_url": logo,
                "models": models,
            }
        )
    else:
        rejected.append(f"bryan-bates-surfboards: models={len(models)} logo={bool(logo)}")

    print("Leatherman (Oregon)...")
    models, logo = scrape_leatherman()
    print(f"  leatherman models={len(models)} logo={bool(logo)}")
    if len(models) >= 3 and logo:
        brands_out.append(
            {
                "slug": "leatherman-surfboards",
                "name": "Leatherman Surfboards",
                "website_url": "https://www.leathermansurfboards.com",
                "location_label": "Neskowin, Oregon",
                "short_description": "Handcrafted Pacific Northwest surfboards from Neskowin, Oregon.",
                "logo_url": logo,
                "models": models,
            }
        )
    else:
        rejected.append(f"leatherman-surfboards: models={len(models)} logo={bool(logo)}")

    print("Neto Shapes (Maine)...")
    models, logo = scrape_neto()
    print(f"  neto models={len(models)} logo={bool(logo)}")
    if len(models) >= 3 and logo:
        brands_out.append(
            {
                "slug": "neto-shapes",
                "name": "Neto Shapes",
                "website_url": "https://netoshapes.com",
                "location_label": "Maine",
                "short_description": "Maine custom surfboards shaped since 2005.",
                "logo_url": logo,
                "models": models,
            }
        )
    else:
        rejected.append(f"neto-shapes: models={len(models)} logo={bool(logo)}")

    print("MC Surf Designs (Byron)...")
    models, logo = scrape_mc_surf()
    rejected.append(f"mc-surf-designs: homepage model list only, no per-model images ({logo=})")

    # Final integrity pass
    usable = []
    for brand in brands_out:
        kept = [
            m
            for m in brand["models"]
            if m.get("name")
            and m.get("image_url")
            and m.get("description")
            and not HARD_EXCLUDE.search(m["name"])
            and not SERVICE.search(m["name"])
        ]
        brand["models"] = kept
        if len(kept) >= 3 and brand.get("logo_url"):
            usable.append(brand)
        else:
            rejected.append(f"{brand['slug']}: after filter models={len(kept)} logo={bool(brand.get('logo_url'))}")

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth of small USA and Australia surfboard-maker brands",
        "generated_on": "2026-08-22",
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


if __name__ == "__main__":
    main()
