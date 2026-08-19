#!/usr/bin/env python3
"""Clean and enrich the 2026-08-19 small USA/AU surfboard seed."""
from __future__ import annotations

import json
import re
import ssl
import urllib.request
from html import unescape
from pathlib import Path
from urllib.parse import unquote

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()
RAW = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-19.json")
OUT = RAW

CONSTRUCTION_TAIL = re.compile(
    r"\s*("
    r"(EPS|PU)\s+(TrueLite|Truelite|Dark Phantom|Series).*|"
    r"Surfboard Rental|"
    r"Rental|"
    r"Series Surfboard|"
    r"Surfboard"
    r")\s*$",
    re.I,
)
SIZE_PREFIX = re.compile(
    r"^(?:\d+['′’]\d*[\"″”]?|\d+[\"″”])\s+",
)
MISC = re.compile(
    r"\b("
    r"hoodie|sweatshirt|t-?shirt|tee|hat|cap|sticker|gift|deposit|"
    r"bag|wheels?|rental|custom surfboard$|blank|stringer|leash|"
    r"dvd|ebook|clock|appointment|travel to|balsa wood|calipers|"
    r"sanding block|kit|branches|logs or trees|puka patch|"
    r"second hand|wake\s*surf"
    r")\b",
    re.I,
)


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=20, context=CTX) as resp:
        return resp.read()


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")


def model_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.casefold())


def collapse_name(name: str, brand_name: str) -> str:
    n = name.strip()
    if n.casefold().startswith(brand_name.casefold()):
        n = n[len(brand_name) :].lstrip(" -|:/")
    n = re.sub(r"\s*\((sold|sld)\)\s*$", "", n, flags=re.I)
    n = re.sub(r"\s*#\s*[\d*]+\s*$", "", n)
    n = SIZE_PREFIX.sub("", n)
    n = CONSTRUCTION_TAIL.sub("", n).strip(" -|:/")
    n = re.sub(r"\s+", " ", n)
    n = re.sub(r"^The\s+", "", n).strip()
    # Drop leftover dimension-only
    if re.fullmatch(r"[\d'\"″.\s/x×-]+", n):
        return ""
    return n[:80]


def pick_better(a: dict, b: dict) -> dict:
    a_score = (1 if a.get("description") else 0) + (0 if "rental" in a["name"].casefold() else 1)
    b_score = (1 if b.get("description") else 0) + (0 if "rental" in b["name"].casefold() else 1)
    if b_score > a_score:
        return b
    if b_score == a_score and len(b["name"]) < len(a["name"]):
        return b
    return a


def clean_models(models: list[dict], brand_name: str, extra_drop: re.Pattern | None = None) -> list[dict]:
    out: dict[str, dict] = {}
    for m in models:
        name = collapse_name(m.get("name") or "", brand_name)
        if not name or len(name) < 2:
            continue
        if MISC.search(name):
            continue
        if extra_drop and extra_drop.search(name):
            continue
        if not m.get("image_url"):
            continue
        key = model_key(name)
        if len(key) < 3:
            continue
        row = {
            "name": name,
            "image_url": m["image_url"],
            "description": (m.get("description") or None),
        }
        if key in out:
            # keep cleaner name + any missing description
            prev = out[key]
            winner = pick_better(prev, {**row, "name": name})
            if prev.get("description") and not winner.get("description"):
                winner["description"] = prev["description"]
            winner["name"] = collapse_name(winner["name"], brand_name) or name
            out[key] = winner
        else:
            out[key] = row
    return sorted(out.values(), key=lambda x: x["name"].casefold())


def fetch_algorithm() -> dict:
    raw = json.loads(
        get("https://algorithmsurf.com/wp-json/wp/v2/product?per_page=100&_embed=1").decode()
    )
    models = []
    for p in raw:
        title = unescape(re.sub(r"<[^>]+>", "", p.get("title", {}).get("rendered", "")))
        if not re.search(r"surfboard", title, re.I):
            continue
        if re.search(r"t-?shirt|tee|hat|towel|beanie|rash", title, re.I):
            continue
        media = (p.get("_embedded") or {}).get("wp:featuredmedia") or []
        img = media[0].get("source_url") if media else None
        if not img:
            continue
        excerpt = unescape(re.sub(r"<[^>]+>", " ", p.get("excerpt", {}).get("rendered", "") or ""))
        excerpt = re.sub(r"\s+", " ", excerpt).strip()[:600] or None
        models.append(
            {
                "name": collapse_name(title, "Algorithm") or title,
                "image_url": img.split("?")[0],
                "description": excerpt,
            }
        )
    logo = None
    html = get("https://algorithmsurf.com/").decode("utf-8", "replace")
    m = re.search(
        r'(https://algorithmsurf.com/wp-content/uploads/[^"\']+logo[^"\']+\.(?:png|jpg|svg|webp))',
        html,
        re.I,
    )
    if m:
        logo = m.group(1).split("?")[0]
    if not logo:
        m = re.search(r'property="og:image" content="([^"]+)"', html)
        logo = m.group(1) if m else None
    return {
        "slug": "algorithm-surfboards",
        "name": "Algorithm Surfboards",
        "website_url": "https://algorithmsurf.com",
        "location_label": "Oceanside, California",
        "founder_name": "Brian Brown",
        "lead_shaper_name": "Brian Brown",
        "short_description": "Oceanside custom boards programmed in Shape3D and hand-tuned by shaper Brian Brown.",
        "logo_url": logo,
        "models": clean_models(models, "Algorithm Surfboards"),
    }


def fetch_daveysky() -> dict:
    lineup = [
        ("Skiff", "Small/soft-wave twin keel fish — hyperagile and loose.", "skiff"),
        ("Keeper", "Versatile twin keel fish — soul meets performance.", "keeper"),
        ("Keeper Plus", "Half step-up quad fish for bigger waves.", "keeper_plus"),
        ("Seahawk", "Performance hybrid twin + stabilizer for all-around vertical surfing.", "seahawk"),
        ("Reviver", "Performance super groveler for all-around and vertical surfing.", "reviver"),
        ("Microjet", "Performance groveler for all-around and vertical surfing.", "microjet"),
        ("Mango Pit", "Performance Simmons hybrid — multifaceted and layered.", "mango_pit"),
        ("Beta Fish", "Performance groveler + fish hybrid — speed meets turns.", "beta_fish"),
        ("Jet", "Performance hybrid shortboard for all-around and vertical surfing.", "jet"),
        ("Lust", "Performance hybrid shortboard built for all-around surfing and barrels.", "lust"),
        ("Vibe", "Hybrid shortboard — smooth and controlled.", "vibe"),
        ("Coconut", "Mini funshape / user-friendly shortboard alternative.", "coconut"),
        ("Turbo Ripper", "High-performance hybrid shortboard for all-around vertical surfing.", "turbo_ripper"),
        ("Love", "High-performance hybrid shortboard for all-around surfing and barrels.", "love"),
        ("Turbo Dream", "High-performance hybrid shortboard for good waves and vertical surfing.", "turbo_dream"),
        ("Thresher", "High-performance hybrid asym with a biomechanical advantage.", "thresher"),
        ("Dream", "High-performance shortboard for good waves and vertical surfing.", "dream"),
        ("Pipe Dream", "High-performance barrel board / step-up.", "pipe_dream"),
        ("Heater", "Mini-gun for overhead barrels and walls.", "heater"),
        ("Bombshell", "Performance hybrid step-up for modern heavy water.", "bombshell"),
        ("Charger", "User-friendly midlength step-up.", "charger"),
        ("SS", "Midlength twin fin — semi-loose and smooth.", "ss"),
        ("HSS", "Soulformance midlength for glassy, smooth conditions.", "hss"),
        ("Groove", "Mini glider for flow and soul.", "groove"),
        ("Beach Cruiser Micro", "Compact small-wave cruiser micro-longboard.", "beach_cruiser"),
        ("Banana Leaf", "Performance hybrid mini-longboard for all-around turns.", "banana_leaf"),
        ("Beach Cruiser", "Cruiser longboard for supreme ease and flow.", "beach_cruiser"),
        ("Beach Cruiser Mark II", "Walkable cruiser longboard.", "beach_cruiser_mark_ii"),
        ("Rhythm", "Noserider longboard built to hang ten.", "rhythm"),
    ]
    models = []
    for name, desc, stem in lineup:
        img = None
        for candidate in (stem, stem.replace("-", "_")):
            url = f"https://www.daveyskysurfboards.com/images/board_models/{candidate}.png"
            try:
                get(url)
                img = url
                break
            except Exception:
                continue
        if not img:
            continue
        models.append({"name": name, "image_url": img, "description": desc})
    # Deduplicate Beach Cruiser vs Micro sharing the same file — keep first unique image+name
    seen_keys = set()
    uniq = []
    for m in models:
        key = model_key(m["name"])
        if key in seen_keys:
            continue
        seen_keys.add(key)
        uniq.append(m)
    html = get("https://www.daveyskysurfboards.com/").decode("utf-8", "replace")
    logo = None
    m = re.search(r'(https://www\.daveyskysurfboards\.com/[^"\']+logo[^"\']+\.(?:png|jpg|svg))', html, re.I)
    if m:
        logo = m.group(1)
    if not logo:
        m = re.search(r'property="og:image" content="([^"]+)"', html)
        logo = m.group(1) if m else "https://www.daveyskysurfboards.com/images/board_models/love_logo.png"
    return {
        "slug": "daveysky-surfboards",
        "name": "DaveySKY Surfboards",
        "website_url": "https://www.daveyskysurfboards.com",
        "location_label": "Manasquan, New Jersey",
        "founder_name": "DaveySKY",
        "lead_shaper_name": "DaveySKY",
        "short_description": "East Coast performance quiver from Manasquan, NJ — fishes through high-performance shortboards.",
        "logo_url": logo,
        "models": uniq,
    }


def fetch_lundquist() -> dict:
    lineup = [
        ("Innuendo", "Shortboard", "High-performance shortboard for chest-to-overhead surf. High entry rocker; single concave into a slight double through the tail."),
        ("Salt Burn", "Twin Fin", "High-performance fish that looks retro and rides modern. Swallow-tail twin for clean waist-to-head surf."),
        ("Spectre", "Mid-Length", "Modern mid-length for clean waist-to-head surf — glide, paddle, and dynamic turns. Twin-or-single setup."),
        ("Fantasma", "Longboard", "Flagship traditional longboard built around glide, paddle, and drawn-out turns. Belly bottom, 50/50 rails."),
        ("Scorpio", "Shortboard", "Performance shortboard with step-up DNA for clean chest-to-overhead surf with real push. Quad stock."),
        ("Talisman Mini Gun", "Gun", "Mini gun for overhead to double-overhead waves that holds a line in serious ocean."),
        ("Dutchman", "Glider", "Long, narrow single-fin glider for trim, paddle, and the longest line in the quiver."),
        ("2nd to None", "Shortboard", "Everyday-quad shortboard with a centered wide point and pulled-in back quarter."),
        ("Suds", "Twin Fin", "Modern twin fin — speed and flow with bite. Single concave, hard tail rails, low entry rocker."),
        ("Esplanade", "Mid-Length", "Refined mid-length cruiser for lined-up surf. Vee tail, 2+1 boxes, single-fin run mode."),
        ("Black Pearl", "Longboard", "Modern-classic single-fin longboard with a drawn outline, belly forward, and 60/40 pinched rails."),
        ("Talisman Step Up", "Shortboard", "Step-up shortboard for chest-overhead through double-overhead surf. Foiled rails, pulled-in tail."),
        ("Talisman Gun", "Gun", "Big-wave gun for power and hold in hollow, serious surf."),
        ("Gumball", "Shortboard", "Small-wave shortboard for SoCal mush days — wider outline, fuller foil, medium rocker."),
        ("Revenant", "Twin Fin", "High-performance twin derived from a modern shortboard, for clean head-high surf."),
        ("Sea Bottom", "Shortboard", "Deeper-bottomed shape for drawn-out, flowing turns in softer conditions."),
        ("Lunada", "Longboard", "Cruiser-leaning longboard for easy paddling and stylish trim on mellow SoCal mornings."),
        ("Five Horizons", "Shortboard", "Power-surf daily driver hybrid HPSB for shoulder-to-overhead+ surf with shape and push."),
        ("Pin Twin", "Twin Fin", "Modern twin with a pin tail for clean waist-to-head surf. Medium rocker, double-concave tail."),
        ("Whip-Stitch", "Mid-Length", "Performance mid-length with paddle of a longer board and snap of a shortboard."),
        ("Big Joe", "Longboard", "Forgiving longboard with generous volume and stability for relaxed sessions."),
        ("Wanted", "Shortboard", "Forgiving HPSB with fuller foam, meant to ride 2-6 inches shorter than a daily shortboard."),
        ("Duppy", "Twin Fin", "Modern twin that hovers — friction-free speed for clean, shaped surf."),
        ("Serenata", "Mid-Length", "Mid-length built for long lines and melodic turns on clean, shaped surf."),
        ("Legacy", "Longboard", "Timeless longboard that honors tradition while delivering modern performance."),
        ("Gold", "Shortboard", "Premium design that glides like liquid gold across shortboard and twin-fin configurations."),
        ("Lucid", "Twin Fin", "Clear-thinking twin fin that rewards patience and technique with controllable turns."),
        ("Hiatus", "Mid-Length", "Mid-length for taking a break from shortboards — fun and forgiving."),
        ("Magic Carpet", "Longboard", "Floating longboard that glides even in minimal swell."),
        ("Moon Shine", "Shortboard", "SoCal everyday driver leaning toward good-wave surf. Round tail, thruster only."),
        ("Boomerang", "Twin Fin", "Snappy modern twin tuned for quick redirects on shaped California surf."),
        ("Apparition", "Shortboard", "Shortboard that works in more conditions than expected."),
        ("Half-Moon", "Twin Fin", "Modern twin with a moon tail — loose on top, held through the bottom."),
        ("Bang!", "Shortboard", "Grovel-friendly daily driver that paddles early in mush and projects through fun surf."),
        ("Aardvark", "Twin Fin", "Turn-first modern twin built around the back foot with channeled double concave."),
        ("Lasso", "Shortboard", "Shortboard built for hold and drive on fast, slippery walls."),
        ("Acid-Drop", "Twin Fin", "Snap-and-release twin for late drops and sharp lines."),
        ("Popsicle Stick", "Shortboard", "Slim daily-driver shortboard for clean waist-to-shoulder rail-to-rail sessions."),
        ("Big Buoy", "Shortboard", "Generous volume, modern lines — paddles in early without trimming performance."),
        ("Pegasus", "Longboard", "Dedicated noserider — wider nose, single concave under the tip, fuller hip for hang time."),
    ]
    models = []
    for name, category, desc in lineup:
        slug = slugify(name.replace("!", ""))
        img = f"https://lundquistsurfboards.com/images/outlines/{slug}.png"
        try:
            get(img)
        except Exception:
            # try first token
            alt = f"https://lundquistsurfboards.com/images/outlines/{slugify(name.split()[0])}.png"
            try:
                get(alt)
                img = alt
            except Exception:
                continue
        models.append(
            {
                "name": name,
                "image_url": img,
                "description": f"{category}. {desc}",
            }
        )
    html = get("https://lundquistsurfboards.com/").decode("utf-8", "replace")
    logo = None
    m = re.search(
        r'(https://lundquistsurfboards.com/[^"\']+logo[^"\']+\.(?:png|svg|jpg|webp))',
        html,
        re.I,
    )
    if m:
        logo = m.group(1)
    if not logo:
        m = re.search(r'property="og:image" content="([^"]+)"', html)
        logo = m.group(1) if m else None
    return {
        "slug": "lundquist-surfboards",
        "name": "Lundquist Surfboards",
        "website_url": "https://lundquistsurfboards.com",
        "location_label": "San Clemente, California",
        "founder_name": "Blake Lundquist",
        "lead_shaper_name": "Blake Lundquist",
        "short_description": "San Clemente custom quiver — shortboards through 12-foot gliders, designed by Blake Lundquist.",
        "logo_url": logo,
        "models": models,
    }


def fetch_barahona() -> dict:
    html = get("https://www.barahonasurf.com/").decode("utf-8", "replace")
    # Map known model photos from Squarespace filenames.
    wanted = {
        "The Hippie": r"Hippie|jj_wessels_model_j",
        "The Beauty": r"Beauty_front",
        "The Log": r"Log_front",
        "The Nugget": r"nugget\.jpg",
        "The Porto": r"Porto_front",
        "The Fish-O": r"Fish-?O|Guppy_front",
        "The Bullet": r"Bullet_Front",
        "The Schaefer": r"Schaefer",
        "The Easy": r"Easy_Front",
        "The Piglet": r"Piglet_front",
    }
    descriptions = {
        "The Hippie": "Old-school single-fin longboard with a full template, low rocker, and 50/50 rails — a solid noserider that still turns.",
        "The Beauty": "Traditional log with 10 oz Volan, pulled-back concave, and low rocker for speed and hang-time.",
        "The Log": "Christian Stutzman's original noserider — substantial nose rocker, kicked tail, and lift for time on the tip.",
        "The Nugget": "Summertime 5-fin squash of The Easy: paddle power with shortboard-style single-to-double concave.",
        "The Porto": "High-performance shortboard with a pulled-in rounded pintail and five-fin setup for hollow, punchy waves.",
        "The Fish-O": "High-performance fish with an old-school outline, modern rails, and a unique center channel.",
        "The Bullet": "High-performance longboard that flies down the line and still works on the nose.",
        "The Schaefer": "Dave Schaefer's high-performance noserider — maneuverable like a shorter board with extra tip time.",
        "The Easy": "Best-selling everything mid-length for ankle-high slop through overhead, any level of surfer.",
        "The Piglet": "Mid-length built for speed, trim, and flow with a rearward wide point and slight tail vee.",
    }
    urls = re.findall(r"https://images\.squarespace-cdn\.com/content/[^\"\\?]+\.(?:jpg|jpeg|png|JPG)", html)
    models = []
    for name, pat in wanted.items():
        img = next((u for u in urls if re.search(pat, unquote(u), re.I)), None)
        if not img:
            continue
        img = img.split("&")[0]
        models.append(
            {
                "name": name,
                "image_url": img,
                "description": descriptions[name],
            }
        )
    logo = None
    m = re.search(
        r'(https://images\.squarespace-cdn\.com/content/[^"\']+logo[^"\']+\.(?:png|jpg|svg))',
        html,
        re.I,
    )
    if m:
        logo = m.group(1)
    if not logo:
        m = re.search(r'property="og:image" content="([^"]+)"', html)
        logo = m.group(1) if m else None
    return {
        "slug": "barahona-surfboards",
        "name": "Barahona Surfboards",
        "website_url": "https://www.barahonasurf.com",
        "location_label": "Hermosa Beach, California",
        "founder_name": "Jose Barahona",
        "lead_shaper_name": "Jose Barahona",
        "short_description": "Hand-shaped South Bay longboards, mid-lengths, and shortboards from Jose Barahona in Hermosa Beach.",
        "logo_url": logo,
        "models": models,
    }


def main() -> None:
    raw = json.loads(RAW.read_text())
    brands = []

    keep_slugs = {
        "josh-hall-surfboards",
        "byrne-surfboards",
        "thomas-surfboards-noosa",
        "sjs-custom-surfboards",
        "riley-balsa-surfboards",
        "runyon-surfboards",
        "kona-surf-co",
        "neal-purchase-designs",
    }
    extra_drop = {
        "riley-balsa-surfboards": re.compile(
            r"\b(wood|blank|kit|dvd|ebook|clock|appointment|branches|stringers|"
            r"sanding|calipers|leash|puka|second hand|adventure|sales rep|"
            r"end grain|long grain|rough sawn|raw balsa|italy|europe|sfx)\b",
            re.I,
        ),
        "kona-surf-co": re.compile(r"\b(bag|wheels|custom$|4-4|5-5)\b", re.I),
        "josh-hall-surfboards": re.compile(r"\b(hoodie|sweatshirt|used)\b", re.I),
        "neal-purchase-designs": None,
    }

    for brand in raw["brands"]:
        if brand["slug"] not in keep_slugs:
            print("drop", brand["slug"], "(not first-party / weak identity)")
            continue
        models = clean_models(
            brand["models"],
            brand["name"],
            extra_drop=extra_drop.get(brand["slug"]),
        )
        # Riley: keep only named board families
        if brand["slug"] == "riley-balsa-surfboards":
            allow = re.compile(
                r"\b(fish|funboard|mini mal|hybrid|short board|longboard|malibu|"
                r"mid length|hawaiian gun|diamond range|beginners)\b",
                re.I,
            )
            models = [m for m in models if allow.search(m["name"])]
        if len(models) < 3:
            print("drop", brand["slug"], "after clean", len(models))
            continue
        if not brand.get("logo_url"):
            print("drop", brand["slug"], "missing logo")
            continue
        if brand["slug"] == "josh-hall-surfboards":
            renamed = []
            for m in models:
                name = re.sub(
                    r"\s+featuring origina.*$",
                    "",
                    m["name"],
                    flags=re.I,
                ).strip()
                renamed.append({**m, "name": name})
            models = clean_models(renamed, brand["name"])
        if brand["slug"] == "neal-purchase-designs":
            descs = {
                "pinealtwin": "High-performance twin from Neal Purchase Jnr — speed, drive, and a lively, user-friendly flow.",
                "diamondtwin": "Diamond-tail twin refined for Northern NSW waves, balancing drive with easy rail-to-rail.",
                "duoza": "Neal Purchase Designs hybrid performance shape built for everyday speed and control.",
            }
            for m in models:
                if not m.get("description"):
                    m["description"] = descs.get(model_key(m["name"]))
        brand = {**brand, "models": models}
        brand.pop("_country", None)
        brands.append(brand)
        print(f"kept {brand['slug']:32} models={len(models):3} logo=Y")

    print("Fetching extra first-party catalogs...")
    for fn in (fetch_algorithm, fetch_daveysky, fetch_lundquist, fetch_barahona):
        try:
            extra = fn()
        except Exception as exc:
            print(f"  {fn.__name__} failed: {exc}")
            continue
        extra["models"] = [m for m in extra["models"] if m.get("image_url") and m.get("name")]
        print(
            f"  {extra['slug']}: models={len(extra['models'])} logo={'Y' if extra.get('logo_url') else 'N'}"
        )
        if len(extra["models"]) >= 3 and extra.get("logo_url"):
            brands.append(extra)
        else:
            print("    skipped")

    brands.sort(key=lambda b: (-len(b["models"]), b["slug"]))
    payload = {
        "generated_for": "reswell surfboards catalog",
        "purpose": "Daily growth: small USA + Australia surfboard makers only",
        "product_category_slug": "surfboards",
        "generated_on": "2026-08-19",
        "integrity_notes": [
            "Surfboard models only; apparel, bags, wax, wood stock, rentals, and deposits excluded",
            "Construction/size variants collapsed to a single named model",
            "Deduped against live public.brands slugs",
            "First-party catalogs only; brand logos from official sites",
            "Thomas Surfboards Noosa is distinct from California Thomas Surfboards already in the DB",
        ],
        "brands": brands,
        "summary": {
            "brand_count": len(brands),
            "model_count": sum(len(b["models"]) for b in brands),
            "image_count": sum(1 for b in brands for m in b["models"] if m.get("image_url")),
            "logo_count": sum(1 for b in brands if b.get("logo_url")),
            "described_count": sum(1 for b in brands for m in b["models"] if m.get("description")),
        },
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(payload["summary"], indent=2))
    for b in brands:
        print(f"  {b['slug']:32} models={len(b['models']):3} logo={'Y' if b.get('logo_url') else 'N'}")


if __name__ == "__main__":
    main()
