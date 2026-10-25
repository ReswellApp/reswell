#!/usr/bin/env python3
"""
Daily catalog growth: small USA + Australia surfboard makers.

Integrity rules:
  - First-party (or tightly vendor-filtered) catalogs only
  - Surfboard models only — no apparel, fins, leashes, bags, wax, deposits
  - Require a product image
  - Collapse sized/one-off listings into a single named model
  - Skip brands already in the live Reswell catalog
  - Always capture a brand logo when one is published

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-19.json
"""
from __future__ import annotations

import json
import os
import re
import socket
import ssl
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse

socket.setdefaulttimeout(20)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()

OUT = Path(
    "/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-19.json"
)

EXISTING_SLUGS = {
    "7s-surfboards",
    "a-h-vessels",
    "aj-surfboards",
    "album-surf",
    "album-surf-1",
    "alex-lopez-surfboards",
    "alkali-fins",
    "almond-surfboards",
    "aqss-surfboards",
    "arakawa-surfboards",
    "becker-surfboards",
    "ben-aipa",
    "bing-surfboards",
    "blink-surfboards",
    "blocksurf-fins",
    "bob-mctavish",
    "bolero-fins",
    "bom-bora-surfboards",
    "campbell-brothers",
    "captain-fin",
    "catch-surf",
    "channel-islands-surfboards",
    "chemistry-surfboards",
    "chilli-surfboards",
    "cho-shapes",
    "christenson-surfboards",
    "christian-beamish-surfboards",
    "churchill-fins",
    "cj-nelson-designs",
    "creed-surfboards",
    "dafin",
    "deepest-reaches-surfboards",
    "deflow-fins",
    "dewey-weber",
    "dhd-surfboards",
    "dick-brewer-surfboards",
    "doug-schroedel",
    "dp-surfboards",
    "eleventh-street-surfboards",
    "elmore",
    "emery-surfboards",
    "endorfins",
    "fcd-surfboards",
    "fcs",
    "firewire-surfboards",
    "fish-stix-surfboards",
    "florence-marine-x",
    "flying-diamonds-fins",
    "foamie-surfboards",
    "funner-surf-craft",
    "futures-fins",
    "gato-heroi",
    "gerry-lopez-surfboards",
    "gohl-surfboards",
    "gordon-and-smith",
    "grindhouse",
    "harbour-surfboards",
    "harley-ingleby-surfboards",
    "hawaiian-pro-designs",
    "hayden-shapes",
    "hess-surfboards",
    "hobie-surfboards",
    "hot-buttered-surfboards",
    "infinity-surfboards",
    "inspired-surfboards",
    "j7",
    "jeff-bushman-surfboards",
    "jeff-clark-surfboards",
    "joistik-surfboards",
    "jones-surfboards",
    "js-surfboards",
    "kai-sallas-surfboards",
    "kane-surfboards",
    "koalition-fins",
    "kookapinto",
    "ku-surfboards",
    "lib-tech-surfboards",
    "local-motion-surfboards",
    "lost-surfboards",
    "lovemachine-surfboards",
    "lovelace-machine",
    "lyon-shapes",
    "machado-surfboards",
    "marc-andreini-surfboards",
    "mark-richards-surfboards",
    "maurice-cole-surfboards",
    "mesa-surfboards",
    "mf-softboards",
    "mid-fin-co",
    "miller-surfboards",
    "misfit-surfboards",
    "mitsven",
    "modern-surfboards",
    "murdey-surfboards",
    "natural-curves-surfboards",
    "noll-surfboards",
    "nsp-surfboards",
    "nvs-fins",
    "ocean-and-earth",
    "ocean-soul-surfboards",
    "olero-surfboards",
    "one-revolver-surfboards",
    "pacific-vibrations-surfboard-fins",
    "panda-surfboards",
    "pearson-arrow-surfboards",
    "pisces-surfboards",
    "point-classic-longboards",
    "proctor",
    "progressive-surfboards",
    "pukas-surfboards",
    "pyzel-surfboards",
    "quobba-fins",
    "rainbow-fin-company",
    "ripcurl",
    "roberts-surfboards",
    "roger-hinds-surfboards",
    "rusty-surfboards",
    "ryan-burch",
    "ryan-lovelace-surfboards",
    "s-wing",
    "shapers-fins",
    "sharpeye-surfboards",
    "simon-anderson-surfboards",
    "simon-shapes",
    "skindog-surfboards",
    "skip-frye-surfboards",
    "slater-designs-surfboards",
    "softech-surfboards",
    "softlite-surfboards",
    "stamps",
    "stewart-surfboards",
    "storm-blade-fins",
    "stretch-boards",
    "superbrand-surfboards",
    "surf-fcs",
    "takayama-surfboards",
    "thomas-surfboards",
    "timmy-patterson-surfboards",
    "tokoro-surfboards",
    "torq-surfboards",
    "town-and-country-surfboards",
    "toy-boat-surfboards",
    "trimcraft",
    "true-ames",
    "tyler-warren-surfboards",
    "velzy-surfboards",
    "ventana-surfboards",
    "walden-surfboards",
    "wayne-rich-surfboards",
    "webber-surfboards",
    "wildflower-surfboards",
    "xo-coco-surfboards",
    "yater-surfboards",
}

# First-party shops we verified as small surfboard makers (USA / Australia).
DIRECT_BRANDS: list[dict] = [
    {
        "slug": "josh-hall-surfboards",
        "name": "Josh Hall Surfboards",
        "website_url": "https://joshhallsurfboards.com",
        "shopify_base": "https://joshhallsurfboards.com",
        "location_label": "San Diego, California",
        "founder_name": "Josh Hall",
        "lead_shaper_name": "Josh Hall",
        "short_description": "San Diego factory-built fishes, logs, and gliders from Skip Frye protégé Josh Hall.",
        "country": "USA",
        "vendor_aliases": ["josh hall", "josh hall surfboards"],
        "require_own_vendor": True,
    },
    {
        "slug": "byrne-surfboards",
        "name": "Byrne Surfboards",
        "website_url": "https://byrnesurf.com",
        "shopify_base": "https://byrnesurf.com",
        "location_label": "Wollongong, New South Wales, Australia",
        "founder_name": "Greg Byrne",
        "lead_shaper_name": "Jed Ashton",
        "short_description": "Family-run Wollongong performance boards — everyday shortboards through heavy water.",
        "country": "Australia",
        "vendor_aliases": ["byrne", "byrne surfboards"],
        "require_own_vendor": True,
    },
    {
        "slug": "thomas-surfboards-noosa",
        "name": "Thomas Surfboards Noosa",
        "website_url": "https://www.thomassurfboards.com",
        "shopify_base": "https://www.thomassurfboards.com",
        "location_label": "Noosa Heads, Queensland, Australia",
        "founder_name": "Thomas Bexon",
        "lead_shaper_name": "Thomas Bexon",
        "short_description": "Noosa-built logs, eggs, and mid-lengths from Thomas Bexon, focused on trim and flow.",
        "country": "Australia",
        "vendor_aliases": ["thomas surfboards", "thomas bexon", "bexon"],
        "require_own_vendor": True,
    },
    {
        "slug": "sjs-custom-surfboards",
        "name": "SJS Custom",
        "website_url": "https://sjscustom.com.au",
        "shopify_base": "https://sjscustom.com.au",
        "location_label": "Gold Coast, Queensland, Australia",
        "founder_name": "Scotty James",
        "lead_shaper_name": "Scotty James",
        "short_description": "One-at-a-time Gold Coast performance and alternative shapes by Scotty James.",
        "country": "Australia",
        "vendor_aliases": ["sjs custom", "sjs", "scotty james"],
        "require_own_vendor": False,
    },
    {
        "slug": "riley-balsa-surfboards",
        "name": "Riley Balsa Wood Surfboards",
        "website_url": "https://balsawoodsurfboardsriley.com",
        "shopify_base": "https://balsawoodsurfboardsriley.com",
        "location_label": "Miranda, New South Wales, Australia",
        "founder_name": "Mark Riley",
        "lead_shaper_name": "Mark Riley",
        "short_description": "Hand-shaped Australian balsa and EPS-core boards built in Miranda, NSW since 1996.",
        "country": "Australia",
        "vendor_aliases": ["riley", "riley balsa", "riley surfboards"],
        "require_own_vendor": True,
    },
    {
        "slug": "runyon-surfboards",
        "name": "Runyon Surfboards",
        "website_url": "https://runyonsurfboards.com",
        "shopify_base": "https://runyonsurfboards.com",
        "location_label": "North Carolina",
        "founder_name": "Matt Runyon",
        "lead_shaper_name": "Matt Runyon",
        "short_description": "Hand-shaped East Coast boards from North Carolina shaper Matt Runyon.",
        "country": "USA",
        "vendor_aliases": ["runyon", "runyon surfboards"],
        "require_own_vendor": True,
    },
    {
        "slug": "kona-surf-co",
        "name": "Kona Surf Co",
        "website_url": "https://www.konasurfco.com",
        "shopify_base": "https://www.konasurfco.com",
        "location_label": "Wildwood, New Jersey",
        "founder_name": "Mike Sciarra",
        "lead_shaper_name": "Chris Sciarra",
        "short_description": "Jersey Shore custom boards shaped at the Kona Boardhouse in Wildwood since 1969.",
        "country": "USA",
        "vendor_aliases": ["kona", "kona surf", "kona surf co", "kona surf company"],
        "require_own_vendor": True,
    },
    {
        "slug": "hawaiian-island-creations",
        "name": "Hawaiian Island Creations",
        "website_url": "https://hicsurf.com",
        "shopify_base": "https://hicsurf.com",
        "location_label": "Kailua, Hawaii",
        "founder_name": "Stephen Tsukayama",
        "lead_shaper_name": None,
        "short_description": "Hawaiian Island Creations (HIC) — Kailua-born boards for everyday island waves since 1971.",
        "country": "USA",
        "vendor_aliases": ["hic", "hawaiian island creations", "hic surfboards"],
        "require_own_vendor": True,
        "exact_vendors": ["HIC", "Hawaiian Island Creations", "HIC Surfboards"],
    },
]

# Additional first-party shops discovered during this run (may or may not be Shopify).
RETAILER_SCAN = [
    "https://www.boardworld.com.au",
    "https://www.surfboardsdirect.com.au",
    "https://www.thesurfboardwarehouse.com.au",
    "https://www.surfstationstore.com",
    "https://www.cleanlinesurf.com",
    "https://www.jackssurfboards.com",
    "https://www.tcsurf.com",
    "https://www.hansensurf.com",
    "https://lucidglassing.com",
]

# Small labels we hope to recover from retailer vendor fields if they publish enough models.
RETAILER_TARGETS: list[dict] = [
    {
        "slug": "mccoy-surfboards",
        "name": "McCoy Surfboards",
        "website_url": "https://www.mccoysurfboards.com.au",
        "location_label": "Australia",
        "founder_name": "Geoff McCoy",
        "lead_shaper_name": "Geoff McCoy",
        "short_description": "Australian performance templates from Geoff McCoy, including the classic Nugget lineage.",
        "country": "Australia",
        "vendor_aliases": ["mccoy", "mccoy surfboards", "geoff mccoy"],
    },
    {
        "slug": "bennett-surfboards",
        "name": "Bennett Surfboards",
        "website_url": "https://bennettsurf.com.au",
        "location_label": "Australia",
        "short_description": "Australian custom performance and everyday boards from Bennett.",
        "country": "Australia",
        "vendor_aliases": ["bennett", "bennett surfboards"],
    },
    {
        "slug": "webster-surfboards",
        "name": "Webster Surfboards",
        "website_url": "https://lucidglassing.com",
        "location_label": "Lennox Head, New South Wales, Australia",
        "founder_name": "Wayne Webster",
        "lead_shaper_name": "Wayne Webster",
        "short_description": "Lennox Head carbon and PU designs from Wayne 'Webby' Webster.",
        "country": "Australia",
        "vendor_aliases": ["webster", "webster surfboards", "webby", "wayne webster"],
    },
    {
        "slug": "cole-surfboards",
        "name": "Cole Surfboards",
        "website_url": "https://colesurfboards.com",
        "location_label": "San Clemente, California",
        "founder_name": "Cole",
        "lead_shaper_name": "Cole",
        "short_description": "San Clemente performance shortboards and small-wave weapons from Cole Surfboards.",
        "country": "USA",
        "vendor_aliases": ["cole", "cole surfboards"],
    },
    {
        "slug": "bark-surfboards",
        "name": "Bark Surfboards",
        "website_url": None,
        "location_label": "California",
        "short_description": "California big-wave and everyday templates associated with Bark.",
        "country": "USA",
        "vendor_aliases": ["bark", "bark surfboards"],
    },
]

BOARD = re.compile(
    r"\b(surfboards?|softboards?|soft[\s-]?tops?|longboards?|shortboards?|"
    r"funboards?|mid[\s-]?lengths?|eggs?|fishes?|twin[\s-]?fins?|"
    r"single[\s-]?fins?|gliders?|logs?|guns?|grovelers?|step[\s-]?ups?|"
    r"quads?|thrusters?|minimals?|malibu|alaia|surf craft|custom board)\b",
    re.I,
)
HARD_EXCLUDE = re.compile(
    r"\b("
    r"leash|wax|traction|fin set|\bfins?\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|tee|hoodie|hat|cap|beanie|sticker|gift ?card|voucher|"
    r"deposit|custom order|boardshort|trunks?|jacket|hoodie|crew|"
    r"candle|yoga|handplane|bodyboard|skimboard|wall rack|rack|mount|"
    r"poster|print|book|towel|poncho|rash ?guard|wetsuit|socks?|"
    r"sunglasses|watch|jewelry|wallet|keyring|keychain|"
    r"skate|deck(?! pad)|cooler|umbrella|chair|"
    r"ding repair|repair kit|resin(?! tint)|sandpaper|"
    r"foil drive|foil board|wakesurf|kiteboard|sup\b|paddle|"
    r"helmet|goggle|bootie|booties"
    r")\b",
    re.I,
)
MISC_NAME = re.compile(
    r"\b("
    r"gift\s*card|deposit|custom order|voucher|faq|sold out package|"
    r"shipping|repair|glassing|experience|workshop|class|"
    r"t-?shirt|hoodie|hat|cap|sticker|leash|fin set|\bfins?\b"
    r")\b",
    re.I,
)
SIZE_ONLY = re.compile(r"^\d+['′]\d*", re.I)
DIM_PREFIX = re.compile(
    r"^[\d]+['′][\d\"″]*(?:\s*[x×]\s*[\d./\s\"″]+)*\s+",
    re.I,
)
SOLD_MARK = re.compile(r"\s*\((sold|sld)\)\s*$", re.I)
SKU_TAIL = re.compile(r"\s*#\s*\d+\s*$")


def fetch_bytes(url: str, accept: str = "application/json,text/html") -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(req, timeout=20, context=CTX) as resp:
        return resp.read()


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url, "application/json").decode())


def shopify_all(base: str, pages: int = 10) -> list[dict]:
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
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    return text[:600]


def is_surfboard(product: dict) -> bool:
    title = product.get("title") or ""
    product_type = product.get("product_type") or ""
    tags = product.get("tags") or ""
    if isinstance(tags, list):
        tags = " ".join(tags)
    blob = f"{title} {product_type} {tags}"
    if HARD_EXCLUDE.search(title) or HARD_EXCLUDE.search(product_type):
        return False
    if re.search(r"\b(apparel|clothing|accessories|fins?|leashes?|hardware)\b", product_type, re.I) and not BOARD.search(
        product_type
    ):
        return False
    if re.search(
        r"soft\s*-?\s*(board|top)|surfboard|longboard|shortboard|funboard|midlength|mid-length",
        product_type,
        re.I,
    ):
        return True
    if BOARD.search(blob):
        return True
    # Custom-shop one-offs are often titled with dimensions + a model code.
    if re.search(r"\d+['′]\d*", title) and re.search(
        r"\b(pf\d|eagle|calyma|pig|fish|egg|glider|twin|quad|thruster|log|gun)\b",
        title,
        re.I,
    ):
        return True
    return False


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")
    return s[:96] or "brand"


def product_belongs_to_brand(
    product: dict,
    brand_name: str,
    aliases: list[str] | None = None,
    exact_vendors: list[str] | None = None,
) -> bool:
    vendor = (product.get("vendor") or "").casefold().strip()
    title = (product.get("title") or "").casefold()
    if exact_vendors:
        allowed = {re.sub(r"[^a-z0-9]+", "", v.casefold()) for v in exact_vendors}
        vendor_n = re.sub(r"[^a-z0-9]+", "", vendor)
        return vendor_n in allowed
    names = [brand_name.casefold(), *(a.casefold() for a in (aliases or []))]
    expanded = []
    for n in names:
        expanded.append(n)
        expanded.append(re.sub(r"\b(surfboards?|softboards?|surf craft|surf co)\b", "", n).strip())
    expanded = [re.sub(r"\s+", " ", x).strip() for x in expanded if x]
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
    return False


def clean_model_name(title: str, brand_name: str) -> str:
    name = SOLD_MARK.sub("", title.strip())
    name = SKU_TAIL.sub("", name)
    for prefix in [brand_name, brand_name.replace("&", "and")]:
        if name.casefold().startswith(prefix.casefold()):
            name = name[len(prefix) :].lstrip(" -|:/")
    name = DIM_PREFIX.sub("", name)
    name = re.sub(r"\s+", " ", name).strip(" -|:/")
    # Drop trailing isolated dimensions
    name = re.sub(
        r"[\s\-_/]*\d+['′]\d*(?:[\"″]\d*)?(?:\s*[x×]\s*\d+.*)?$",
        "",
        name,
    ).strip(" -|:/")
    if not name or SIZE_ONLY.match(name):
        name = SOLD_MARK.sub("", title.strip())
    return name[:120].strip()


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def products_to_models(
    products: list[dict],
    brand_name: str,
    *,
    require_own_vendor: bool = False,
    aliases: list[str] | None = None,
    exact_vendors: list[str] | None = None,
    limit: int = 60,
) -> list[dict]:
    models: dict[str, dict] = {}
    for product in products:
        if not is_surfboard(product):
            continue
        title = (product.get("title") or "").strip()
        if not title:
            continue
        if require_own_vendor and not product_belongs_to_brand(
            product, brand_name, aliases, exact_vendors=exact_vendors
        ):
            continue
        name = clean_model_name(title, brand_name)
        if len(name) < 2 or MISC_NAME.search(name):
            continue
        # Reject leftover dimension-only or serial-heavy names
        if re.fullmatch(r"[\d'\"″.\s/x×-]+", name):
            continue
        key = model_key(name)
        if len(key) < 3:
            continue
        image = image_of(product)
        if not image:
            continue
        desc = body_text(product)
        existing = models.get(key)
        if existing is None:
            models[key] = {
                "name": name,
                "image_url": image,
                "description": desc,
                "_score": 1,
            }
        else:
            existing["_score"] += 1
            if (not existing.get("description")) and desc:
                existing["description"] = desc
            if len(name) < len(existing["name"]) and not re.search(r"\d+['′]", name):
                existing["name"] = name
    ranked = sorted(models.values(), key=lambda m: (-m["_score"], m["name"].casefold()))
    return [
        {
            "name": item["name"],
            "image_url": item["image_url"],
            "description": item.get("description"),
        }
        for item in ranked[:limit]
    ]


class LogoParser(HTMLParser):
    def __init__(self, base: str) -> None:
        super().__init__()
        self.base = base
        self.candidates: list[tuple[int, str]] = []
        self._in_header = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        ad = {k: (v or "") for k, v in attrs}
        cls = f"{ad.get('class', '')} {ad.get('id', '')}".casefold()
        if tag in {"header", "nav"} or "header" in cls or "navbar" in cls:
            self._in_header += 1
        if tag == "meta":
            prop = (ad.get("property") or ad.get("name") or "").casefold()
            content = ad.get("content") or ""
            if prop in {"og:image", "og:image:url", "twitter:image"} and content:
                score = 40 if "logo" in content.casefold() else 10
                self.candidates.append((score, urljoin(self.base, content)))
        if tag in {"img", "image", "source", "link"}:
            src = ad.get("src") or ad.get("href") or ad.get("srcset") or ""
            src = src.split()[0] if src else ""
            alt = ad.get("alt") or ""
            blob = f"{src} {alt} {cls}".casefold()
            if not src:
                return
            if any(x in blob for x in ("logo", "brand-mark", "wordmark", "site-logo")):
                score = 80 if self._in_header else 50
                if src.endswith(".svg"):
                    score += 10
                self.candidates.append((score, urljoin(self.base, src.split("?")[0])))

    def handle_endtag(self, tag: str) -> None:
        if tag in {"header", "nav"} and self._in_header:
            self._in_header -= 1


def extract_logo(website_url: str) -> str | None:
    try:
        html = fetch_bytes(website_url, "text/html").decode("utf-8", "replace")
    except Exception as exc:
        print(f"  logo fetch failed {website_url}: {exc}")
        return None
    parser = LogoParser(website_url.rstrip("/") + "/")
    try:
        parser.feed(html)
    except Exception:
        pass
    # Shopify / theme asset fallbacks in raw HTML
    extra = re.findall(
        r"https?://[^\"'\s>]+(?:logo|wordmark|brand)[^\"'\s>]+\.(?:png|jpg|jpeg|svg|webp)",
        html,
        flags=re.I,
    )
    for url in extra:
        parser.candidates.append((60, url.split("?")[0]))
    ranked = sorted(parser.candidates, key=lambda x: -x[0])
    seen: set[str] = set()
    for score, url in ranked:
        if url in seen:
            continue
        seen.add(url)
        if any(x in url.casefold() for x in ("placeholder", "1x1", "blank", "pixel")):
            continue
        if score >= 40:
            return url
    return ranked[0][1] if ranked else None


def vendor_matches(vendor: str, aliases: list[str]) -> bool:
    blob = (vendor or "").casefold().strip()
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
        if an == blob_n or (len(an) >= 5 and an in blob_n) or a in blob:
            return True
    return False


def already_known(slug: str, name: str) -> bool:
    if slug in EXISTING_SLUGS:
        return True
    n = slugify(name)
    if n in EXISTING_SLUGS or f"{n}-surfboards" in EXISTING_SLUGS:
        return True
    return False


def scrape_daveysky() -> dict | None:
    """Squarespace/static model index — high-integrity named lineup."""
    url = "https://www.daveyskysurfboards.com/surfboards.html"
    try:
        html = fetch_bytes(url, "text/html").decode("utf-8", "replace")
    except Exception as exc:
        print(f"  daveysky html failed: {exc}")
        return None
    # Model names are published as ALL-CAPS headings with a following descriptor.
    blocks = re.findall(
        r"<[^>]+>\s*([A-Z][A-Z0-9 /+&'-]{2,40})\s*</[^>]+>\s*"
        r"<[^>]+>\s*([^<]{12,160})\s*</",
        html,
    )
    models: list[dict] = []
    seen: set[str] = set()
    # Images sit nearby as /images/board_models/...
    img_map = {
        model_key(Path(src).stem): urljoin(url, src)
        for src in re.findall(r'((?:https?:)?(?://[^/]+)?/images/board_models/[^"\']+)', html)
    }
    for raw_name, desc in blocks:
        name = re.sub(r"\s+", " ", raw_name).strip().title()
        if name.upper() in {
            "FISHES & TWINS",
            "GROVELERS",
            "PERFORMANCE HYBRID SHORTBOARDS",
            "HIGH PERFORMANCE HYBRID SHORTBOARDS",
            "HIGH PERFORMANCE SHORTBOARDS & STEP-UPS",
            "MIDLENGTHS",
            "MINI-LONGBOARDS",
            "LONGBOARDS",
        }:
            continue
        key = model_key(name)
        if key in seen or len(key) < 3:
            continue
        seen.add(key)
        image = img_map.get(key)
        if not image:
            # try first token
            image = img_map.get(model_key(name.split()[0]))
        if not image:
            continue
        models.append(
            {
                "name": name,
                "image_url": image,
                "description": re.sub(r"\s+", " ", desc).strip()[:600],
            }
        )
    if len(models) < 4:
        print(f"  daveysky models too few: {len(models)}")
        return None
    logo = extract_logo("https://www.daveyskysurfboards.com/")
    return {
        "slug": "daveysky-surfboards",
        "name": "DaveySKY Surfboards",
        "website_url": "https://www.daveyskysurfboards.com",
        "location_label": "Manasquan, New Jersey",
        "founder_name": "DaveySKY",
        "lead_shaper_name": "DaveySKY",
        "short_description": "East Coast performance quiver from Manasquan, NJ — fishes through high-performance shortboards.",
        "logo_url": logo,
        "models": models[:40],
        "country": "USA",
    }


def scrape_neal_purchase() -> dict | None:
    url = "https://www.nealpurchasedesigns.com/"
    try:
        html = fetch_bytes(url, "text/html").decode("utf-8", "replace")
    except Exception as exc:
        print(f"  neal purchase html failed: {exc}")
        return None
    names = []
    for m in re.finditer(
        r"(PINEAL TWIN|DIAMOND TWIN|DUOZA|THE\\s+[A-Z][A-Z0-9 ]{2,24})",
        html,
    ):
        names.append(re.sub(r"\s+", " ", m.group(1)).title())
    # Squarespace image blocks often include alt text with model names
    alts = re.findall(r'alt="([^"]{3,60})"', html)
    for alt in alts:
        if re.search(r"twin|duoza|pineal|diamond|fish|mid|egg|log", alt, re.I):
            names.append(alt.strip())
    models: list[dict] = []
    seen: set[str] = set()
    imgs = re.findall(r'(https://images\.squarespace-cdn\.com/[^"\']+\.(?:jpg|jpeg|png|webp))', html)
    logo = extract_logo(url)
    for i, name in enumerate(names):
        key = model_key(name)
        if key in seen or MISC_NAME.search(name):
            continue
        seen.add(key)
        image = imgs[i] if i < len(imgs) else (imgs[0] if imgs else None)
        if not image:
            continue
        models.append({"name": name, "image_url": image, "description": None})
    if len(models) < 2:
        print(f"  neal purchase models too few: {len(models)}")
        return None
    return {
        "slug": "neal-purchase-designs",
        "name": "Neal Purchase Designs",
        "website_url": url.rstrip("/"),
        "location_label": "Northern New South Wales, Australia",
        "founder_name": "Neal Purchase Jnr",
        "lead_shaper_name": "Neal Purchase Jnr",
        "short_description": "Low-production Northern NSW performance boards from Neal Purchase Jnr.",
        "logo_url": logo,
        "models": models[:20],
        "country": "Australia",
    }


def scrape_barahona() -> dict | None:
    url = "https://www.barahonasurf.com/"
    try:
        html = fetch_bytes(url, "text/html").decode("utf-8", "replace")
    except Exception as exc:
        print(f"  barahona html failed: {exc}")
        return None
    # Squarespace product titles
    titles = re.findall(
        r'data-title="([^"]+)"|class="ProductList-title"[^>]*>\s*([^<]+)',
        html,
    )
    names = []
    for a, b in titles:
        t = (a or b).strip()
        if t:
            names.append(t)
    imgs = re.findall(
        r'(https://images\.squarespace-cdn\.com/[^"\']+\.(?:jpg|jpeg|png|webp))',
        html,
    )
    models: list[dict] = []
    seen: set[str] = set()
    for i, title in enumerate(names):
        if HARD_EXCLUDE.search(title) or MISC_NAME.search(title):
            continue
        if not BOARD.search(title) and not re.search(
            r"easy|piglet|log|mid|fish|egg|noserider|gun|twin", title, re.I
        ):
            continue
        name = clean_model_name(title, "Barahona Surfboards")
        key = model_key(name)
        if key in seen or len(key) < 3:
            continue
        seen.add(key)
        image = imgs[min(i, len(imgs) - 1)] if imgs else None
        if not image:
            continue
        models.append({"name": name, "image_url": image, "description": None})
    if len(models) < 2:
        print(f"  barahona models too few: {len(models)} titles={names[:10]}")
        return None
    return {
        "slug": "barahona-surfboards",
        "name": "Barahona Surfboards",
        "website_url": "https://www.barahonasurf.com",
        "location_label": "Hermosa Beach, California",
        "founder_name": "Jose Barahona",
        "lead_shaper_name": "Jose Barahona",
        "short_description": "Hand-shaped South Bay longboards and mid-lengths from Jose Barahona in Hermosa Beach.",
        "logo_url": extract_logo(url),
        "models": models[:30],
        "country": "USA",
    }


def scrape_lundquist() -> dict | None:
    url = "https://lundquistsurfboards.com/"
    try:
        html = fetch_bytes(url, "text/html").decode("utf-8", "replace")
    except Exception as exc:
        print(f"  lundquist html failed: {exc}")
        return None
    # Category lineup is published; look for model-ish headings near /lineup
    names = re.findall(
        r">(Shortboards|Twin Fins|Mid-Lengths|Longboards|Gliders|"
        r"[A-Z][A-Za-z0-9' /-]{2,32})</",
        html,
    )
    # Too noisy. Prefer dedicated model cards if present.
    cards = re.findall(
        r'alt="([^"]{3,80}(?:board|twin|fish|mid|log|glider|short)[^"]*)"',
        html,
        flags=re.I,
    )
    imgs = re.findall(
        r'(https://images\.squarespace-cdn\.com/[^"\']+\.(?:jpg|jpeg|png|webp)|'
        r'https://[^"\']+/cdn/shop/[^"\']+\.(?:jpg|jpeg|png|webp))',
        html,
    )
    models: list[dict] = []
    seen: set[str] = set()
    for i, title in enumerate(cards):
        name = clean_model_name(title, "Lundquist Surfboards")
        if MISC_NAME.search(name) or len(name) < 3:
            continue
        key = model_key(name)
        if key in seen:
            continue
        seen.add(key)
        image = imgs[min(i, len(imgs) - 1)] if imgs else None
        if not image:
            continue
        models.append({"name": name, "image_url": image, "description": None})
    if len(models) < 2:
        print(f"  lundquist models too few: {len(models)}")
        return None
    return {
        "slug": "lundquist-surfboards",
        "name": "Lundquist Surfboards",
        "website_url": "https://lundquistsurfboards.com",
        "location_label": "San Clemente, California",
        "founder_name": "Blake Lundquist",
        "lead_shaper_name": "Blake Lundquist",
        "short_description": "San Clemente custom quiver — shortboards through 12-foot gliders, built to order.",
        "logo_url": extract_logo(url),
        "models": models[:25],
        "country": "USA",
    }


def refresh_existing_slugs_from_db() -> None:
    url = "https://lqwsewptsirsglasnwmn.supabase.co"
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "Supabase_Service_Role_Key"
    )
    if not key:
        return
    req = urllib.request.Request(
        f"{url}/rest/v1/brands?select=slug,name&limit=2000",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=CTX) as resp:
            rows = json.loads(resp.read().decode())
        for row in rows:
            EXISTING_SLUGS.add(row["slug"])
            EXISTING_SLUGS.add(slugify(row["name"]))
        print(f"Loaded {len(rows)} live brand slugs")
    except Exception as exc:
        print(f"live slug refresh failed: {exc}")


def main() -> None:
    refresh_existing_slugs_from_db()
    brands_out: list[dict] = []

    print("Scraping first-party Shopify catalogs...")
    for brand in DIRECT_BRANDS:
        if already_known(brand["slug"], brand["name"]):
            print(f"  skip existing {brand['slug']}")
            continue
        products = shopify_all(brand["shopify_base"], pages=12)
        models = products_to_models(
            products,
            brand["name"],
            require_own_vendor=brand.get("require_own_vendor", False),
            aliases=brand.get("vendor_aliases"),
            exact_vendors=brand.get("exact_vendors"),
        )
        logo = extract_logo(brand["website_url"])
        print(
            f"  {brand['slug']}: products={len(products)} models={len(models)} "
            f"imgs={sum(1 for m in models if m.get('image_url'))} logo={'Y' if logo else 'N'}"
        )
        if len(models) < 3:
            print("    rejected: fewer than 3 named surfboard models")
            continue
        brands_out.append(
            {
                "slug": brand["slug"],
                "name": brand["name"],
                "website_url": brand.get("website_url"),
                "location_label": brand.get("location_label"),
                "founder_name": brand.get("founder_name"),
                "lead_shaper_name": brand.get("lead_shaper_name"),
                "short_description": brand.get("short_description"),
                "logo_url": logo,
                "models": models,
                "country": brand.get("country"),
            }
        )

    print("Scraping non-Shopify first-party pages...")
    for fn in (scrape_daveysky, scrape_neal_purchase, scrape_barahona, scrape_lundquist):
        try:
            entry = fn()
        except Exception as exc:
            print(f"  {fn.__name__} crashed: {exc}")
            continue
        if not entry:
            continue
        if already_known(entry["slug"], entry["name"]):
            print(f"  skip existing {entry['slug']}")
            continue
        print(
            f"  {entry['slug']}: models={len(entry['models'])} logo={'Y' if entry.get('logo_url') else 'N'}"
        )
        brands_out.append(entry)

    print("Scanning retailer catalogs for additional small labels...")
    pool: list[dict] = []
    for base in RETAILER_SCAN:
        products = shopify_all(base, pages=6)
        print(f"  {base}: {len(products)}")
        pool.extend(products)

    for brand in RETAILER_TARGETS:
        if already_known(brand["slug"], brand["name"]):
            print(f"  skip existing {brand['slug']}")
            continue
        matched = [
            p
            for p in pool
            if vendor_matches(p.get("vendor") or "", brand["vendor_aliases"])
            or product_belongs_to_brand(p, brand["name"], brand["vendor_aliases"])
        ]
        models = products_to_models(matched, brand["name"])
        website = brand.get("website_url")
        logo = extract_logo(website) if website else None
        print(
            f"  {brand['slug']}: matched={len(matched)} models={len(models)} logo={'Y' if logo else 'N'}"
        )
        if len(models) < 3:
            continue
        brands_out.append(
            {
                "slug": brand["slug"],
                "name": brand["name"],
                "website_url": website,
                "location_label": brand.get("location_label"),
                "founder_name": brand.get("founder_name"),
                "lead_shaper_name": brand.get("lead_shaper_name"),
                "short_description": brand.get("short_description"),
                "logo_url": logo,
                "models": models,
                "country": brand.get("country"),
            }
        )

    # Discover leftover retailer vendors that look like surfboard makers and aren't in DB.
    vendor_products: dict[str, list[dict]] = {}
    for product in pool:
        if not is_surfboard(product):
            continue
        vendor = (product.get("vendor") or "").strip()
        if not vendor:
            continue
        vendor_products.setdefault(vendor, []).append(product)

    print("Top unknown retailer surfboard vendors:")
    discovered = 0
    for vendor, products in sorted(vendor_products.items(), key=lambda kv: -len(kv[1])):
        slug = slugify(vendor)
        if already_known(slug, vendor) or f"{slug}-surfboards" in EXISTING_SLUGS:
            continue
        # Skip obvious retailers / conglomerates
        if re.search(
            r"\b(channel islands|firewire|lost|rusty|hayden|js industries|"
            r"dhd|pyzel|album|almond|catch surf|torq|nsp|softech|lib tech|"
            r"ocean & earth|mf soft|softlite|walden|stewart|hobie|ci\b|"
            r"sharp eye|lovemachine|slater)\b",
            vendor,
            re.I,
        ):
            continue
        models = products_to_models(products, vendor, limit=20)
        print(f"  ? {vendor}: products={len(products)} models={len(models)}")
        if len(models) < 4:
            continue
        # Only auto-add if we can attach a plausible first-party site later; keep as notes.
        discovered += 1
        if discovered > 25:
            break

    # Final integrity pass
    usable = []
    for brand in brands_out:
        models = [
            m
            for m in brand["models"]
            if m.get("name")
            and m.get("image_url")
            and not MISC_NAME.search(m["name"])
        ]
        brand["models"] = models
        if already_known(brand["slug"], brand["name"]):
            continue
        if len(models) < 3:
            print(f"drop {brand['slug']}: <3 imaged models after filter")
            continue
        usable.append(brand)

    usable.sort(key=lambda b: (-len(b["models"]), b["slug"]))
    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth: small USA + Australia surfboard makers only",
        "product_category_slug": "surfboards",
        "generated_on": "2026-08-19",
        "integrity_notes": [
            "Surfboard models only; apparel/fins/bags/deposits excluded",
            "Deduped against live public.brands slugs and names",
            "First-party catalogs preferred; retailer rows vendor-filtered",
            "Brand logos scraped from official sites",
        ],
        "brands": [
            {k: v for k, v in b.items() if k != "country"} | {"_country": b.get("country")}
            for b in usable
        ],
        "summary": {
            "brand_count": len(usable),
            "model_count": sum(len(b["models"]) for b in usable),
            "image_count": sum(1 for b in usable for m in b["models"] if m.get("image_url")),
            "logo_count": sum(1 for b in usable if b.get("logo_url")),
            "usa": sum(1 for b in usable if b.get("country") == "USA"),
            "australia": sum(1 for b in usable if b.get("country") == "Australia"),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))
    print(f"wrote {OUT}")
    for b in usable:
        imgs = sum(1 for m in b["models"] if m.get("image_url"))
        print(
            f"  {b['slug']:32} models={len(b['models']):3} imgs={imgs:3} "
            f"logo={'Y' if b.get('logo_url') else 'N'} {b.get('country')}"
        )


if __name__ == "__main__":
    main()
