#!/usr/bin/env python3
"""
Strict image matching for core shaper models that imported without photos.

Sources:
  - Retailer / brand Shopify `products.json` feeds
  - Brand HTML pages (og:image) for a few known model URLs

Writes:
  - scripts/data/surfboard-catalog-seed/core-shapers-image-backfill.json
  - /tmp/image-backfill-seed.json (debug, includes match metadata)

Requires /tmp/zero-image-brands.json:
  [{slug, name, models:[{id,name}]}]
"""
from __future__ import annotations

import json
import re
import socket
import urllib.request
from pathlib import Path

socket.setdefaulttimeout(12)
UA = "Mozilla/5.0 (compatible; ReswellCatalogBot/1.0)"

ZERO_PATH = Path("/tmp/zero-image-brands.json")
OUT_TMP = Path("/tmp/image-backfill-seed.json")
OUT_SEED = Path("/workspace/scripts/data/surfboard-catalog-seed/core-shapers-image-backfill.json")

RETAILERS = [
    "https://boardworld.com.au",
    "https://www.surfstationstore.com",
    "https://www.surfboardsdirect.com.au",
    "https://www.thesurfboardwarehouse.com.au",
    "https://firewiresurfboards.com",
    "https://emerysurfboards.com",
    "https://www.tcsurf.com",
    "https://www.cleanlinesurf.com",
    "https://www.jackssurfboards.com",
    "https://www.swell.com",
    "https://www.wetsuitwearhouse.com",
    "https://www.surfshop.com",
    "https://www.surftech.com",
    "https://www.catchsurf.com",
]

BRAND_ALIASES: dict[str, list[str]] = {
    "torq-surfboards": ["torq"],
    "softech-surfboards": ["softech"],
    "nsp-surfboards": ["nsp"],
    "machado-surfboards": ["machado", "rob machado"],
    "cj-nelson-designs": ["cj nelson"],
    "hawaiian-pro-designs": ["donald takayama", "takayama", "hawaiian pro"],
    "emery-surfboards": ["emery"],
    "takayama-surfboards": ["takayama", "donald takayama"],
    "lib-tech-surfboards": ["lib tech", "libtech"],
    "chemistry-surfboards": ["chemistry"],
}

MODEL_ALIASES: dict[tuple[str, str], list[str]] = {
    ("torq-surfboards", "Fish"): ["mod fish", "mody fish"],
    ("torq-surfboards", "Longboard"): ["longboard tet", "tet longboard", "longboard"],
    ("torq-surfboards", "Tec Multiplier"): ["multiplier"],
    ("torq-surfboards", "Pond Scum"): ["pod mod"],
    ("nsp-surfboards", "Protech Fish"): ["fish elements", "elements fish", "hdt fish"],
    ("nsp-surfboards", "Elements Funboard"): ["fun elements", "elements fun"],
    ("nsp-surfboards", "Shortboard"): ["hybrid short", "elements hybrid short"],
    ("nsp-surfboards", "Hybrid"): ["hybrid short", "elements hybrid"],
    ("nsp-surfboards", "Longboard"): ["longboard elements", "elements long", "longboard"],
    ("softech-surfboards", "Roller"): ["roller"],
    ("softech-surfboards", "Bomber"): ["bomber"],
    ("machado-surfboards", "Seaside"): ["seaside"],
    ("machado-surfboards", "Cado"): ["xtra cado", "xtra-cado", "machadocado"],
    ("machado-surfboards", "Sunday"): ["sunday"],
    ("emery-surfboards", "Step-Up"): ["haz step up", "step up"],
    ("emery-surfboards", "Fish"): ["haz fish"],
    ("cj-nelson-designs", "The Paragon"): ["paragon"],
    ("cj-nelson-designs", "The Outlier"): ["outlier"],
    ("takayama-surfboards", "Scorpion"): ["scorpion"],
    ("takayama-surfboards", "DT-2"): ["dt-2", "dt2"],
    ("takayama-surfboards", "In The Pink"): ["in the pink"],
    ("takayama-surfboards", "Model T"): ["model t"],
    ("hawaiian-pro-designs", "DT-1"): ["dt-1", "dt1"],
    ("hawaiian-pro-designs", "Egg"): ["egg tuflite", "egg"],
    ("lib-tech-surfboards", "Pickup Stick"): ["pickup stick"],
    ("chemistry-surfboards", "Twin"): ["chem twin", "twin"],
}

HTML_PAGES: dict[tuple[str, str], str] = {
    ("hawaiian-pro-designs", "DT-1"): (
        "https://www.surfboardsbydonaldtakayama.com/surfboards/progressive-longboards/dt-1/"
    ),
    ("chemistry-surfboards", "Twin"): "https://www.chemistrysurfboards.com/chem-twin-2",
}

BOARD = re.compile(
    r"\b(surfboards?|softboards?|soft[\s-]?tops?|longboards?|shortboards?|funboards?|custom order surf)\b",
    re.I,
)
SOFT = re.compile(
    r"\b(tee|t-?shirt|hoodie|hat|sticker|gift\s*card|wax|leash|cap|beanie|shirt|jacket|"
    r"shorts?|socks?|traction|pad|pads|skate|deck|bag|backpack|towel|fin set|fins?\b|"
    r"cover|poncho|rash|wetsuit)\b",
    re.I,
)


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode())


def fetch_html(url: str) -> tuple[str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", "replace"), resp.geturl()


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
        if len(batch) < 250:
            break
    return out


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").casefold())


def score(model: str, title: str, aliases: list[str] | None = None) -> int:
    best = 0
    title_n = norm(title)
    for candidate in [model, *(aliases or [])]:
        model_n = norm(candidate)
        if not model_n or not title_n:
            continue
        if model_n == title_n:
            best = max(best, 100)
            continue
        if model_n in title_n:
            best = max(best, 90)
            continue
        model_tokens = set(re.findall(r"[a-z0-9]+", candidate.casefold())) - {
            "the",
            "surfboard",
            "board",
            "model",
            "custom",
            "pro",
            "tet",
            "tec",
        }
        title_tokens = set(re.findall(r"[a-z0-9]+", title.casefold()))
        if model_tokens and len(model_tokens & title_tokens) / len(model_tokens) >= 0.8:
            best = max(best, 75)
    return best


def image_of(product: dict) -> str | None:
    images = product.get("images") or []
    if images and images[0].get("src"):
        return images[0]["src"].split("?")[0]
    return None


def is_surfboard(product: dict) -> bool:
    title = product.get("title") or ""
    product_type = product.get("product_type") or ""
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    blob = f"{title} {product_type} {tags}"
    if re.search(r"accessories|apparel|clothing|fins?", product_type, re.I) and not BOARD.search(
        product_type
    ):
        return False
    if SOFT.search(title) and not BOARD.search(title):
        return False
    return bool(BOARD.search(blob))


def has_brand(slug: str, brand_name: str, title: str, vendor: str, tags: str, product_type: str) -> bool:
    blob = f"{title} {vendor} {tags} {product_type}".casefold()
    blob_n = norm(blob)
    for alias in BRAND_ALIASES.get(slug, []) + [brand_name]:
        alias = alias.strip()
        if len(norm(alias)) < 3:
            continue
        if norm(alias) in blob_n or alias.casefold() in blob:
            return True
    if slug == "machado-surfboards" and "firewire" in blob and any(
        token in blob for token in ("seaside", "cado", "sunday", "machado", "go fish", "spitfire", "dogfish")
    ):
        return True
    return False


def og_image(html: str, base: str) -> str | None:
    match = re.search(r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)', html, re.I)
    if not match:
        match = re.search(r'content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', html, re.I)
    if not match:
        return None
    src = match.group(1)
    if src.startswith("//"):
        return f"https:{src}"
    if src.startswith("http"):
        return src
    return f"{base.rstrip('/')}/{src.lstrip('/')}"


def main() -> None:
    zero = json.loads(ZERO_PATH.read_text())
    print("Loading retailer catalogs...")
    pool: list[dict] = []
    for base in RETAILERS:
        products = shopify_all(base)
        print(f"  {base}: {len(products)}")
        pool.extend(products)
    print(f"pool size {len(pool)}")

    updated: dict[str, dict] = {}
    for brand in zero:
        slug = brand["slug"]
        brand_name = brand["name"]
        models_out = []
        for model in brand["models"]:
            aliases = MODEL_ALIASES.get((slug, model["name"]), [])
            best = None
            best_score = 0
            best_title = None
            for product in pool:
                if not is_surfboard(product):
                    continue
                title = product.get("title") or ""
                vendor = product.get("vendor") or ""
                tags = product.get("tags") or ""
                if isinstance(tags, list):
                    tags = " ".join(tags)
                product_type = product.get("product_type") or ""
                if not has_brand(slug, brand_name, title, vendor, tags, product_type):
                    continue
                sc = score(model["name"], title, aliases)
                if sc > best_score:
                    image = image_of(product)
                    if image:
                        best_score = sc
                        best = image
                        best_title = title
            entry = {**model, "image_url": None}
            if best and best_score >= 75:
                entry["image_url"] = best
                entry["matched_title"] = best_title
                entry["score"] = best_score
                print(f"OK {slug}/{model['name']} <- {(best_title or '')[:70]} ({best_score})")
            models_out.append(entry)
        updated[slug] = {"slug": slug, "name": brand_name, "models": models_out}

    for (slug, model_name), url in HTML_PAGES.items():
        brand = updated.get(slug)
        if not brand:
            continue
        model = next((m for m in brand["models"] if m["name"] == model_name), None)
        if not model or model.get("image_url"):
            continue
        try:
            html, final = fetch_html(url)
            image = og_image(html, final)
        except Exception as exc:
            print(f"HTML fail {slug}/{model_name}: {type(exc).__name__}")
            continue
        if not image:
            continue
        model["image_url"] = image
        model["matched_title"] = f"html:{url}"
        model["score"] = 95
        print(f"OK {slug}/{model_name} <- html ({url})")

    with_images = sum(
        1 for brand in updated.values() for model in brand["models"] if model.get("image_url")
    )
    total = sum(len(brand["models"]) for brand in updated.values())
    print(f"TOTAL {with_images}/{total}")

    OUT_TMP.write_text(json.dumps({"brands": list(updated.values())}, indent=2) + "\n")
    payload = {
        "purpose": "Strict image backfill for curated core-shaper models (surfboards only)",
        "brands": [
            {
                "slug": brand["slug"],
                "models": [
                    {
                        "id": model["id"],
                        "name": model["name"],
                        "image_url": model["image_url"],
                    }
                    for model in brand["models"]
                    if model.get("image_url")
                ],
            }
            for brand in updated.values()
            if any(model.get("image_url") for model in brand["models"])
        ],
    }
    OUT_SEED.parent.mkdir(parents=True, exist_ok=True)
    OUT_SEED.write_text(json.dumps(payload, indent=2) + "\n")
    print("brands with any images", len(payload["brands"]))
    print("models with images", sum(len(brand["models"]) for brand in payload["brands"]))
    print("wrote", OUT_SEED)


if __name__ == "__main__":
    main()
