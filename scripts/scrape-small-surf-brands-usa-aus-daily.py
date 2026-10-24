#!/usr/bin/env python3
"""
Daily first-party scrape of small USA / Australia surfboard makers.

Writes:
  scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-24.json

Integrity:
  - Official brand sites only
  - Named surfboard models only (no apparel, fins, bags, foil, SUP, gift cards)
  - Require image + name + description
  - Collapse size / color / construction duplicates
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
OUT = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-24.json")

HARD_EXCLUDE = re.compile(
    r"\b(leash|wax|traction|fin sets?|\bfins\b|board ?bag|day bag|travel bag|"
    r"t-?shirt|hoodie|tee\b|hat\b|cap\b|sticker|gift ?card|deposit|"
    r"delivery fee|rush processing|custom order|voucher|gift voucher|"
    r"bodyboard|bellyboard|skimboard|handplane|foil|sup\b|paddle|"
    r"workshop|kit\b|plans\b|paipo|sunscreen|keep cup|tote|"
    r"tea\b|coffee|lip zinc|chafe|sticker pack|key ?ring|book|"
    r"leg ?rope|tailpad|tail pad|nipper|rescue board|inflatable sled|"
    r"g-sled|seadonkey|stand up paddle)\b",
    re.I,
)
SERVICE = re.compile(
    r"\b(delivery fee|rush processing|custom surfboard|faq|gift card|deposit|"
    r"used personal|last chance)\b",
    re.I,
)
LEADING_SIZE = re.compile(
    r"""^(?:NEW\s*[-–—]?\s*)?(?:\d+\s*['′]\s*\d*(?:[\"″]\d*)?|\d+['′]\s*\d*|\d+\s*ft|\d+[,\.]\d+)\s*""",
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
        r'(?:src|content|href)="([^"]*(?:logo|Logo|LOGO|wordmark)[^"]+\.(?:png|jpg|jpeg|svg|webp)[^"]*)"',
        r'property="og:image"\s+content="([^"]+)"',
        r'rel="apple-touch-icon"[^>]+href="([^"]+)"',
    ]
    for pat in patterns:
        for raw in re.findall(pat, html, flags=re.I):
            url = normalize_asset_url(raw if isinstance(raw, str) else raw[0], base)
            if url and "32x32" not in url:
                return url
    for raw in re.findall(r'(//[^"\']+/cdn/shop/(?:files|t/\d+/assets)/[^"\']+\.(?:png|jpg|jpeg|webp|svg))', html, re.I):
        low = raw.casefold()
        if any(token in low for token in ("logo", "wordmark", "header", "brand")):
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


# ---------------------------------------------------------------------------
# Sauritch (Encinitas) — first-party HTML model pages
# ---------------------------------------------------------------------------
SAURITCH_SKIP = {
    "https://www.sauritchsurfboards.com",
    "https://www.sauritchsurfboards.com/index.html",
    "https://www.sauritchsurfboards.com/about.html",
    "https://www.sauritchsurfboards.com/gallery.html",
    "https://www.sauritchsurfboards.com/surfboards.html",
    "https://www.sauritchsurfboards.com/contact.html",
}


def scrape_sauritch() -> tuple[list[dict], str | None]:
    xml = fetch_text("https://www.sauritchsurfboards.com/sitemap.xml")
    locs = sorted(set(re.findall(r"<loc>(.*?)</loc>", xml)))
    models: dict[str, dict] = {}
    for loc in locs:
        if loc.rstrip("/") in SAURITCH_SKIP or "/surfboards/" not in loc:
            continue
        try:
            html = fetch_text(loc)
        except Exception as exc:
            print(f"  sauritch skip {loc}: {exc}")
            continue
        time.sleep(0.08)
        title = None
        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        if h1:
            title = strip_html(h1.group(1))
        if not title:
            slug = loc.rsplit("/", 1)[-1].replace(".html", "").strip("-")
            title = title_case_model(slug.replace("-", " "))
        if not title:
            continue
        # Sauritch Stubby / Stubby 2 are named shortboards, not misc SKUs.
        if HARD_EXCLUDE.search(title) and "stubby" not in title.casefold():
            continue
        if title.casefold() in {"crt", "crt2"}:
            title = title.upper()
        imgs = re.findall(r'src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"', html, re.I)
        image = None
        for raw in imgs:
            low = raw.casefold()
            if any(skip in low for skip in ("logo", "icon", "favicon", "instagram", "facebook")):
                continue
            image = urljoin("https://www.sauritchsurfboards.com/", raw)
            break
        text = strip_html(html) or ""
        nav = (
            "Home About Surfboards Gallery Order Contact About Surfboards New Models "
            "Shortboards Fish Alternatives Hybrids, Mid Lengths, Eggs Guns Longboards "
            "Gallery Order Contact"
        )
        text = text.replace(nav, " ")
        idx = text.casefold().find(title.casefold())
        chunk = text[idx:] if idx >= 0 else text
        chunk = re.sub(rf"^{re.escape(title)}\s+", "", chunk, flags=re.I)
        chunk = re.split(r"Ideal Dimensions", chunk, maxsplit=1)[0]
        desc = clip_desc(chunk)
        if not image or not desc or len(desc) < 60:
            print(f"  sauritch incomplete {title}: img={bool(image)} desc={len(desc or '')}")
            continue
        merge_model(models, title, image, desc)
    logo = "https://www.sauritchsurfboards.com/images/logo.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Chowder (Portland, OR) — official lineup pages
# ---------------------------------------------------------------------------
CHOWDER_MODELS = [
    (
        "The Fish",
        "https://images.squarespace-cdn.com/content/v1/58fad03229687f66cf21df7a/1609548599663-KKBCT95CS1NOIL60MJEJ/fish-only-small.png",
        "One of the most versatile and user friendly crafts in the water, the fish is a timeless shape that will never go out of style. Perfect for a wide variety of waves, but really excels on long, walled up waves where you can take full advantage of the built in speed of this shape. Traditionally a twin fin setup, however works well as a quad.",
    ),
    (
        "Fun Shape",
        "https://images.squarespace-cdn.com/content/v1/58fad03229687f66cf21df7a/1609549002468-K7DU983QE50CG237USD5/fun-only-small.png",
        "Fun shapes are just that: fun. Whether they are closer to a shortboard or longboard, Chowder fun shapes come in all sizes with one thing in common — they are user-friendly and a blast to ride. They catch waves and paddle easily, and allow you to maximize your time in the water.",
    ),
    (
        "Alternative",
        "https://images.squarespace-cdn.com/content/v1/58fad03229687f66cf21df7a/1609552516513-CT99SQ7OD4AKZP18J02B/alt-only-small.png",
        "Want to get weird? Experiment with your wave-riding style and craft with an alternative shape. Pushing the boundaries of what’s considered acceptable, Chowder loves creating something different that you’ll enjoy.",
    ),
    (
        "Longboard",
        "https://images.squarespace-cdn.com/content/v1/58fad03229687f66cf21df7a/1609552793052-9JBLMPBQ294AS8NCPK6O/longboard-only-small.png",
        "A longboard is a must-have in any PNW surfer’s quiver. Tons of glide, easy to paddle and catch waves with, and fun to noseride, Chowder longboards are built for keeping your wave count and stoke levels high.",
    ),
]


def scrape_chowder() -> tuple[list[dict], str | None]:
    models = [
        {"name": name, "image_url": image, "description": desc}
        for name, image, desc in CHOWDER_MODELS
    ]
    logo = (
        "https://static1.squarespace.com/static/58fad03229687f66cf21df7a/"
        "t/5fefad700f96794605b5130c/1609548096884/chowder-logo.png"
    )
    return models, logo


# ---------------------------------------------------------------------------
# JCD (Newcastle) — Shopify, named models only
# ---------------------------------------------------------------------------
JCD_NAMED = {
    "the coupe",
    "the coupë",
    "wave slave",
    "ba twin",
    "twingle mid",
    "slab hunter",
    "gemini twin",
    "mid six",
    "cali",
    "ss3",
    "new lover",
    "stump",
    "fg",
    "performer mal",
    "twin step",
}


def clean_jcd_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    if HARD_EXCLUDE.search(name) or SERVICE.search(name):
        return None
    if re.search(r"\b(cap|shirt|traction|leg rope|tailpad|fin)\b", name, re.I):
        return None
    # Size-first stock boards without a named model
    if re.match(r"^\d+[,'′]", name) and not re.search(
        r"\b(performer|gemini|twin step|mid length)\b", name, re.I
    ):
        return None
    if re.search(r"\b(orange peel|blue epoxy|channel twin)\b", name, re.I):
        return None
    name = LEADING_SIZE.sub("", name)
    name = re.sub(r"\s+\d+['′].*$", "", name)
    name = re.sub(r"\s+(Grey|Gray|Black|White|Blue)\b.*$", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" -–—")
    if name.casefold() in {"mid length", "twin"}:
        return None
    if model_key(name) not in {model_key(n) for n in JCD_NAMED} and name.casefold() not in JCD_NAMED:
        # Keep only the documented named lineup plus close matches
        folded = name.casefold()
        if not any(token in folded for token in JCD_NAMED):
            return None
    if len(name) < 2:
        return None
    return name


def scrape_jcd() -> tuple[list[dict], str | None]:
    products = shopify_all("https://www.jcdsurfboards.com")
    models: dict[str, dict] = {}
    for product in products:
        title = product.get("title") or ""
        name = clean_jcd_name(title)
        if not name:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        if desc and len(desc) < 40:
            continue
        merge_model(models, name, image_of(product), desc)
    logo = shopify_logo("https://www.jcdsurfboards.com")
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Babel (Torquay) — Shopify, collapse sized stock into named models
# ---------------------------------------------------------------------------
BABEL_CANONICAL = [
    ("bar of soap", "Bar of Soap"),
    ("blunt fish", "Blunt Fish"),
    ("jumbo fish", "Jumbo Fish"),
    ("goliath twin", "Goliath Twin"),
    ("goliath", "Goliath"),
    ("rothler", "Rothler"),
    ("flebo twin", "Flebo Twin"),
    ("commuter", "Commuter"),
    ("butter quad", "Butter Quad"),
    ("narwhal", "Narwhal"),
    ("solis", "Solis"),
    ("flex~tail hull", "Flex-Tail Hull"),
    ("flex-tail hull", "Flex-Tail Hull"),
    ("sidecut fish", "Sidecut Fish"),
    ("herbiehancock", "Herbie Hancock"),
    ("keel fish", "Keel Fish"),
    ("hull", "Hull"),
]


def babel_model_name(title: str) -> str | None:
    name = html_lib.unescape(title).strip()
    low = name.casefold()
    if any(token in low for token in ("t-shirt", "tee", "hoodie", "gift card", "keel", "d-fin")):
        if "keel fish" not in low and "d-fin" in low:
            return None
        if any(token in low for token in ("t-shirt", "tee", "hoodie", "gift card")):
            return None
        if re.search(r"\b(keel|d-fin)\b", low) and "fish" not in low:
            return None
    if HARD_EXCLUDE.search(name) or SERVICE.search(name):
        return None
    for needle, canonical in BABEL_CANONICAL:
        if needle in low:
            return canonical
    return None


def scrape_babel() -> tuple[list[dict], str | None]:
    products = shopify_all("https://babelsurfboards.com")
    models: dict[str, dict] = {}
    # Prefer dedicated model pages (no leading size, product_type Surfboard)
    ranked = sorted(
        products,
        key=lambda p: (
            0 if (p.get("product_type") or "").casefold() == "surfboard" else 1,
            0 if not LEADING_SIZE.match(p.get("title") or "") else 1,
        ),
    )
    for product in ranked:
        title = product.get("title") or ""
        name = babel_model_name(title)
        if not name:
            continue
        merge_model(models, name, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = "https://babelsurfboards.com/cdn/shop/files/Logo_Favicon-2.png"
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# Vouch — own-label boards only from North Coast factory shop
# ---------------------------------------------------------------------------
VOUCH_CANONICAL = [
    ("fat arse wombat", "Fat Arse Wombat"),
    ("nuevo twin", "Nuevo Twin"),
    ("nuevo", "Nuevo"),
    ("mid vish", "Mid VISH"),
    ("rolled vee", "Rolled Vee 2"),
    ("rainbeau twin", "Rainbeau Twin"),
    ("vish", "VISH"),
    ("glider", "Glider"),
    ("devo", "Devo"),
    ("noserider", "Noserider"),
    ("egg", "Egg"),
    ("single fin", "Single Fin"),
]


def vouch_model_name(title: str, product_type: str) -> str | None:
    if (product_type or "").casefold() != "vouch":
        return None
    name = html_lib.unescape(title).strip()
    low = name.casefold()
    if any(token in low for token in ("t-shirt", "tee", "fin", "second hand")):
        return None
    if HARD_EXCLUDE.search(name):
        return None
    if "hutchinson" in low:
        return None  # collab / other-shaper stock
    for needle, canonical in VOUCH_CANONICAL:
        if needle in low:
            return canonical
    return None


def scrape_vouch() -> tuple[list[dict], str | None]:
    products = shopify_all("https://northcoastsurfboards.com.au")
    models: dict[str, dict] = {}
    for product in products:
        title = product.get("title") or ""
        name = vouch_model_name(title, product.get("product_type") or "")
        if not name:
            continue
        merge_model(models, name, image_of(product), clip_desc(strip_html(product.get("body_html"))))
    logo = shopify_logo("https://northcoastsurfboards.com.au")
    if not logo:
        logo = (
            "https://northcoastsurfboards.com.au/cdn/shop/files/"
            "north_coast_logo.png"
        )
    return finalize_models(models), logo


# ---------------------------------------------------------------------------
# G Boards (Torquay) — recreational soft surfboards only
# ---------------------------------------------------------------------------
GBOARD_CANONICAL = [
    ("diamond tail", "G-Lite Diamond Tail"),
    ("swallow tail", "G-Lite Swallow Tail"),
    ("the fun board", "G-Lite The Fun Board"),
    ("gboard original", "GBOARD Original"),
    ("gboard classic", "GBOARD Classic"),
]


def gboard_model_name(title: str, product_type: str) -> str | None:
    name = html_lib.unescape(title).strip()
    low = name.casefold()
    ptype = (product_type or "").casefold()
    if any(token in low for token in ("nipper", "rescue", "sled", "seadonkey", "paddle", "bag", "legrope", "leg rope", "fin", "gift", "handle", "bungee", "screws", "rope")):
        return None
    if ptype in {"accessories", "board bags", "sup", "gift cards", "surf life saving"}:
        return None
    if HARD_EXCLUDE.search(name):
        return None
    for needle, canonical in GBOARD_CANONICAL:
        if needle in low:
            return canonical
    return None


def scrape_gboards() -> tuple[list[dict], str | None]:
    products = shopify_all("https://gboards.com.au")
    models: dict[str, dict] = {}
    for product in products:
        title = product.get("title") or ""
        name = gboard_model_name(title, product.get("product_type") or "")
        if not name:
            continue
        desc = clip_desc(strip_html(product.get("body_html")))
        if desc and len(desc) < 40:
            continue
        merge_model(models, name, image_of(product), desc)
    logo = shopify_logo("https://gboards.com.au")
    return finalize_models(models), logo


def main() -> None:
    rejected: list[str] = []
    brands_out: list[dict] = []

    print("Sauritch Surfboards (Encinitas)...")
    models, logo = scrape_sauritch()
    print(f"  sauritch models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="sauritch-surfboards",
            name="Sauritch Surfboards",
            website_url="https://sauritchsurfboards.com",
            location_label="Encinitas, California",
            founder_name="Greg Sauritch",
            lead_shaper_name="Greg Sauritch",
            short_description="Hand-shaped polyurethane and epoxy surfboards from Greg Sauritch in Encinitas — shortboards, fishes, mid-lengths, guns, and longboards built for San Diego waves.",
            models=models,
            logo=logo,
        )
    )

    print("Chowder Surfboard Co. (Portland)...")
    models, logo = scrape_chowder()
    print(f"  chowder models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="chowder-surfboard-co",
            name="Chowder Surfboard Co.",
            website_url="https://www.chowdersurfco.com",
            location_label="Portland, Oregon",
            founder_name="Ryan Brooks",
            lead_shaper_name="Ryan Brooks",
            short_description="Hand-shaped Pacific Northwest surfboards from Ryan Brooks in Portland — fishes, fun shapes, alternative craft, and longboards.",
            models=models,
            logo=logo,
        )
    )

    print("JCD Surfboards (Newcastle)...")
    models, logo = scrape_jcd()
    print(f"  jcd models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="jcd-surfboards",
            name="JCD Surfboards",
            website_url="https://www.jcdsurfboards.com",
            location_label="Wickham, Newcastle, New South Wales, Australia",
            founder_name="Jamie Carr",
            lead_shaper_name="Jamie Carr",
            short_description="Australian-made custom shortboards, twins, and mid-lengths from Jamie Carr’s Newcastle factory.",
            models=models,
            logo=logo,
        )
    )

    print("Babel Surfboards (Torquay)...")
    models, logo = scrape_babel()
    print(f"  babel models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="babel-surfboards",
            name="Babel Surfboards",
            website_url="https://babelsurfboards.com",
            location_label="Torquay, Victoria, Australia",
            founder_name="Luca",
            lead_shaper_name="Luca",
            short_description="Torquay-crafted alternative and mid-length surfboards including the Goliath, Rothler, Blunt Fish, and Bar of Soap.",
            models=models,
            logo=logo,
        )
    )

    print("Vouch Surfboards (Byron Bay)...")
    models, logo = scrape_vouch()
    print(f"  vouch models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="vouch-surfboards",
            name="Vouch Surfboards",
            website_url="https://northcoastsurfboards.com.au",
            location_label="Byron Bay, New South Wales, Australia",
            short_description="Byron Bay factory label from North Coast Surfboards — VISH, Nuevo, Fat Arse Wombat, and other Vouch mid-lengths and logs, shaped and glassed in-house.",
            models=models,
            logo=logo,
        )
    )

    print("G Boards (Torquay)...")
    models, logo = scrape_gboards()
    print(f"  gboards models={len(models)} logo={bool(logo)}")
    brands_out.append(
        brand_row(
            slug="g-boards",
            name="G Boards",
            website_url="https://gboards.com.au",
            location_label="Torquay, Victoria, Australia",
            short_description="Torquay soft-top surfboards for learners and everyday surf, including the G-Lite Fun Board, Diamond Tail, and GBOARD Original school boards.",
            models=models,
            logo=logo,
        )
    )

    usable: list[dict] = []
    for brand in brands_out:
        kept = []
        for m in brand["models"]:
            name = pretty_model_name((m.get("name") or "").strip())
            desc = (m.get("description") or "").strip()
            image_url = m.get("image_url") or ""
            if image_url.casefold().endswith(".heic"):
                continue
            if (
                name
                and image_url
                and len(desc) >= 40
                and not HARD_EXCLUDE.search(name)
                and not SERVICE.search(name)
            ):
                kept.append({**m, "name": name, "description": desc})
        brand["models"] = kept
        if len(kept) >= 3 and brand.get("logo_url"):
            usable.append(brand)
        else:
            rejected.append(
                f"{brand['slug']}: after filter models={len(kept)} logo={bool(brand.get('logo_url'))}"
            )

    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth of small USA and Australia surfboard-maker brands",
        "generated_on": "2026-08-24",
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
