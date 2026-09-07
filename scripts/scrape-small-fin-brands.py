#!/usr/bin/env python3
"""
Scrape small/indie surf fin brands into a catalog seed.

Writes:
  scripts/data/surfboard-catalog-seed/small-fin-brands.json

Import:
  npx tsx scripts/import-core-shapers-catalog.ts \\
    --seed scripts/data/surfboard-catalog-seed/small-fin-brands.json \\
    --backfill /dev/null \\
    --category fins
"""
from __future__ import annotations

import json
import re
import socket
import ssl
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

socket.setdefaulttimeout(20)
UA = "Mozilla/5.0 (compatible; ReswellCatalogBot/1.0)"
CTX = ssl.create_default_context()
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-fin-brands.json")

DIRECT: list[dict] = [
    {
        "slug": "captain-fin",
        "name": "Captain Fin",
        "website_url": "https://www.captainfin.com",
        "shopify_base": "https://www.captainfin.com",
        "location_label": "California",
        "short_description": "California fin company known for twins, keels, thrusters, and longboard singles.",
        "exact_vendors": ["Captain Fin", "Captain Fin Co.", "Captain Fin Co"],
        "pages": 12,
    },
    {
        "slug": "deflow-fins",
        "name": "Deflow",
        "website_url": "https://www.deflowsurf.com",
        "shopify_base": "https://www.deflowsurf.com",
        "location_label": "Spain",
        "short_description": "Spanish performance and alternative fins with a strong European following.",
        "exact_vendors": ["Deflow"],
        "pages": 8,
    },
    {
        "slug": "alkali-fins",
        "name": "Alkali Fins",
        "website_url": "https://www.alkalifins.com",
        "shopify_base": "https://www.alkalifins.com",
        "location_label": "Australia",
        "short_description": "Hand-made twin, keel, and progressive fins with custom colorways.",
        "exact_vendors": ["Alkali Fins", "Alkali_FinsAU", "Alkali"],
        "pages": 6,
    },
    {
        "slug": "mid-fin-co",
        "name": "Mid Fin Co",
        "website_url": "https://www.midfinco.com",
        "shopify_base": "https://www.midfinco.com",
        "location_label": "Hawaii",
        "short_description": "Hawaiian single fins, pivots, and twin templates from Mid Fin Co.",
        "exact_vendors": ["Mid Fin Co.", "Mid Fin Co", "My Store"],
        "pages": 4,
    },
    {
        "slug": "nvs-fins",
        "name": "NVS",
        "website_url": "https://nvssurf.com",
        "shopify_base": "https://nvssurf.com",
        "short_description": "Performance thrusters, quads, and twins from Naked Viking Surf / NVS.",
        "exact_vendors": ["NVS", "NVS Surf", "Naked Viking Surf"],
        "pages": 6,
    },
    {
        "slug": "dafin",
        "name": "DaFiN",
        "website_url": "https://www.dafin.com",
        "shopify_base": "https://www.dafin.com",
        "location_label": "Hawaii",
        "short_description": "Hawaiian swim fins favored by lifeguards and bodysurfers.",
        "exact_vendors": ["DaFiN", "DaFin", "Dafin"],
        "pages": 4,
    },
    {
        "slug": "churchill-fins",
        "name": "Churchill",
        "website_url": "https://www.churchillswimfins.com",
        "shopify_base": "https://www.churchillswimfins.com",
        "location_label": "California",
        "short_description": "Classic California swim fins for bodysurfing and lifeguard use.",
        "exact_vendors": ["Churchill", "Churchill Swim Fins", "Churchill® Swimfins"],
        "pages": 3,
    },
    {
        "slug": "grindhouse",
        "name": "Grindhouse",
        "website_url": "https://grindhousefins.com",
        "shopify_base": "https://grindhousefins.com",
        "short_description": "Accessible thruster, twin, quad, and single fin sets.",
        "exact_vendors": None,  # vendor fields are category labels
        "pages": 3,
    },
    {
        "slug": "pacific-vibrations-surfboard-fins",
        "name": "Pacific Vibrations Surfboard Fins",
        "website_url": "https://pacificvibrations.com",
        "shopify_base": "https://pacificvibrations.com",
        "location_label": "California",
        "short_description": "California glass-on and box fins including classic twin and longboard templates.",
        "exact_vendors": ["Pacific Vibrations Surfboard Fins", "Pacific Vibrations"],
        "pages": 8,
    },
    {
        "slug": "roam-fins",
        "name": "Roam",
        "website_url": "https://www.roamadventureco.com",
        "shopify_base": "https://www.roamadventureco.com",
        "short_description": "Soft-top and travel-friendly replacement fins.",
        "exact_vendors": ["Roam", "Roam Adventure Co", "ROAM", "ROAM Adventure Co."],
        "pages": 6,
    },
    {
        "slug": "bolero-fins",
        "name": "Bolero",
        "website_url": "https://bolerosurf.com",
        "shopify_base": "https://bolerosurf.com",
        "location_label": "Australia",
        "short_description": "Australian performance fins including turbine-blade fibreglass templates.",
        "exact_vendors": ["Bolero"],
        "pages": 3,
    },
    {
        "slug": "quobba-fins",
        "name": "Quobba Fins",
        "website_url": "https://quobbafins.com",
        "shopify_base": "https://quobbafins.com",
        "location_label": "Western Australia",
        "short_description": "Margaret River fin brand with patented base-flow / shifter designs.",
        "exact_vendors": ["quobba", "Quobba", "Quobba Fins"],
        "pages": 4,
    },
    {
        "slug": "catch-surf",
        "name": "Catch Surf",
        "website_url": "https://www.catchsurf.com",
        "shopify_base": "https://www.catchsurf.com",
        "location_label": "California",
        "short_description": "Softboard and alternative replacement fins from Catch Surf.",
        "exact_vendors": ["Catch Surf"],
        "pages": 6,
        # Prefer titles that are clearly fins, not complete softboards
        "title_must": r"(fin\s*set|plank\s+fin|side\s*bite\s*fin|replacement\s+fin|\bhi-perf\b.+\bfin)",
        "title_must_not": r"softboard|beater|retro\s+fish|heritage|fat\s+bat|nose\s*rider|plank\s*//|bat\s*tail|\d+['′]\d+",
    },
]

RETAILERS = [
    "https://www.cleanlinesurf.com",
    "https://www.jackssurfboards.com",
    "https://boardworld.com.au",
    "https://www.tcsurf.com",
    "https://www.surfstationstore.com",
    "https://www.wetsuitwearhouse.com",
    "https://www.firewiresurfboards.com",
    "https://www.catchsurf.com",
    "https://www.pukassurfshop.com",
]

RETAILER_BRANDS: list[dict] = [
    {
        "slug": "flying-diamonds-fins",
        "name": "Flying Diamonds",
        "website_url": None,
        "short_description": "Performance and alternative fin templates including signature models.",
        "vendor_aliases": ["flying diamonds"],
    },
    {
        "slug": "endorfins",
        "name": "Endorfins",
        "website_url": "https://www.firewiresurfboards.com",
        "short_description": "Kelly Slater / Outerknown Endorfins performance fin sets.",
        "vendor_aliases": ["endorfins"],
    },
    {
        "slug": "shapers-fins",
        "name": "Shapers",
        "website_url": None,
        "location_label": "Australia",
        "short_description": "Australian fin brand with twin, thruster, and signature templates.",
        "vendor_aliases": ["shapers"],
    },
    {
        "slug": "rainbow-fin-company",
        "name": "Rainbow Fin Company",
        "website_url": "https://rainbowfins.com",
        "location_label": "California",
        "short_description": "Classic California longboard and progressive fin templates.",
        "vendor_aliases": ["rainbow fin", "rainbow fins", "rainbow fin company"],
    },
    {
        "slug": "blocksurf-fins",
        "name": "Blocksurf",
        "website_url": None,
        "short_description": "California twin and alternative fin sets.",
        "vendor_aliases": ["blocksurf", "block surf"],
    },
    {
        "slug": "storm-blade-fins",
        "name": "Storm Blade",
        "website_url": None,
        "short_description": "Softboard replacement fins and soft-top fin sets.",
        "vendor_aliases": ["storm blade"],
    },
    {
        "slug": "koalition-fins",
        "name": "Koalition",
        "website_url": None,
        "short_description": "Performance thruster and alternative fin templates.",
        "vendor_aliases": ["koalition"],
    },
]

FIN_HINT = re.compile(
    r"\b(fins?|thruster|keel|quad|twin|stabilizer|side\s*bite|sidebite|trailer|"
    r"single\s*fin|2\+1|twin\+|tri-?quad|5-?fin|swim\s*fin|bodysurf|swimfin|"
    r"dafin|makapuu)\b",
    re.I,
)
HARD_EXCLUDE = re.compile(
    r"\b(t-?shirt|tee|hoodie|hat|beanie|boardshort|shirt|woven|fleece|jacket|"
    r"sticker|gift\s*card|towel|bag|backpack|leash|wax|traction|pad|pads|"
    r"rash|poncho|sock|socks|savers?|tethers?|cover|skate|deck|glove|mitt|wetsuit|"
    r"surfboard(?!\s+(fin|replacement))|shortboard|longboard(?!\s+fin)|"
    r"lingerie|robe|tent|chair|table|bundle|package|wholesale|"
    r"\d+\s*sets?\s+of)\b",
    re.I,
)
ACCESSORY_EXCLUDE = re.compile(
    r"\b(fin\s*socks?|fin\s*savers?|fin\s*pads?|fin\s*tethers?|mesh\s*bag|"
    r"gift\s*card|sticker|keys?)\b",
    re.I,
)
BOARD_LENGTH = re.compile(r"\b\d+['′]\d+|^\d+['′]\d+|x\s*\d+|softboards?\b", re.I)
COLOR_TAIL = re.compile(
    r"\s*[-–—/]\s*(black|white|clear|blue|red|green|yellow|orange|pink|gold|"
    r"cream|mint|brown|multi|brick|coral|amber|kelp|cherry|sand|granite|"
    r"avocado|burgundy|navy|olive|teal|purple|smoke|carbon).*$",
    re.I,
)

SWIM_FIN_TYPES = re.compile(
    r"dafin|kicks|swim\s*fins?|lifeguard|signature|classic|flex",
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
            print(f"  skip {base} page {page}: {type(exc).__name__}")
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
        time.sleep(0.2)
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
    return text[:400] if text else None


def is_fin_product(product: dict) -> bool:
    title = product.get("title") or ""
    product_type = product.get("product_type") or ""
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    if ACCESSORY_EXCLUDE.search(title) or ACCESSORY_EXCLUDE.search(product_type):
        return False
    # Softboards / complete boards that mention a fin setup in the title
    if BOARD_LENGTH.search(title) and not re.search(
        r"replacement\s+fin|plank\s+fin|slot\s*box|bolt\s*through|\bfins?\b\s*$",
        title,
        re.I,
    ):
        if not re.search(r"^(?:.+\s)?(?:plank\s+)?fin\b", title, re.I):
            return False
    if HARD_EXCLUDE.search(title) and not FIN_HINT.search(product_type):
        return False
    if HARD_EXCLUDE.search(product_type) and not FIN_HINT.search(product_type):
        return False
    blob = f"{title} {product_type} {tags}"
    if re.search(r"surfboard\s+fin|swim\s*fin|fin\s+set|\bfins?\b|replacement\s+fin", product_type, re.I):
        return True
    if product_type.casefold() in {
        "fins",
        "thrusters",
        "quads",
        "twin",
        "tri-quads",
        "trailers",
        "stabilizer",
        "asym",
        "single fin",
        "twin fin set",
        "quad fins",
        "thruster fins",
        "twin fins",
        "swimfins",
    }:
        return True
    if re.search(r"^surfboard fin\b", product_type, re.I):
        return True
    # Swim-fin specialty shops (DaFiN / Churchill product types rarely say "Fins")
    if SWIM_FIN_TYPES.search(product_type) and not ACCESSORY_EXCLUDE.search(title):
        if re.search(r"dafin|kicks|churchill|makapuu|swim", blob, re.I):
            return True
    return bool(FIN_HINT.search(blob)) and not HARD_EXCLUDE.search(title)


def vendor_allowed(product: dict, exact_vendors: list[str] | None) -> bool:
    if exact_vendors is None:
        return True
    vendor = (product.get("vendor") or "").strip()
    vendor_n = re.sub(r"[^a-z0-9]+", "", vendor.casefold())
    allowed = {re.sub(r"[^a-z0-9]+", "", v.casefold()) for v in exact_vendors}
    if not vendor:
        return True
    if vendor_n in allowed:
        return True
    for a in allowed:
        if len(a) >= 4 and (a in vendor_n or vendor_n in a):
            return True
    return False


def clean_fin_name(title: str, brand_name: str) -> str:
    name = title.strip()
    if "|" in name:
        name = name.split("|", 1)[0].strip()
    for prefix in [
        brand_name,
        "Captain Fin Co.",
        "Captain Fin Co",
        "Captain Fin",
        "CF ",
        "Deflow",
        "Alkali Fins",
        "Alkali",
        "Mid Fin Co.",
        "Mid Fin Co",
        "NVS",
        "DaFiN Pro",
        "DaFiN",
        "DaFin",
        "Dafin",
        "Churchill®",
        "Churchill",
        "Grindhouse",
        "Pacific Vibrations",
        "Roam Adventure Co",
        "Roam",
        "Bolero",
        "Quobba Fins",
        "Quobba",
        "Catch Surf",
        "Storm Blade",
        "Wave Bandit",
        "Flying Diamonds",
        "Endorfins",
        "Shapers",
        "Rainbow Fin Company",
        "Rainbow Fins",
        "Rainbow Fin",
        "Blocksurf",
        "Block Surf",
    ]:
        if name.casefold().startswith(prefix.casefold()):
            name = name[len(prefix) :].lstrip(" -|:/®")
    # Strip tab system / construction suffixes
    name = re.sub(
        r"\s*[-–—]\s*(Single Tab|Twin Tab|Snap In|Futures|FCS\s*II?|Double Tab).*$",
        "",
        name,
        flags=re.I,
    )
    name = re.sub(r"\s*\((?:M,\s*L|S,\s*M,\s*L|Clearance|Apex[^)]*)\)\s*", " ", name, flags=re.I)
    name = re.sub(r"\s*-\s*Apex\s*Clearance.*$", "", name, flags=re.I)
    name = COLOR_TAIL.sub("", name)
    name = re.sub(r"\s+", " ", name).strip(" -|:/")
    if re.search(r"^(gift\s*card|sticker|keys?)$", name, re.I):
        return ""
    return name[:120]


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def products_to_models(
    products: list[dict],
    brand_name: str,
    *,
    exact_vendors: list[str] | None = None,
    title_must: str | None = None,
    title_must_not: str | None = None,
    limit: int = 100,
) -> list[dict]:
    must_re = re.compile(title_must, re.I) if title_must else None
    must_not_re = re.compile(title_must_not, re.I) if title_must_not else None
    models: dict[str, dict] = {}
    for product in products:
        if not is_fin_product(product):
            continue
        if not vendor_allowed(product, exact_vendors):
            continue
        title = (product.get("title") or "").strip()
        if not title:
            continue
        if must_re and not must_re.search(title):
            continue
        if must_not_re and must_not_re.search(title):
            continue
        name = clean_fin_name(title, brand_name)
        if len(name) < 2:
            continue
        if ACCESSORY_EXCLUDE.search(name):
            continue
        if HARD_EXCLUDE.search(name) and not FIN_HINT.search(name):
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
            if image and not existing.get("image_url"):
                existing["image_url"] = image
            if desc and not existing.get("description"):
                existing["description"] = desc
            if len(name) < len(existing["name"]):
                existing["name"] = name
    ranked = sorted(models.values(), key=lambda m: (-m["_score"], m["name"].casefold()))
    return [
        {"name": m["name"], "image_url": m.get("image_url"), "description": m.get("description")}
        for m in ranked[:limit]
    ]


def vendor_matches(vendor: str, aliases: list[str]) -> bool:
    blob = (vendor or "").casefold()
    blob_n = re.sub(r"[^a-z0-9]+", "", blob)
    for alias in aliases:
        a = alias.casefold().strip()
        an = re.sub(r"[^a-z0-9]+", "", a)
        if not an:
            continue
        if len(an) <= 3:
            if an == blob_n:
                return True
            continue
        if an == blob_n or an in blob_n or a in blob:
            return True
    return False


def main() -> None:
    brands_out: list[dict] = []

    print("Scraping direct fin brand shops...")
    for brand in DIRECT:
        products = shopify_all(brand["shopify_base"], pages=int(brand.get("pages") or 6))
        models = products_to_models(
            products,
            brand["name"],
            exact_vendors=brand.get("exact_vendors"),
            title_must=brand.get("title_must"),
            title_must_not=brand.get("title_must_not"),
            limit=100,
        )
        imgs = sum(1 for m in models if m.get("image_url"))
        print(f"  {brand['slug']}: products={len(products)} models={len(models)} imgs={imgs}")
        if not models:
            continue
        brands_out.append(
            {
                "slug": brand["slug"],
                "name": brand["name"],
                "website_url": brand.get("website_url"),
                "location_label": brand.get("location_label"),
                "short_description": brand.get("short_description"),
                "models": models,
            }
        )

    print("Loading retailer catalogs for additional fin brands...")
    pool: list[dict] = []
    for base in RETAILERS:
        products = shopify_all(base, pages=6)
        print(f"  {base}: {len(products)}")
        pool.extend(products)

    print("Matching retailer fin brands...")
    for brand in RETAILER_BRANDS:
        aliases = brand["vendor_aliases"]
        matched = []
        for product in pool:
            vendor = product.get("vendor") or ""
            title = product.get("title") or ""
            if vendor_matches(vendor, aliases) or any(
                a in title.casefold() for a in aliases if len(a) >= 5
            ):
                matched.append(product)
        models = products_to_models(matched, brand["name"], limit=80)
        imgs = sum(1 for m in models if m.get("image_url"))
        print(f"  {brand['slug']}: matched={len(matched)} models={len(models)} imgs={imgs}")
        if len(models) < 1:
            continue
        brands_out.append(
            {
                "slug": brand["slug"],
                "name": brand["name"],
                "website_url": brand.get("website_url"),
                "location_label": brand.get("location_label"),
                "short_description": brand.get("short_description"),
                "models": models,
            }
        )

    usable = [b for b in brands_out if len(b["models"]) >= 1]
    usable.sort(
        key=lambda b: (
            -sum(1 for m in b["models"] if m.get("image_url")),
            -len(b["models"]),
            b["slug"],
        )
    )

    payload = {
        "generated_for": "reswell fins catalog",
        "purpose": "Add small/indie fin brands with models and product images",
        "product_category_slug": "fins",
        "brands": usable,
        "summary": {
            "brand_count": len(usable),
            "model_count": sum(len(b["models"]) for b in usable),
            "image_count": sum(1 for b in usable for m in b["models"] if m.get("image_url")),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))
    print(f"wrote {OUT}")
    for b in usable:
        imgs = sum(1 for m in b["models"] if m.get("image_url"))
        print(f"  {b['slug']:40} models={len(b['models']):3} imgs={imgs:3}")


if __name__ == "__main__":
    main()
