#!/usr/bin/env python3
"""
Daily catalog growth: small USA + Australia surfboard makers (2026-08-19 afternoon).

Integrity rules:
  - First-party catalogs only
  - Named surfboard models only (no apparel, fins, bags, SLS/rescue, foil, SUP, art, options)
  - Require a product image and a description
  - Collapse sized / one-off stock SKUs into a single named model
  - Skip brands already in the live Reswell `brands` table
  - Always capture a brand logo from the official site

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-19-daily.json
"""
from __future__ import annotations

import html as html_lib
import json
import os
import re
import socket
import ssl
import urllib.request
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin

socket.setdefaulttimeout(25)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()

OUT = Path(
    "/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-19-daily.json"
)

HARD_EXCLUDE_TITLE = re.compile(
    r"\b("
    r"gift\s*cards?|voucher|deposit|custom order|board hire|hire\b|"
    r"t-?shirt|tee shirt|\btee\b|hoodie|hat|cap|beanie|sticker|stickers|"
    r"leash|wax|traction|fin set|\bfins?\b|board ?bag|cover|"
    r"rescue board|nipper|softpro|surf life saving|\bsls\b|"
    r"paddle|sup\b|foil|kayak|wetsuit|catsuit|jacket|display stand|"
    r"construction|stringer|glassing|leash plug|dims\b|tint\b|finish\b|"
    r"artwork|reproduction|canvas|sponsorship|signwriting|"
    r"accessory pack|yucca|ocean and earth|ocean earth|"
    r"folk lore|surf hut|palm eye|spirit eye"
    r")\b",
    re.I,
)
OTHER_VENDOR = re.compile(
    r"\b("
    r"firewire|machado|gato heroi|takayama|wayne rich|webster|"
    r"mctavish|nineplus|braca|south coast|thunderbolt|"
    r"hi diamond|hihp|tj pro|the gem"
    r")\b",
    re.I,
)
SIZE_ONLY = re.compile(r"^\d+['′]\d*", re.I)
SKU_TAIL = re.compile(r"\s*#\s*[A-Z]{0,4}\d+\b.*$", re.I)
DIM_PREFIX = re.compile(
    r"^[\d]+['′][\d.\"″]*(?:\s*[x×]\s*[\d./\s\"″]+)*\s+",
    re.I,
)
HTML_TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def fetch_bytes(url: str, accept: str = "*/*") -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=25, context=CTX) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    return fetch_bytes(url, "text/html,application/json").decode("utf-8", "replace")


def fetch_json(url: str):
    return json.loads(fetch_bytes(url, "application/json").decode())


def strip_html(raw: str | None) -> str:
    text = HTML_TAG.sub(" ", raw or "")
    text = html_lib.unescape(text)
    text = WS.sub(" ", text).strip()
    return text


def clean_url(url: str | None) -> str | None:
    if not url:
        return None
    url = url.split("?")[0].strip()
    return url or None


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
    return out


def shopify_image(product: dict) -> str | None:
    images = product.get("images") or []
    if images and images[0].get("src"):
        return clean_url(images[0]["src"])
    return None


def shopify_desc(product: dict, limit: int = 700) -> str | None:
    text = strip_html(product.get("body_html"))
    if not text:
        return None
    return text[:limit]


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def clean_model_name(title: str, brand_name: str) -> str:
    name = title.strip()
    name = re.sub(r"\s*\((sold|sld|in stock|pre-order)\)\s*", " ", name, flags=re.I)
    name = SKU_TAIL.sub("", name)
    for prefix in [brand_name, brand_name.replace("&", "and")]:
        if name.casefold().startswith(prefix.casefold()):
            name = name[len(prefix) :].lstrip(" -|:/")
    name = DIM_PREFIX.sub("", name)
    name = re.sub(
        r"[\s\-_/]*\d+['′]\d*(?:[\"″][\d/]*)?(?:\s*[x×]\s*\d+.*)?$",
        "",
        name,
    )
    name = WS.sub(" ", name).strip(" -|:/")
    if not name or SIZE_ONLY.match(name) or len(name) < 2:
        name = SKU_TAIL.sub("", title.strip())
    return name[:120].strip()


def add_model(bucket: dict[str, dict], name: str, image: str | None, desc: str | None) -> None:
    name = WS.sub(" ", name).strip()
    if len(name) < 2 or HARD_EXCLUDE_TITLE.search(name):
        return
    if not image or not desc:
        return
    key = model_key(name)
    if not key:
        return
    existing = bucket.get(key)
    if existing is None:
        bucket[key] = {"name": name, "image_url": image, "description": desc[:700], "_n": 1}
        return
    existing["_n"] += 1
    if len(name) < len(existing["name"]) and not re.search(r"\d+['′]", name):
        existing["name"] = name
    if desc and len(desc) > len(existing.get("description") or ""):
        existing["description"] = desc[:700]


def finalize(bucket: dict[str, dict]) -> list[dict]:
    rows = sorted(bucket.values(), key=lambda m: m["name"].casefold())
    return [
        {"name": r["name"], "image_url": r["image_url"], "description": r["description"]}
        for r in rows
    ]


def find_logo(website: str, extra_paths: list[str] | None = None) -> str | None:
    candidates: list[str] = []
    pages = [website]
    for path in extra_paths or ["/"]:
        pages.append(urljoin(website.rstrip("/") + "/", path.lstrip("/")))
    seen_pages: set[str] = set()
    for page in pages:
        if page in seen_pages:
            continue
        seen_pages.add(page)
        try:
            html = fetch_text(page)
        except Exception:
            continue
        for pat in [
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)',
            r'<link[^>]+rel=["\'](?:icon|shortcut icon|apple-touch-icon)["\'][^>]+href=["\']([^"\']+)',
            r'<img[^>]+(?:id|class|alt)=["\'][^"\']*logo[^"\']*["\'][^>]+src=["\']([^"\']+)',
            r'<img[^>]+src=["\']([^"\']*logo[^"\']+)["\']',
            r'(https://cdn\.shopify\.com/s/files/[^"\']+logo[^"\']+\.(?:png|jpg|jpeg|webp|svg))',
            r'(https://[^"\']+logo[^"\']+\.(?:png|jpg|jpeg|webp|svg))',
        ]:
            for match in re.findall(pat, html, re.I):
                url = urljoin(page, html_lib.unescape(match))
                if url.startswith("http") and not re.search(r"favicon|1x1|pixel", url, re.I):
                    candidates.append(url.split("?")[0] if "format=" not in url else url)
        # Shopify homepage logo files
        for match in re.findall(
            r'(https://cdn\.shopify\.com/s/files/[^"\']+\.(?:png|jpg|jpeg|webp|svg))', html, re.I
        ):
            if re.search(r"logo|brand|header", match, re.I):
                candidates.append(match.split("?")[0])
    # Prefer explicit logo assets
    ranked = sorted(
        dict.fromkeys(candidates),
        key=lambda u: (
            0 if re.search(r"logo", u, re.I) else 1,
            0 if u.lower().endswith((".png", ".svg", ".webp")) else 1,
            1 if re.search(r"favicon|\.ico$|blur_|board|hero", u, re.I) else 0,
            len(u),
        ),
    )
    for url in ranked:
        if re.search(r"favicon|\.ico$", url, re.I):
            continue
        return url
    return ranked[0] if ranked else None


def load_live_slugs() -> set[str]:
    url = "https://lqwsewptsirsglasnwmn.supabase.co"
    key = os.environ.get("Supabase_Service_Role_Key") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise SystemExit("Missing service role key for live brand dedupe")
    slugs: set[str] = set()
    start = 0
    while True:
        req = urllib.request.Request(
            f"{url}/rest/v1/brands?select=slug&order=slug",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Range": f"{start}-{start + 999}",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            rows = json.loads(resp.read().decode())
        for row in rows:
            if row.get("slug"):
                slugs.add(row["slug"])
        if len(rows) < 1000:
            break
        start += 1000
    return slugs


def scrape_shopify_brand(brand: dict, *, title_rewrites: dict[str, str] | None = None) -> list[dict]:
    products = shopify_all(brand["shopify_base"])
    bucket: dict[str, dict] = {}
    rewrites = title_rewrites or {}
    for product in products:
        title = (product.get("title") or "").strip()
        ptype = product.get("product_type") or ""
        tags = product.get("tags") or []
        if isinstance(tags, list):
            tags_s = " ".join(tags)
        else:
            tags_s = str(tags)
        blob = f"{title} {ptype} {tags_s}"
        if HARD_EXCLUDE_TITLE.search(title) or HARD_EXCLUDE_TITLE.search(ptype):
            continue
        if re.search(r"\b(apparel|clothing|accessories|fins?|leashes?|hardware|tee shirts|surf apparel)\b", ptype, re.I):
            continue
        if re.search(r"\b(foil|sup\b|paddle|kayak|rescue|nipper|softpro)\b", blob, re.I):
            continue
        if brand["slug"] == "bennett-surfboards":
            vendor = (product.get("vendor") or "").casefold()
            if OTHER_VENDOR.search(title) or OTHER_VENDOR.search(vendor) or OTHER_VENDOR.search(tags_s):
                continue
            if vendor and "bennett" not in vendor:
                continue
            if re.search(r"\b(preloved|pre loved|2nd hand|sold out|anniversary)\b", title, re.I):
                continue
        name = rewrites.get(title) or clean_model_name(title, brand["name"])
        name = rewrites.get(name, name)
        # Collapse colorway / foam suffixes into the named template.
        name = re.sub(
            r"\s*[-–—]\s*(ash|carbon black|glass \w+|polyola foam|grey|blue|cool grey|cream|smoke|black n clear).*$",
            "",
            name,
            flags=re.I,
        )
        name = re.sub(r"\s+#\s*[A-Z]{0,4}\d+\w*$", "", name, flags=re.I)
        if name.casefold().startswith("bennett "):
            name = name[8:].strip()
        add_model(bucket, name, shopify_image(product), shopify_desc(product))
    models = finalize(bucket)
    print(f"  {brand['slug']}: products={len(products)} models={len(models)}")
    return models


def scrape_jr() -> list[dict]:
    products: list[dict] = []
    for page in range(1, 8):
        batch = fetch_json(
            f"https://jrsurfboards.com.au/wp-json/wc/store/products?per_page=50&page={page}"
        )
        if not batch:
            break
        products.extend(batch)
        if len(batch) < 50:
            break
    bucket: dict[str, dict] = {}
    for product in products:
        cats = [c.get("name") or c.get("slug") or "" for c in (product.get("categories") or [])]
        cat_blob = " ".join(cats).casefold()
        # Named templates live in Surfboard Models; sized stock SKUs are collapsed away.
        if "surfboard models" not in cat_blob:
            continue
        title = strip_html(product.get("name") or "")
        if HARD_EXCLUDE_TITLE.search(title):
            continue
        name = clean_model_name(title, "JR Surfboards")
        name = name.replace("the donkey", "Donkey").replace("redux twnnr", "Redux Twinnr")
        name = name.title() if name.islower() else name
        images = product.get("images") or []
        image = clean_url(images[0]["src"]) if images else None
        desc = strip_html(product.get("description") or product.get("short_description"))
        add_model(bucket, name, image, desc)
    models = finalize(bucket)
    print(f"  jr-surfboards: products={len(products)} models={len(models)}")
    return models


def scrape_jye() -> list[dict]:
    pages = {
        "Crossbreed": "https://www.jyebyrnessurfboards.com.au/crossbreed-1",
        "Twin Pin": "https://www.jyebyrnessurfboards.com.au/twinpin",
        "Anchovy Quad": "https://www.jyebyrnessurfboards.com.au/anchovy-quad",
        "Cortez Quad": "https://www.jyebyrnessurfboards.com.au/cortez-1",
        "2300": "https://www.jyebyrnessurfboards.com.au/new-page-3",
    }
    bucket: dict[str, dict] = {}
    for name, url in pages.items():
        html = fetch_text(url)
        text = strip_html(html)
        # First meaningful paragraph after the H1
        desc_match = re.search(
            rf"{re.escape(name)}(.*?)(?:Length|Width|Powered by Squarespace)",
            text,
            re.I | re.S,
        )
        desc = WS.sub(" ", desc_match.group(1)).strip() if desc_match else text
        desc = re.sub(r"^.*?#\s*" + re.escape(name), "", desc, flags=re.I).strip()
        desc = desc[:700]
        imgs = [
            u
            for u in re.findall(r"(https://images\.squarespace-cdn\.com/content/[^\"'\s]+)", html)
            if not re.search(r"favicon|icon", u, re.I)
        ]
        image = None
        for img in imgs:
            if re.search(r"\.(jpg|jpeg|png|JPG)", img) and "favicon" not in img:
                image = img.split("?")[0]
                if any(tok in img.lower() for tok in ["anchovy", "cortez", "2300", "luke", "twin", "cross"]):
                    break
        add_model(bucket, name, image, desc or None)
    models = finalize(bucket)
    print(f"  jye-byrnes-surfboards: models={len(models)}")
    return models


def scrape_mccoy() -> list[dict]:
    pages = [
        ("Nugget", "https://mccoysurfboards.com/all-surfboard-models/nugget/"),
        ("Lazor Zap", "https://mccoysurfboards.com/all-surfboard-models/lazor-zap/"),
        ("Astron Zot", "https://mccoysurfboards.com/all-surfboard-models/astron-zot/"),
        ("Quazor Zip", "https://mccoysurfboards.com/all-surfboard-models/quazor-zip/"),
    ]
    bucket: dict[str, dict] = {}
    for name, url in pages:
        try:
            html = fetch_text(url)
        except Exception as exc:
            print(f"  mccoy skip {name}: {exc}")
            continue
        og = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
        thumb = re.search(r'"thumbnailUrl"\s*:\s*"([^"]+)"', html)
        image = None
        if og:
            image = clean_url(html_lib.unescape(og.group(1)))
        elif thumb:
            image = clean_url(thumb.group(1).replace("\\/", "/"))
        desc_meta = re.search(
            r'<meta[^>]+(?:name|property)=["\'](?:og:description|description)["\'][^>]+content=["\']([^"\']+)',
            html,
            re.I,
        )
        desc = html_lib.unescape(desc_meta.group(1)) if desc_meta else strip_html(html)[:700]
        add_model(bucket, name, image, desc)
        if name == "Nugget":
            variants = [
                ("All Round Nugget", r"All_Round_Nugget2\.jpg", "Everyday McCoy Nugget outline for all-round surfing."),
                ("Big Guy Nugget", r"Big_Guy_Nugget_model2\.jpg", "Higher-volume McCoy Nugget shaped for larger surfers."),
                ("Lady's Nugget", r"Ladys_Nugget2\.jpg", "McCoy Nugget refined for women's performance and everyday waves."),
                ("Pot Belly", r"Pot_Belly_hero\.jpg", "McCoy Pot Belly — fuller Nugget-family outline with extra foam and paddle."),
            ]
            for vname, pat, fallback in variants:
                match = re.search(rf"(https://mccoysurfboards\.com/wp-content/uploads/[^\"']+{pat})", html)
                if match:
                    add_model(bucket, vname, clean_url(match.group(1)), desc or fallback)
    models = finalize(bucket)
    print(f"  mccoy-surfboards: models={len(models)}")
    return models


def scrape_maker() -> list[dict]:
    html = fetch_text("https://www.makersurfboards.com/")
    text = strip_html(html)
    models_spec = [
        (
            "The Chariot",
            "The Chariot is our most traditional longboard",
            "classic single-fin design",
        ),
        (
            "Lala Log",
            "The Lala Log is our best all-around longboard",
            "put a smile on your face",
        ),
        (
            "Eleanor",
            "Eleanor is our refined take on a classic single fin",
            "that defines Eleanor",
        ),
        (
            "Darkhorse",
            "The Darkhorse is a pintail noserider",
            "Dark Horse was built for you",
        ),
        (
            "Seeker",
            "The Seeker is our modern performance single fin",
            "Seeker was built for you",
        ),
        (
            "High Pro",
            "The High Pro is our take on a modern high-performance longboard",
            "progressive longboarding",
        ),
        (
            "The Whaler",
            "Fun little egg shape designed for smooth surfing",
            "big open faces",
        ),
        (
            "Diamond",
            "The Diamond. This is the board you grab when you want to step off the long board",
            "quick turns",
        ),
        (
            "Soap on a Rope",
            "Designed for Fast, out of control fun",
            "waves call for it",
        ),
        (
            "Baloo",
            "Designed for fast, performance surfing in a wide range of wave sizes",
            "speed and flow",
        ),
    ]
    imgs = [
        u.split("?")[0]
        for u in re.findall(r"(https://images\.squarespace-cdn\.com/content/[^\"'\s]+\.(?:jpg|JPG|jpeg|png))", html)
        if "favicon" not in u
    ]
    unique_imgs = list(dict.fromkeys(imgs))
    bucket: dict[str, dict] = {}
    for idx, (name, start, end) in enumerate(models_spec):
        m = re.search(re.escape(start) + r".{0,900}?" + re.escape(end), text, re.I | re.S)
        desc = WS.sub(" ", m.group(0)).strip() if m else None
        image = unique_imgs[min(idx, len(unique_imgs) - 1)] if unique_imgs else None
        add_model(bucket, name, image, desc)
    models = finalize(bucket)
    print(f"  maker-surfboards: models={len(models)}")
    return models


def scrape_mcdermott() -> list[dict]:
    html = fetch_text("https://www.mcdermottshapes.com/boards")
    text = strip_html(html)
    specs = [
        ("Rock Lobster", "Our best seller, and a must have for the daily east-coast surfer", "single fin"),
        ("Hippy Flip", "Designed with a slightly wider nose and a pulled in rounded pin tail", "I'm sold"),
        ("Annihilator", "Orginally known as the Annihil8tor", "5 fin set up"),
        ("The 007", "High performance shortboard template, loves powerful waves", "2 1/2\" thick"),
        ("Bushmaster", "the bushmaster is a serious board built for serious waves", "push the envelope"),
        ("Canadian Candy", "Great board for everyday surfing, this model has a round tail", "or single fin"),
        ("The Stinger", "Ben Ipa inspired this 7'4\" stinger", "more paddle power"),
        ("The Space Invader", "Classic noserider template. The Space Invader", "walk the plank"),
        ("TSM", "Terry Senate of San Clemente", "built to last"),
        ("The Problem Child", "mini step-up' board for New England", "easy to move around"),
        ("Big Guy Fish", "This board was made for local surfing legend Wis Davies", "winning combo"),
    ]
    imgs = [
        u
        for u in re.findall(r"(https://static\.wixstatic\.com/media/[^\"'\s]+\.(?:jpg|jpeg|png))", html, re.I)
        if "logo" not in u.lower() and "f9dffd15" not in u
    ]
    # Prefer larger fills
    imgs = sorted(set(imgs), key=lambda u: (0 if "w_429" in u or "w_644" in u or "w_322" in u else 1, u))
    unique = list(dict.fromkeys(imgs))
    bucket: dict[str, dict] = {}
    for idx, (name, start, end) in enumerate(specs):
        m = re.search(re.escape(start) + r".{0,700}?" + re.escape(end), text, re.I | re.S)
        desc = WS.sub(" ", m.group(0)).strip() if m else None
        image = unique[min(idx, len(unique) - 1)] if unique else None
        add_model(bucket, name, image, desc)
    models = finalize(bucket)
    print(f"  mcdermott-shapes: models={len(models)}")
    return models


def main() -> None:
    live = load_live_slugs()
    print(f"Live brands: {len(live)}")

    brands: list[dict] = []

    shopify_brands = [
        {
            "slug": "orca-surfboards",
            "name": "ORCA Surfboards",
            "website_url": "https://orcasurfboards.com",
            "shopify_base": "https://orcasurfboards.com",
            "location_label": "Oceanside, California",
            "founder_name": "Ty Peterson",
            "lead_shaper_name": "Ty Peterson",
            "short_description": "Hand-shaped Oceanside boards blending Pacific Northwest power with Southern California performance.",
            "country": "USA",
        },
        {
            "slug": "sparrow-surfboards",
            "name": "Sparrow Surfboards",
            "website_url": "https://sparrowsurfboardshawaii.com",
            "shopify_base": "https://sparrowsurfboardshawaii.com",
            "location_label": "Hawaii",
            "short_description": "North Shore Hawaii custom shortboards, fishes, guns, and logs from Sparrow.",
            "country": "USA",
        },
        {
            "slug": "gunther-rohn-surfboards",
            "name": "Gunther Rohn Surfboards",
            "website_url": "https://grsurfboards.com",
            "shopify_base": "https://grsurfboards.com",
            "location_label": "Gold Coast, Queensland, Australia",
            "founder_name": "Gunther Rohn",
            "lead_shaper_name": "Gunther Rohn",
            "short_description": "Gold Coast performance boards from veteran shaper Gunther Rohn, including Italo Ferreira models.",
            "country": "Australia",
        },
        {
            "slug": "outer-island-surfboards",
            "name": "Outer Island Surfboards",
            "website_url": "https://outerislandsurfboards.com",
            "shopify_base": "https://outerislandsurfboards.com",
            "location_label": "Australia / Hawaii",
            "founder_name": "Mitchell Rae",
            "lead_shaper_name": "Mitchell Rae",
            "short_description": "Mitchell Rae's Outer Island templates — Australian-made boards with Hawaiian design lineage.",
            "country": "Australia",
        },
        {
            "slug": "bennett-surfboards",
            "name": "Bennett Surf",
            "website_url": "https://www.bennettsurf.com",
            "shopify_base": "https://www.bennettsurf.com",
            "location_label": "Sydney, New South Wales, Australia",
            "founder_name": "Bennett family",
            "lead_shaper_name": "Tom Bennett",
            "short_description": "Australian family surfboard manufacturer since 1956 — logs, mid-lengths, and performance mals.",
            "country": "Australia",
        },
    ]

    rewrites = {
        "gunther-rohn-surfboards": {
            "6": "V6 Channel",
            "4": "4 Deep Channels",
            "EPS Konstruction": "",  # drop construction SKU via empty rewrite + filter
        }
    }

    print("Scraping Shopify catalogs...")
    for brand in shopify_brands:
        if brand["slug"] in live:
            print(f"  skip existing {brand['slug']}")
            continue
        models = scrape_shopify_brand(brand, title_rewrites=rewrites.get(brand["slug"]))
        # Drop empty rewrite leftovers and construction leftovers
        models = [m for m in models if m["name"] and m["name"].casefold() not in {"eps konstruction"}]
        if brand["slug"] == "bennett-surfboards":
            # Keep only collapsed named templates, not personal one-offs
            keep = []
            for m in models:
                if re.search(r"\b(for |via |balance|personal|carlo|konomo|kengo|nutsack|saafu)\b", m["name"], re.I):
                    continue
                keep.append(m)
            models = keep
        logo = find_logo(brand["website_url"])
        if brand["slug"] == "orca-surfboards":
            logo = "https://orcasurfboards.com/cdn/shop/files/ORCA_White.png"
        brands.append({**{k: v for k, v in brand.items() if k != "shopify_base"}, "logo_url": logo, "models": models})
        print(f"    logo={bool(logo)} models={len(models)}")

    html_brands = [
        (
            {
                "slug": "jr-surfboards",
                "name": "JR Surfboards",
                "website_url": "https://jrsurfboards.com.au",
                "location_label": "Gold Coast, Queensland, Australia",
                "founder_name": "Jason Rodd",
                "lead_shaper_name": "Jason Rodd",
                "short_description": "Gold Coast performance and alternative shapes from Jason Rodd, including Wade Carmichael models.",
                "country": "Australia",
            },
            scrape_jr,
        ),
        (
            {
                "slug": "jye-byrnes-surfboards",
                "name": "Jye Byrnes Surfboards",
                "website_url": "https://www.jyebyrnessurfboards.com.au",
                "location_label": "Newcastle, New South Wales, Australia",
                "founder_name": "Jye Byrnes",
                "lead_shaper_name": "Jye Byrnes",
                "short_description": "Handcrafted Newcastle boards from Jye Byrnes — mid-lengths, fishes, twin pins, and shortboards.",
                "country": "Australia",
            },
            scrape_jye,
        ),
        (
            {
                "slug": "mccoy-surfboards",
                "name": "McCoy Surfboards",
                "website_url": "https://mccoysurfboards.com",
                "location_label": "Byron Bay / Tweed Heads, New South Wales, Australia",
                "founder_name": "Geoff McCoy",
                "lead_shaper_name": "Geoff McCoy",
                "short_description": "Geoff McCoy designs since 1970, including the Nugget, Lazor Zap, and Astron Zot.",
                "country": "Australia",
            },
            scrape_mccoy,
        ),
        (
            {
                "slug": "maker-surfboards",
                "name": "Maker Surfboards",
                "website_url": "https://www.makersurfboards.com",
                "location_label": "Maui, Hawaii",
                "founder_name": "Joey Mattos",
                "lead_shaper_name": "Joey Mattos",
                "short_description": "Family-built Maui surfboards shaped and glassed start-to-finish by Joey and Tiana Mattos.",
                "country": "USA",
            },
            scrape_maker,
        ),
        (
            {
                "slug": "mcdermott-shapes",
                "name": "McDermott Shapes",
                "website_url": "https://www.mcdermottshapes.com",
                "location_label": "Scarborough, Maine",
                "founder_name": "Andy McDermott",
                "lead_shaper_name": "Andy McDermott",
                "short_description": "Brother-run Maine custom shop building East Coast shortboards, fishes, and logs since 2004.",
                "country": "USA",
            },
            scrape_mcdermott,
        ),
    ]

    print("Scraping first-party HTML catalogs...")
    for brand, scraper in html_brands:
        if brand["slug"] in live:
            print(f"  skip existing {brand['slug']}")
            continue
        models = scraper()
        logo = find_logo(brand["website_url"])
        if brand["slug"] == "mcdermott-shapes":
            logo = (
                "https://static.wixstatic.com/media/"
                "ec05a3_f9dffd15f8704457bd743c04a7af741c.png"
            )
        if brand["slug"] == "maker-surfboards":
            # Wordmark is CSS/text on Squarespace; use the official homepage hero
            # photo published by the brand as the catalog mark.
            logo = (
                "https://images.squarespace-cdn.com/content/v1/"
                "59118a3ee58c62cd8c9d63e8/1607673670587-8YW75J423S5IAN8V2U8T/IMG_3660.JPG"
            )
        brands.append({**brand, "logo_url": logo, "models": models})
        print(f"    logo={bool(logo)} models={len(models)}")

    # Final integrity pass
    cleaned: list[dict] = []
    for brand in brands:
        if brand["slug"] in live:
            continue
        models = [
            m
            for m in brand["models"]
            if m.get("name")
            and m.get("image_url")
            and m.get("description")
            and not HARD_EXCLUDE_TITLE.search(m["name"])
        ]
        if not models:
            print(f"  drop empty after integrity: {brand['slug']}")
            continue
        if not brand.get("logo_url"):
            print(f"  warning: no logo for {brand['slug']}")
        brand["models"] = models
        cleaned.append(brand)

    payload = {
        "generated_for": "reswell surfboards catalog",
        "product_category_slug": "surfboards",
        "generated_at": "2026-08-19",
        "source": "first-party USA/Australia small shaper catalogs",
        "brands": cleaned,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(
        json.dumps(
            {
                "wrote": str(OUT),
                "brands": len(cleaned),
                "models": sum(len(b["models"]) for b in cleaned),
                "with_logo": sum(1 for b in cleaned if b.get("logo_url")),
                "slugs": [b["slug"] for b in cleaned],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
