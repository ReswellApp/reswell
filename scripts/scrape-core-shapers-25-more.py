#!/usr/bin/env python3
"""
Scrape ~25 additional small/popular surfboard brands into a core-shapers seed file.

Sources:
  - Brand Shopify `products.json` feeds (preferred)
  - Retailer Shopify feeds filtered by vendor (fallback)

Writes:
  scripts/data/surfboard-catalog-seed/core-shapers-25-more.json
"""
from __future__ import annotations

import json
import re
import socket
import ssl
import urllib.request
from collections import defaultdict
from pathlib import Path

socket.setdefaulttimeout(20)
UA = "Mozilla/5.0 (compatible; ReswellCatalogBot/1.0)"
CTX = ssl.create_default_context()

OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/core-shapers-25-more.json")

# Brands with first-party Shopify catalogs.
DIRECT_BRANDS: list[dict] = [
    {
        "slug": "softlite-surfboards",
        "name": "Softlite Surfboards",
        "website_url": "https://www.softlite.com.au",
        "shopify_base": "https://www.softlite.com.au",
        "location_label": "Australia",
        "short_description": "Australian soft-top surfboards built for progression and everyday fun.",
    },
    {
        "slug": "mf-softboards",
        "name": "MF Softboards",
        "website_url": "https://mickfanningsoftboards.com",
        "shopify_base": "https://mickfanningsoftboards.com",
        "location_label": "Australia",
        "founder_name": "Mick Fanning",
        "short_description": "Mick Fanning signature softboards for learners through everyday surfers.",
    },
    {
        "slug": "pukas-surfboards",
        "name": "Pukas Surfboards",
        "website_url": "https://pukassurf.com",
        "shopify_base": "https://shop.pukassurf.com",
        "location_label": "Basque Country, Spain",
        "short_description": "Basque Country performance shortboards with a strong European following.",
    },
    {
        "slug": "funner-surf-craft",
        "name": "FUNNER Surf Craft",
        "website_url": "https://funner.surf",
        "shopify_base": "https://funner.surf",
        "location_label": "California",
        "short_description": "Sustainable surf craft with progressive alternative shapes.",
    },
    {
        "slug": "olero-surfboards",
        "name": "Olero Surfboards",
        "website_url": "https://olerosurfboards.com",
        "shopify_base": "https://olerosurfboards.com",
        "location_label": "Australia",
        "short_description": "Experimental Australian shapes including finless hybrids.",
    },
    {
        "slug": "ventana-surfboards",
        "name": "Ventana Surfboards",
        "website_url": "https://ventanasurfboards.com",
        "shopify_base": "https://ventanasurfboards.com",
        "location_label": "California",
        "short_description": "Sustainable wooden and plant-based performance surfboards.",
    },
    {
        "slug": "ocean-and-earth",
        "name": "Ocean & Earth",
        "website_url": "https://oceanandearth.com.au",
        "shopify_base": "https://oceanandearth.com.au",
        "location_label": "Australia",
        "short_description": "Australian softboards and surf hardware with a long retail footprint.",
    },
]

# Small brands primarily available via retailer catalogs.
RETAILER_BRANDS: list[dict] = [
    {
        "slug": "alton-surfboards",
        "name": "Alton",
        "website_url": None,
        "location_label": None,
        "short_description": "Accessible soft-top and entry-level surfboards popular with progressing surfers.",
        "vendor_aliases": ["alton"],
    },
    {
        "slug": "harley-ingleby-surfboards",
        "name": "Harley Ingleby",
        "website_url": None,
        "location_label": "Australia",
        "founder_name": "Harley Ingleby",
        "lead_shaper_name": "Harley Ingleby",
        "short_description": "Australian competitive longboard designs from Harley Ingleby.",
        "vendor_aliases": ["harley ingleby"],
    },
    {
        "slug": "gerry-lopez-surfboards",
        "name": "Gerry Lopez",
        "website_url": None,
        "location_label": "Hawaii",
        "founder_name": "Gerry Lopez",
        "lead_shaper_name": "Gerry Lopez",
        "short_description": "Iconic Hawaiian templates from Pipeline legend Gerry Lopez.",
        "vendor_aliases": ["gerry lopez"],
    },
    {
        "slug": "ocean-soul-surfboards",
        "name": "Ocean Soul",
        "website_url": None,
        "location_label": None,
        "short_description": "Everyday softboards and fun shapes for beach-break surfing.",
        "vendor_aliases": ["ocean soul"],
    },
    {
        "slug": "aqss-surfboards",
        "name": "AQSS",
        "website_url": None,
        "location_label": "Australia",
        "short_description": "Australian softboards and beginner-friendly shapes.",
        "vendor_aliases": ["aqss"],
    },
    {
        "slug": "skindog-surfboards",
        "name": "Skindog",
        "website_url": None,
        "location_label": "Australia",
        "founder_name": "Mick 'Skindog' Rapa",
        "lead_shaper_name": "Mick 'Skindog' Rapa",
        "short_description": "Australian longboard designs associated with Mick 'Skindog' Rapa.",
        "vendor_aliases": ["skindog"],
    },
    {
        "slug": "wave-bandit",
        "name": "Wave Bandit",
        "website_url": None,
        "location_label": "California",
        "short_description": "California soft-tops and funboards for catchy everyday waves.",
        "vendor_aliases": ["wave bandit"],
    },
    {
        "slug": "kai-sallas-surfboards",
        "name": "Kai Sallas",
        "website_url": None,
        "location_label": "Hawaii",
        "founder_name": "Kai Sallas",
        "lead_shaper_name": "Kai Sallas",
        "short_description": "Hawaiian performance longboard and mid-length designs from Kai Sallas.",
        "vendor_aliases": ["kai sallas"],
    },
    {
        "slug": "murdey-surfboards",
        "name": "Murdey",
        "website_url": None,
        "location_label": None,
        "short_description": "Alternative mid-lengths and fishes with a cult small-brand following.",
        "vendor_aliases": ["murdey"],
    },
    {
        "slug": "misfit-surfboards",
        "name": "Misfit",
        "website_url": None,
        "location_label": "Australia",
        "short_description": "Australian alternative and performance shapes with a strong indie following.",
        "vendor_aliases": ["misfit"],
    },
    {
        "slug": "storm-blade-surfboards",
        "name": "Storm Blade",
        "website_url": None,
        "location_label": "Australia",
        "short_description": "Australian softboards for learners and progressing surfers.",
        "vendor_aliases": ["storm blade"],
    },
    {
        "slug": "blink-surfboards",
        "name": "Blink Surfboards",
        "website_url": None,
        "location_label": "Australia",
        "short_description": "Australian soft-tops and entry boards for everyday surf.",
        "vendor_aliases": ["blink"],
    },
    {
        "slug": "roger-hinds-surfboards",
        "name": "Roger Hinds",
        "website_url": None,
        "location_label": "California",
        "founder_name": "Roger Hinds",
        "lead_shaper_name": "Roger Hinds",
        "short_description": "Classic California longboard templates from Roger Hinds.",
        "vendor_aliases": ["roger hinds"],
    },
    {
        "slug": "bom-bora-surfboards",
        "name": "Bom Bora",
        "website_url": None,
        "location_label": "Australia",
        "short_description": "Australian softboards popular with beginners and progressing surfers.",
        "vendor_aliases": ["bom bora", "bombora", "bom-bora"],
    },
    {
        "slug": "foamie-surfboards",
        "name": "Foamie",
        "website_url": None,
        "location_label": None,
        "short_description": "Softboard shapes built for easy progression and everyday fun.",
        "vendor_aliases": ["foamie"],
    },
    {
        "slug": "point-classic-longboards",
        "name": "Point Classic Longboards",
        "website_url": None,
        "location_label": None,
        "short_description": "Classic longboard templates for noseriding and trim.",
        "vendor_aliases": ["point classic longboards", "point classic"],
    },
    {
        "slug": "ku-surfboards",
        "name": "KU Surfboards",
        "website_url": None,
        "location_label": None,
        "short_description": "Beginner-friendly softboards and starter board packages.",
        "vendor_aliases": ["ku surfboards", "ku"],
    },
    {
        "slug": "pace-surfboards",
        "name": "Pace",
        "website_url": None,
        "location_label": None,
        "short_description": "Small-label performance and alternative surfboard shapes.",
        "vendor_aliases": ["pace"],
    },
    {
        "slug": "forty-seven-surfboards",
        "name": "Forty Seven",
        "website_url": None,
        "location_label": None,
        "short_description": "Hand-shaped longboards and custom templates from Forty Seven.",
        "vendor_aliases": ["forty seven"],
    },
    {
        "slug": "inspired-surfboards",
        "name": "Inspired",
        "website_url": None,
        "location_label": None,
        "short_description": "Alternative shortboards and twin fins with a cult following.",
        "vendor_aliases": ["inspired"],
    },
    {
        "slug": "wildflower-surfboards",
        "name": "Wildflower",
        "website_url": None,
        "location_label": None,
        "short_description": "Colorful soft-tops and funboards designed for easy wave-catching.",
        "vendor_aliases": ["wildflower"],
    },
    {
        "slug": "gohl-surfboards",
        "name": "GOHL",
        "website_url": None,
        "location_label": None,
        "short_description": "Softboards for learners and progressing everyday surfers.",
        "vendor_aliases": ["gohl"],
    },
    {
        "slug": "cat-5-surfboards",
        "name": "Cat 5",
        "website_url": None,
        "location_label": None,
        "short_description": "Soft funboards built for catchy beach-break surf.",
        "vendor_aliases": ["cat 5", "cat5"],
    },
    {
        "slug": "eleventh-street-surfboards",
        "name": "11th Street Surfboards",
        "website_url": None,
        "location_label": "California",
        "short_description": "California performance shortboards from 11th Street.",
        "vendor_aliases": ["11th street surfboards", "11th street"],
    },
    {
        "slug": "sundance-surfboards",
        "name": "Sundance",
        "website_url": None,
        "location_label": None,
        "short_description": "Modern mid-lengths and performance fishes from Sundance.",
        "vendor_aliases": ["sundance"],
    },
    {
        "slug": "bark-surfboards",
        "name": "Bark",
        "website_url": None,
        "location_label": "California",
        "short_description": "High-performance guns and big-wave boards associated with Bark.",
        "vendor_aliases": ["bark"],
    },
    {
        "slug": "solid-surfboards",
        "name": "Solid",
        "website_url": None,
        "location_label": None,
        "short_description": "Indie performance and alternative surfboard shapes.",
        "vendor_aliases": ["solid"],
    },
    {
        "slug": "bic-surfboards",
        "name": "BIC Surfboards",
        "website_url": None,
        "location_label": None,
        "short_description": "Durable beginner and rental-friendly surfboards (Tahe / BIC).",
        "vendor_aliases": ["bic", "tahe", "tahe (formally bic)", "tahe ( formally bic)"],
    },
]

RETAILERS = [
    "https://boardworld.com.au",
    "https://www.surfstationstore.com",
    "https://www.surfboardsdirect.com.au",
    "https://www.thesurfboardwarehouse.com.au",
    "https://www.cleanlinesurf.com",
    "https://www.jackssurfboards.com",
    "https://www.swell.com",
    "https://www.wetsuitwearhouse.com",
    "https://www.surfshop.com",
    "https://www.surftech.com",
    "https://emerysurfboards.com",
    "https://www.tcsurf.com",
    "https://firewiresurfboards.com",
    "https://www.catchsurf.com",
]

BOARD = re.compile(
    r"\b(surfboards?|softboards?|soft[\s-]?tops?|longboards?|shortboards?|funboards?|"
    r"mid[\s-]?lengths?|eggs?|fishes?|twin[\s-]?fins?|single[\s-]?fins?|alaia|paipo|"
    r"surf craft)\b",
    re.I,
)
SOFT = re.compile(
    r"\b(tee|t-?shirt?|hoodie|hat|sticker|gift\s*card|wax|leash|cap|beanie|shirt|jacket|"
    r"shorts?|socks?|traction|pad|pads|skate|deck|bag|backpack|towel|fin set|\bfins?\b|"
    r"cover|poncho|rash|wetsuit|poster|print|book|magazine|keyring|keychain|wallet|"
    r"sunglasses|watch|jewelry|jewellery|necklace|ring|earring|candle|soap|perfume|"
    r"board bag|day bag|travel bag|backpack|duffel|duffle|cooler|umbrella|chair|"
    r"hardware|bolt|screw|ding|repair|resin|sandpaper|masking|tape|"
    r"wall rack|rack|mount|handplane|bodyboard|skimboard|yoga|pump|lantern|"
    r"boardshort|trunk|muscle tee|crew|hoodie)\b",
    re.I,
)
HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin set|fins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|boardshort|gift ?card|candle|yoga|handplane|"
    r"bodyboard|skimboard|wall rack|rack|mount)\b",
    re.I,
)
DIM_TAIL = re.compile(
    r"[\s\-_/]*\d+['′]\d*(?:[\"″]\d*)?(?:\s*[x×]\s*\d+.*)?$",
    re.I,
)
SIZE_ONLY = re.compile(r"^\d+['′]\d*", re.I)


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
    if not text:
        return None
    return text[:500]


def is_surfboard(product: dict) -> bool:
    title = product.get("title") or ""
    product_type = product.get("product_type") or ""
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    blob = f"{title} {product_type} {tags}"
    if HARD_EXCLUDE.search(title) or HARD_EXCLUDE.search(product_type):
        return False
    if SOFT.search(title) and not BOARD.search(title):
        return False
    if re.search(r"\b(apparel|clothing|accessories|fins?|leashes?)\b", product_type, re.I) and not BOARD.search(
        product_type
    ):
        return False
    # Ocean & Earth / softboard brands often use product_type Softboard / Soft Top
    if re.search(r"soft\s*-?\s*(board|top)|surfboard|longboard|shortboard|funboard", product_type, re.I):
        return True
    return bool(BOARD.search(blob))


def product_belongs_to_brand(
    product: dict,
    brand_name: str,
    aliases: list[str] | None = None,
    *,
    exact_vendors: list[str] | None = None,
) -> bool:
    """For brand-owned shops that also stock other labels, keep only own-brand rows."""
    vendor = (product.get("vendor") or "").casefold().strip()
    title = (product.get("title") or "").casefold()
    product_type = (product.get("product_type") or "").casefold()

    if exact_vendors:
        allowed = {re.sub(r"[^a-z0-9]+", "", v.casefold()) for v in exact_vendors}
        vendor_n = re.sub(r"[^a-z0-9]+", "", vendor)
        return vendor_n in allowed

    names = [brand_name.casefold(), *(a.casefold() for a in (aliases or []))]
    expanded = list(names)
    for n in list(names):
        expanded.append(re.sub(r"\b(surfboards?|softboards?|surf craft)\b", "", n).strip())
    expanded = [re.sub(r"\s+", " ", x).strip() for x in expanded if x and len(re.sub(r"[^a-z0-9]+", "", x)) >= 3]

    vendor_n = re.sub(r"[^a-z0-9]+", "", vendor)
    for n in expanded:
        nn = re.sub(r"[^a-z0-9]+", "", n)
        if not nn:
            continue
        if nn == vendor_n or (len(nn) >= 4 and nn in vendor_n):
            return True
        if title.startswith(n) or f" {n} " in f" {title} ":
            return True
    if not vendor:
        return True
    # Prefer board product types when vendor is ambiguous.
    if re.search(r"surfboard|softboard|longboard|shortboard", product_type):
        return True
    return False


def clean_model_name(title: str, brand_name: str) -> str:
    name = title.strip()
    # Drop leading brand name
    for prefix in [brand_name, brand_name.replace("&", "and")]:
        if name.casefold().startswith(prefix.casefold()):
            name = name[len(prefix) :].lstrip(" -|:/")
    # Collapse size suffixes when the whole title is just brand + size
    name = re.sub(r"\s+", " ", name).strip(" -|:/")
    if not name or SIZE_ONLY.match(name):
        name = title.strip()
    # Prefer unique model before first length token if title has a clear model + dims
    m = re.match(
        r"(.+?)(?:\s+[-–—]\s+|\s+)(\d+['′]\d*(?:[\"″]\d*)?(?:\s*[x×].*)?)$",
        name,
    )
    if m and len(m.group(1).strip()) >= 3:
        candidate = m.group(1).strip(" -|:/")
        if not SIZE_ONLY.match(candidate):
            name = candidate
    return name[:120].strip()


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def products_to_models(
    products: list[dict],
    brand_name: str,
    limit: int = 80,
    require_own_vendor: bool = False,
    aliases: list[str] | None = None,
    exact_vendors: list[str] | None = None,
    allowed_product_types: list[str] | None = None,
) -> list[dict]:
    models: dict[str, dict] = {}
    allowed_types = {t.casefold() for t in (allowed_product_types or [])}
    for product in products:
        product_type = (product.get("product_type") or "").casefold()
        if allowed_types and product_type not in allowed_types:
            continue
        if not is_surfboard(product):
            continue
        title = (product.get("title") or "").strip()
        if not title:
            continue
        if re.search(r"\b(faq|free 3d|digital art|graphic files|objects and graphic)\b", title, re.I):
            continue
        if require_own_vendor and not product_belongs_to_brand(
            product,
            brand_name,
            aliases,
            exact_vendors=exact_vendors,
        ):
            continue
        name = clean_model_name(title, brand_name)
        if len(name) < 2:
            continue
        # Skip obvious custom deposits / gift cards / accessories that slipped through
        if re.search(
            r"\b(gift\s*card|deposit|custom order|voucher|leash|fin set|\bfins?\b|handplane|faq)\b",
            name,
            re.I,
        ):
            continue
        key = model_key(name)
        if not key:
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
            if (not existing.get("description")) and desc:
                existing["description"] = desc
            # Prefer shorter cleaner names without dimensions
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


def vendor_matches(vendor: str, aliases: list[str]) -> bool:
    blob = (vendor or "").casefold().strip()
    blob_n = re.sub(r"[^a-z0-9]+", "", blob)
    for alias in aliases:
        a = alias.casefold().strip()
        an = re.sub(r"[^a-z0-9]+", "", a)
        if not an:
            continue
        # Short aliases must be exact vendor matches to avoid false positives.
        if len(an) <= 3:
            if an == blob_n:
                return True
            continue
        if an == blob_n or an in blob_n or a in blob:
            return True
    return False


def title_matches_brand(title: str, tags: str, aliases: list[str], brand_name: str) -> bool:
    blob = f"{title} {tags}".casefold()
    # Prefer explicit brand-name prefix/token matches in title for retailer rows.
    name = brand_name.casefold()
    if len(name) >= 4 and (blob.startswith(name) or f" {name} " in f" {blob} "):
        return True
    for alias in aliases:
        a = alias.casefold().strip()
        if len(a) < 4:
            continue
        if blob.startswith(a) or f" {a} " in f" {blob} ":
            return True
    return False


def main() -> None:
    brands_out: list[dict] = []

    print("Scraping direct brand Shopify feeds...")
    for brand in DIRECT_BRANDS:
        base = brand["shopify_base"]
        products = shopify_all(base, pages=12 if brand["slug"] == "pukas-surfboards" else 8)
        # Multi-brand shops (e.g. Pukas) need vendor filtering.
        require_own = brand["slug"] in {
            "pukas-surfboards",
            "ocean-and-earth",
            "ventana-surfboards",
            "funner-surf-craft",
        }
        aliases = {
            "pukas-surfboards": ["pukas", "indio"],
            "ocean-and-earth": ["ocean & earth", "ocean and earth", "o&e", "oe"],
            "ventana-surfboards": ["ventana"],
            "funner-surf-craft": ["funner"],
        }.get(brand["slug"], [])
        exact_vendors = {
            "pukas-surfboards": ["PUKAS SURFBOARDS", "INDIO SURFBOARDS"],
        }.get(brand["slug"])
        allowed_types = {
            "ventana-surfboards": ["Surfboard", "Locus Eco Surfboards"],
        }.get(brand["slug"])
        models = products_to_models(
            products,
            brand["name"],
            require_own_vendor=require_own,
            aliases=aliases,
            exact_vendors=exact_vendors,
            allowed_product_types=allowed_types,
        )
        print(f"  {brand['slug']}: products={len(products)} models={len(models)} imgs={sum(1 for m in models if m.get('image_url'))}")
        entry = {
            "slug": brand["slug"],
            "name": brand["name"],
            "website_url": brand.get("website_url"),
            "location_label": brand.get("location_label"),
            "founder_name": brand.get("founder_name"),
            "lead_shaper_name": brand.get("lead_shaper_name"),
            "short_description": brand.get("short_description"),
            "models": models,
        }
        brands_out.append(entry)

    print("Loading retailer catalogs...")
    pool: list[dict] = []
    for base in RETAILERS:
        products = shopify_all(base)
        print(f"  {base}: {len(products)}")
        pool.extend(products)

    print("Matching retailer brands...")
    for brand in RETAILER_BRANDS:
        aliases = brand["vendor_aliases"]
        matched = []
        for product in pool:
            vendor = product.get("vendor") or ""
            title = product.get("title") or ""
            tags = product.get("tags") or ""
            if isinstance(tags, list):
                tags = " ".join(tags)
            if vendor_matches(vendor, aliases) or title_matches_brand(
                title, tags, aliases, brand["name"]
            ):
                matched.append(product)
        models = products_to_models(matched, brand["name"])
        print(
            f"  {brand['slug']}: matched_products={len(matched)} models={len(models)} "
            f"imgs={sum(1 for m in models if m.get('image_url'))}"
        )
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

    # Keep only brands that produced at least 2 models with images.
    usable = [
        b
        for b in brands_out
        if len(b["models"]) >= 2 and sum(1 for m in b["models"] if m.get("image_url")) >= 2
    ]
    # Prefer brands with images
    usable.sort(
        key=lambda b: (
            -sum(1 for m in b["models"] if m.get("image_url")),
            -len(b["models"]),
            b["slug"],
        )
    )

    # Ensure exactly 25 if possible
    selected = usable[:25]
    if len(selected) < 25:
        print(f"WARNING: only {len(selected)} brands with models")
        # Fall back to any brand with >=1 imaged model to fill.
        extras = [
            b
            for b in brands_out
            if b["slug"] not in {x["slug"] for x in selected}
            and sum(1 for m in b["models"] if m.get("image_url")) >= 1
        ]
        extras.sort(
            key=lambda b: (
                -sum(1 for m in b["models"] if m.get("image_url")),
                -len(b["models"]),
                b["slug"],
            )
        )
        selected.extend(extras[: max(0, 25 - len(selected))])
        print(f"After fallback: {len(selected)} brands")

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Add 25 more popular small surf brands with models and product images",
        "product_category_slug": "surfboards",
        "brands": selected,
        "summary": {
            "brand_count": len(selected),
            "model_count": sum(len(b["models"]) for b in selected),
            "image_count": sum(1 for b in selected for m in b["models"] if m.get("image_url")),
        },
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))
    print(f"wrote {OUT}")
    for b in selected:
        imgs = sum(1 for m in b["models"] if m.get("image_url"))
        print(f"  {b['slug']:35} models={len(b['models']):3} imgs={imgs:3}")


if __name__ == "__main__":
    main()
