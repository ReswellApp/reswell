#!/usr/bin/env python3
"""
Fill major-brand catalog gaps: missing models + missing product images.

Scrapes brand Shopify feeds (and targeted retailer vendor matches for Lost),
writes a seed compatible with `scripts/import-core-shapers-catalog.ts`.

Usage:
  python3 scripts/scrape-major-brand-catalog-gaps.py
  npx tsx scripts/import-core-shapers-catalog.ts \\
    --seed scripts/data/surfboard-catalog-seed/major-brands-gap-fill.json \\
    --backfill /dev/null
"""
from __future__ import annotations

import json
import re
import socket
import ssl
import urllib.request
from pathlib import Path

socket.setdefaulttimeout(20)
UA = "Mozilla/5.0 (compatible; ReswellCatalogBot/1.0)"
CTX = ssl.create_default_context()
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/major-brands-gap-fill.json")

# Brands with first-party Shopify catalogs to fully refresh.
DIRECT: list[dict] = [
    {
        "slug": "pyzel-surfboards",
        "name": "Pyzel Surfboards",
        "website_url": "https://www.pyzelsurfboards.com",
        "shopify_base": "https://www.pyzelsurfboards.com",
        "short_description": "Hawaii-based performance shortboards shaped by Jon Pyzel.",
        "location_label": "Hawaii",
        "founder_name": "Jon Pyzel",
        "lead_shaper_name": "Jon Pyzel",
        "exact_vendors": ["Pyzel", "Pyzel Surfboards", "PYZEL SURFBOARDS"],
        "pages": 8,
    },
    {
        "slug": "channel-islands-surfboards",
        "name": "Channel Islands Surfboards",
        "website_url": "https://www.cisurfboards.com",
        "shopify_base": "https://www.cisurfboards.com",
        "short_description": "Al Merrick performance shortboards and everyday drivers.",
        "location_label": "Santa Barbara, California",
        "exact_vendors": [
            "Channel Islands",
            "Channel Islands Surfboards",
            "CHANNEL ISLANDS SURFBOARDS",
            "CI Surfboards",
        ],
        "pages": 10,
    },
    {
        "slug": "dhd-surfboards",
        "name": "DHD Surfboards",
        "website_url": "https://www.dhdsurf.com",
        "shopify_base": "https://www.dhdsurf.com",
        "short_description": "Australian performance shortboards from Darren Handley.",
        "location_label": "Australia",
        "exact_vendors": ["DHD", "DHD Surfboards", "Darren Handley Designs"],
        "pages": 8,
    },
    {
        "slug": "js-surfboards",
        "name": "JS Surfboards",
        "website_url": "https://www.jsindustries.com",
        "shopify_base": "https://www.jsindustries.com",
        "short_description": "Australian performance shortboards from Jason Stevenson.",
        "location_label": "Australia",
        "exact_vendors": ["JS", "JS Industries", "JS Surfboards", "JS Industries Surfboards"],
        "pages": 8,
    },
    {
        "slug": "rusty-surfboards",
        "name": "Rusty Surfboards",
        "website_url": "https://www.rustysurfboards.com",
        "shopify_base": "https://www.rustysurfboards.com",
        "short_description": "California performance and everyday boards from Rusty Preisendorfer.",
        "location_label": "California",
        "founder_name": "Rusty Preisendorfer",
        "lead_shaper_name": "Rusty Preisendorfer",
        "exact_vendors": ["Rusty", "Rusty Surfboards", "DIY Custom", "Surfboard"],
        "pages": 8,
    },
    {
        "slug": "bing-surfboards",
        "name": "Bing Surfboards",
        "website_url": "https://www.bingsurf.com",
        "shopify_base": "https://www.bingsurf.com",
        "short_description": "Heritage California longboards and classic templates.",
        "location_label": "California",
        "exact_vendors": ["Bing", "Bing Surfboards"],
        "pages": 8,
    },
    {
        "slug": "ben-aipa",
        "name": "Ben Aipa",
        "website_url": "https://www.aipasurf.com",
        "shopify_base": "https://www.aipasurf.com",
        "short_description": "Hawaiian performance designs from the Aipa shaping lineage.",
        "location_label": "Hawaii",
        "exact_vendors": ["Aipa", "Ben Aipa", "Aipa Surfboards", "AIPA", "Aipa Surf Company"],
        "pages": 6,
    },
    {
        "slug": "album-surf-1",
        "name": "Album Surf",
        "website_url": "https://albumsurf.com",
        "shopify_base": "https://albumsurf.com",
        "short_description": "San Clemente progressive shortboards and alternative shapes.",
        "location_label": "San Clemente, California",
        "exact_vendors": ["Album", "Album Surf", "Album Surfboards"],
        "pages": 6,
    },
    {
        "slug": "arakawa-surfboards",
        "name": "Arakawa Surfboards",
        "website_url": "https://arakawasurfboards.com",
        "shopify_base": "https://arakawasurfboards.com",
        "short_description": "Hawaiian progressive shortboards from Eric Arakawa.",
        "location_label": "Hawaii",
        "founder_name": "Eric Arakawa",
        "lead_shaper_name": "Eric Arakawa",
        "exact_vendors": ["Arakawa", "Arakawa Surfboards"],
        "pages": 6,
    },
    {
        "slug": "lovemachine-surfboards",
        "name": "Lovemachine Surfboards",
        "website_url": "https://lovemachinesurfboards.com",
        "shopify_base": "https://lovemachinesurfboards.com",
        "short_description": "Alternative mid-lengths and fishes with a strong indie following.",
        "exact_vendors": ["Lovemachine", "Lovemachine Surfboards", "Love Machine"],
        "pages": 6,
    },
    {
        "slug": "thomas-surfboards",
        "name": "Thomas Surfboards",
        "website_url": "https://thomassurfboards.com",
        "shopify_base": "https://thomassurfboards.com",
        "short_description": "California performance and alternative shapes from Thomas Surfboards.",
        "location_label": "California",
        "exact_vendors": ["Thomas", "Thomas Surfboards"],
        "pages": 6,
    },
    {
        "slug": "bob-mctavish",
        "name": "Bob McTavish",
        "website_url": "https://mctavish.com.au",
        "shopify_base": "https://mctavish.com.au",
        "short_description": "Australian shaping legend Bob McTavish — classic and progressive templates.",
        "location_label": "Australia",
        "founder_name": "Bob McTavish",
        "lead_shaper_name": "Bob McTavish",
        "exact_vendors": ["McTavish", "Bob McTavish", "Mctavish"],
        "pages": 6,
    },
    {
        "slug": "hobie-surfboards",
        "name": "Hobie Surfboards",
        "website_url": "https://www.hobiesurfshop.com",
        "shopify_base": "https://www.hobiesurfshop.com",
        "short_description": "Iconic California longboards and classic Hobie templates.",
        "location_label": "California",
        "exact_vendors": ["Hobie", "Hobie Surfboards"],
        "pages": 8,
    },
    {
        "slug": "xo-coco-surfboards",
        "name": "XO Coco Surfboards",
        "website_url": "https://xococosurf.com",
        "shopify_base": "https://xococosurf.com",
        "short_description": "Alternative California shapes with a playful progressive feel.",
        "exact_vendors": ["XO Coco", "XO Coco Surfboards", "Xococo"],
        "pages": 4,
    },
    {
        "slug": "firewire-surfboards",
        "name": "Firewire",
        "website_url": "https://www.firewiresurfboards.com",
        "shopify_base": "https://www.firewiresurfboards.com",
        "short_description": "Performance shortboards and alternative shapes in advanced constructions.",
        "exact_vendors": ["Firewire", "Firewire Surfboards"],
        "pages": 6,
    },
    {
        "slug": "sharpeye-surfboards",
        "name": "Sharp Eye Surfboards",
        "website_url": "https://sharpeyesurfboards.com",
        "shopify_base": "https://sharpeyesurfboards.com",
        "short_description": "High-performance shortboards from Sharp Eye.",
        "exact_vendors": ["Sharp Eye", "Sharpeye", "Sharp Eye Surfboards"],
        "pages": 6,
    },
    {
        "slug": "hayden-shapes",
        "name": "Hayden Shapes",
        "website_url": "https://haydenshapes.com",
        "shopify_base": "https://haydenshapes.com",
        "short_description": "FutureFlex performance and alternative shapes from Hayden Cox.",
        "exact_vendors": ["Hayden Shapes", "Haydenshapes", "HS"],
        "pages": 8,
    },
    {
        "slug": "christenson-surfboards",
        "name": "Chris Christenson",
        "website_url": "https://christensonsurfboards.com",
        "shopify_base": "https://christensonsurfboards.com",
        "short_description": "Classic and progressive mid-lengths from Chris Christenson.",
        "exact_vendors": ["Christenson", "Chris Christenson", "Christenson Surfboards"],
        "pages": 6,
    },
    {
        "slug": "slater-designs-surfboards",
        "name": "Slater Designs",
        "website_url": "https://www.firewiresurfboards.com",
        "shopify_base": "https://www.firewiresurfboards.com",
        "short_description": "Kelly Slater signature shapes built with Firewire.",
        "exact_vendors": ["Slater Designs", "Slater Design"],
        "pages": 6,
    },
]

# Lost / Mayhem — no reliable first-party products.json; use retailers + Lib Tech collabs.
LOST_RETAILERS = [
    "https://boardworld.com.au",
    "https://www.surfstationstore.com",
    "https://www.surfboardsdirect.com.au",
    "https://www.thesurfboardwarehouse.com.au",
    "https://www.cleanlinesurf.com",
    "https://www.jackssurfboards.com",
    "https://www.swell.com",
    "https://www.surfshop.com",
    "https://www.wetsuitwearhouse.com",
    "https://www.catchsurf.com",
    "https://firewiresurfboards.com",
    "https://www.tcsurf.com",
]

BOARD = re.compile(
    r"\b(surfboards?|softboards?|soft[\s-]?tops?|longboards?|shortboards?|funboards?|"
    r"mid[\s-]?lengths?|eggs?|fishes?|twin|thruster|step[\s-]?up|gun)\b",
    re.I,
)
HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin set|\bfins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|boardshort|gift ?card|candle|yoga|handplane|"
    r"bodyboard|skimboard|wall rack|rack|mount|poncho|sticker|hat|beanie|"
    r"jacket|shorts?|socks?|towel|cover|rash|wetsuit|apparel|tank|tee)\b",
    re.I,
)


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20, context=CTX) as resp:
        return json.loads(resp.read().decode())


def shopify_all(base: str, pages: int = 8) -> list[dict]:
    out: list[dict] = []
    seen: set[int] = set()
    for page in range(1, pages + 1):
        try:
            data = fetch_json(f"{base.rstrip('/')}/products.json?limit=250&page={page}")
        except Exception as exc:
            print(f"  skip {base} page {page}: {type(exc).__name__}: {exc}")
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
    return out


def image_of(product: dict) -> str | None:
    images = product.get("images") or []
    if images and images[0].get("src"):
        return images[0]["src"].split("?")[0]
    return None


def body_text(product: dict) -> str | None:
    html = product.get("body_html") or ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:500] if text else None


def is_surfboard(product: dict) -> bool:
    title = product.get("title") or ""
    product_type = product.get("product_type") or ""
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    if HARD_EXCLUDE.search(title) or HARD_EXCLUDE.search(product_type):
        return False
    blob = f"{title} {product_type} {tags}"
    if re.search(
        r"soft\s*-?\s*(board|top)|surfboard|longboard|shortboard|funboard|step\s*up|"
        r"high performance|daily drivers?|guns?|funformance|velocity|shape3d|in stock|"
        r"rusty custom|fusion|tuflite|carbon|dual-?core",
        product_type,
        re.I,
    ):
        # Shape3d / custom configurators without a real model name are still boards
        if product_type.casefold() in {"upgrade", "accessory", "gift card", "rush", "wake"}:
            return False
        return True
    return bool(BOARD.search(blob))


def clean_model_name(title: str, brand_name: str) -> str:
    name = title.strip()
    # Pyzel / stock titles often use "Model | dims | fins | construction"
    if "|" in name:
        name = name.split("|", 1)[0].strip()
    for prefix in [
        brand_name,
        brand_name.replace("&", "and"),
        "Lib Tech Lost",
        "Lib Tech",
        "Lost®",
        "Lost",
        "...Lost®",
        "CI",
        "Channel Islands",
        "JS Industries",
        "JS",
        "DHD",
        "Pyzel",
        "Rusty",
        "Bing",
        "Aipa",
        "Album",
        "Arakawa",
        "Lovemachine",
        "Love Machine",
        "Thomas",
        "McTavish",
        "Bob McTavish",
        "Hobie",
        "Firewire",
        "Sharp Eye",
        "Sharpeye",
        "Hayden Shapes",
        "Haydenshapes",
        "Christenson",
        "Chris Christenson",
        "Slater Designs",
        "XO Coco",
        "100$ Off!",
        "$100 Off!",
    ]:
        if name.casefold().startswith(prefix.casefold()):
            name = name[len(prefix) :].lstrip(" -|:/®")
    # Strip construction / dim tails commonly appended in retail titles
    name = re.sub(
        r"\s*[•·]\s*(USED|NEW|Consignment).*$",
        "",
        name,
        flags=re.I,
    )
    name = re.sub(
        r"\s*[-–—]\s*(FCS\s*II|Futures|Future|PU/?Poly|EPS|Helium|LFT|Turbo|Blacksheep|ecoIMPACTO.*)$",
        "",
        name,
        flags=re.I,
    )
    # Strip trailing size blocks like 6'1" x 19.87 x 2.26 - 32.7L Squash
    name = re.sub(
        r"\s+\d+['′]\d*.*$",
        "",
        name,
    )
    m = re.match(
        r"(.+?)(?:\s+)(\d+['′]\d*(?:[\"″]\d*)?(?:\s*[x×].*)?)$",
        name,
    )
    if m and len(m.group(1).strip()) >= 2:
        candidate = m.group(1).strip(" -|:/")
        if not re.match(r"^\d+['′]", candidate):
            name = candidate
    name = re.sub(r"\s+", " ", name).strip(" -|:/")
    # Drop pure configurator / deposit junk
    if re.search(r"^(custom order|shape3d|tech upgrade|rush)\b", name, re.I):
        return ""
    return name[:120] if name else ""


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def vendor_allowed(product: dict, exact_vendors: list[str] | None) -> bool:
    if not exact_vendors:
        return True
    vendor = (product.get("vendor") or "").strip()
    vendor_n = re.sub(r"[^a-z0-9]+", "", vendor.casefold())
    allowed = {re.sub(r"[^a-z0-9]+", "", v.casefold()) for v in exact_vendors}
    if vendor_n in allowed:
        return True
    # Allow empty vendor on brand-owned shops
    if not vendor:
        return True
    # Partial contain for longer names
    for a in allowed:
        if len(a) >= 5 and (a in vendor_n or vendor_n in a):
            return True
    return False


def products_to_models(
    products: list[dict],
    brand_name: str,
    *,
    exact_vendors: list[str] | None = None,
    limit: int = 120,
) -> list[dict]:
    models: dict[str, dict] = {}
    for product in products:
        if not is_surfboard(product):
            continue
        if not vendor_allowed(product, exact_vendors):
            continue
        title = (product.get("title") or "").strip()
        if not title:
            continue
        if re.search(r"\b(gift\s*card|deposit|custom order|voucher|faq)\b", title, re.I):
            continue
        name = clean_model_name(title, brand_name)
        if len(name) < 2:
            continue
        if HARD_EXCLUDE.search(name):
            continue
        key = model_key(name)
        if not key or len(key) < 2:
            continue
        image = image_of(product)
        desc = body_text(product)
        existing = models.get(key)
        if existing is None:
            models[key] = {"name": name, "image_url": image, "description": desc, "_score": 1}
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
        out.append(
            {
                "name": item["name"],
                "image_url": item.get("image_url"),
                "description": item.get("description"),
            }
        )
    return out


def is_lost_board(product: dict) -> bool:
    vendor = (product.get("vendor") or "").casefold()
    title = (product.get("title") or "").casefold()
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    tags_l = tags.casefold()
    if HARD_EXCLUDE.search(title):
        return False
    if not is_surfboard(product):
        return False
    # Lost / Mayhem / Lib Tech Lost / Catch Surf Lost collabs
    if re.search(r"\blost\b|mayhem", vendor) and "apparel" not in vendor:
        return True
    if "lib tech" in vendor or "libtech" in vendor:
        if re.search(
            r"\blost\b|mayhem|rnf|sub[\s-]?driver|crowd killer|pardo|cali bean|"
            r"swordfish|retro ripper|little wing|baby buggy|party platter|pisces|"
            r"round nose fish|quiver killer|driver 2\.0|uber driver",
            title,
        ):
            return True
    if "catch" in vendor and re.search(r"\blost\b|mayhem|rnf|crowd", title):
        return True
    if re.search(r"\blost\b.*\b(surfboard|rnf|subdriver|crowd|mayhem)\b", title):
        return True
    if "...lost" in title or "lost®" in title or "lost mayhem" in title:
        return True
    return False


def score_name_match(model: str, title: str) -> int:
    model_n = model_key(model)
    title_n = model_key(title)
    if not model_n or not title_n:
        return 0
    if model_n == title_n:
        return 100
    if model_n in title_n or title_n in model_n:
        return 90
    model_tokens = set(re.findall(r"[a-z0-9]+", model.casefold())) - {
        "the",
        "surfboard",
        "board",
        "model",
        "pro",
        "xl",
        "grom",
    }
    title_tokens = set(re.findall(r"[a-z0-9]+", title.casefold()))
    if model_tokens and len(model_tokens & title_tokens) / len(model_tokens) >= 0.8:
        return 75
    return 0


def fetch_db_models_missing_images(slugs: list[str]) -> dict[str, list[dict]]:
    import os
    import urllib.request

    url = (
        os.environ.get("Next_Public_Supabase_Url")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    )
    key = (
        os.environ.get("Supabase_Service_Role_Key")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    )
    if not url.startswith("http"):
        url = "https://lqwsewptsirsglasnwmn.supabase.co"
    filt = ",".join(f'"{s}"' for s in slugs)
    req = urllib.request.Request(
        f"{url}/rest/v1/brands?select=id,slug&slug=in.({filt})",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    brands = json.loads(urllib.request.urlopen(req).read())
    out: dict[str, list[dict]] = {}
    for b in brands:
        req = urllib.request.Request(
            f"{url}/rest/v1/brand_models?select=id,name,image_url&brand_id=eq.{b['id']}&limit=2000",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        models = json.loads(urllib.request.urlopen(req).read())
        missing = [{"id": m["id"], "name": m["name"]} for m in models if not m.get("image_url")]
        out[b["slug"]] = missing
    return out


def merge_db_image_matches(
    brand_slug: str,
    brand_name: str,
    scraped_models: list[dict],
    products: list[dict],
    db_missing: list[dict],
) -> list[dict]:
    """Ensure existing DB model names without images get matched product photos."""
    by_key = {model_key(m["name"]): dict(m) for m in scraped_models}
    # Index products for fuzzy match
    board_products = [p for p in products if is_surfboard(p)]
    for missing in db_missing:
        key = model_key(missing["name"])
        if key in by_key and by_key[key].get("image_url"):
            # Prefer exact DB name casing/spelling for upsert match
            by_key[key]["name"] = missing["name"]
            continue
        best = None
        best_score = 0
        for product in board_products:
            title = product.get("title") or ""
            cleaned = clean_model_name(title, brand_name) or title
            score = max(score_name_match(missing["name"], title), score_name_match(missing["name"], cleaned))
            if score > best_score:
                img = image_of(product)
                if img:
                    best_score = score
                    best = {
                        "name": missing["name"],
                        "image_url": img,
                        "description": body_text(product),
                    }
        if best and best_score >= 75:
            by_key[key] = best
        elif key not in by_key:
            # Keep the named model in seed even without image so we don't drop it
            by_key[key] = {"name": missing["name"], "image_url": None, "description": None}
    return sorted(by_key.values(), key=lambda m: m["name"].casefold())


def main() -> None:
    brands_out: list[dict] = []
    product_cache: dict[str, list[dict]] = {}

    print("Scraping direct brand Shopify feeds...")
    for brand in DIRECT:
        base = brand["shopify_base"]
        products = shopify_all(base, pages=int(brand.get("pages") or 8))
        product_cache[brand["slug"]] = products
        models = products_to_models(
            products,
            brand["name"],
            exact_vendors=brand.get("exact_vendors"),
            limit=150,
        )
        imgs = sum(1 for m in models if m.get("image_url"))
        print(f"  {brand['slug']}: products={len(products)} models={len(models)} imgs={imgs}")
        brands_out.append(
            {
                "slug": brand["slug"],
                "name": brand["name"],
                "website_url": brand.get("website_url"),
                "location_label": brand.get("location_label"),
                "founder_name": brand.get("founder_name"),
                "lead_shaper_name": brand.get("lead_shaper_name"),
                "short_description": brand.get("short_description"),
                "models": models,
            }
        )

    print("Scraping Lost / Mayhem from retailers + Lib Tech...")
    lost_pool: list[dict] = []
    for base in LOST_RETAILERS:
        products = shopify_all(base, pages=6)
        matched = [p for p in products if is_lost_board(p)]
        print(f"  {base}: products={len(products)} lost_boards={len(matched)}")
        lost_pool.extend(matched)
    product_cache["lost-surfboards"] = lost_pool
    lost_models = products_to_models(lost_pool, "Lost Surfboards", limit=150)
    print(f"  lost-surfboards: models={len(lost_models)} imgs={sum(1 for m in lost_models if m.get('image_url'))}")
    brands_out.append(
        {
            "slug": "lost-surfboards",
            "name": "Lost Surfboards",
            "website_url": "https://lostsurfboards.com",
            "location_label": "San Clemente, California",
            "founder_name": "Matt Biolos",
            "lead_shaper_name": "Matt Biolos",
            "short_description": "Mayhem / Lost performance shortboards and alternative shapes from Matt Biolos.",
            "models": lost_models,
        }
    )

    print("Matching existing DB models missing images...")
    missing_map = fetch_db_models_missing_images([b["slug"] for b in brands_out])
    for brand in brands_out:
        slug = brand["slug"]
        db_missing = missing_map.get(slug) or []
        if not db_missing:
            continue
        before_imgs = sum(1 for m in brand["models"] if m.get("image_url"))
        brand["models"] = merge_db_image_matches(
            slug,
            brand["name"],
            brand["models"],
            product_cache.get(slug) or [],
            db_missing,
        )
        after_imgs = sum(1 for m in brand["models"] if m.get("image_url"))
        print(
            f"  {slug}: db_missing={len(db_missing)} "
            f"seed_imgs {before_imgs}->{after_imgs} models={len(brand['models'])}"
        )

    # Keep brands that produced useful models
    usable = [b for b in brands_out if len(b["models"]) >= 1]
    usable.sort(
        key=lambda b: (
            -sum(1 for m in b["models"] if m.get("image_url")),
            -len(b["models"]),
            b["slug"],
        )
    )

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Fill major brand model + image gaps (Pyzel, Lost, CI, DHD, JS, Rusty, etc.)",
        "product_category_slug": "surfboards",
        "brands": usable,
        "summary": {
            "brand_count": len(usable),
            "model_count": sum(len(b["models"]) for b in usable),
            "image_count": sum(1 for b in usable for m in b["models"] if m.get("image_url")),
        },
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))
    print(f"wrote {OUT}")
    for b in usable:
        imgs = sum(1 for m in b["models"] if m.get("image_url"))
        print(f"  {b['slug']:35} models={len(b['models']):3} imgs={imgs:3}")


if __name__ == "__main__":
    main()
