#!/usr/bin/env python3
"""
Find, download, and upload logos for brands missing logo_url.

Run: python3 scripts/backfill-missing-brand-logos.py
"""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

SUPABASE_URL = (
    os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or os.environ.get("Next_Public_Supabase_Url")
    or ""
).rstrip("/")
SERVICE_KEY = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("Supabase_Service_Role_Key")
    or ""
)

if not SUPABASE_URL or not SERVICE_KEY:
    print("Missing Supabase env vars", file=sys.stderr)
    sys.exit(1)

OUT_DIR = Path("public/brand-logos")
OUT_DIR.mkdir(parents=True, exist_ok=True)
BUCKET = "brand-assets"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
SSL_CTX = ssl._create_unverified_context()

# Official / distributor websites (overrides missing DB website_url)
KNOWN_WEBSITES: dict[str, str] = {
    "softech-surfboards": "https://www.softechsoftboards.com/",
    "machado-surfboards": "https://rmsurfboards.com/",
    "torq-surfboards": "https://www.torq-surfboards.com/home.html",
    "chemistry-surfboards": "https://www.chemistrysurfboards.com/",
    "takayama-surfboards": "https://www.donaldtakayama.com/",
    "town-and-country-surfboards": "https://www.tcsurf.com/",
    "timmy-patterson-surfboards": "https://www.tpattersonsurfboards.com/",
    "misfit-surfboards": "https://misfitshapes.com/",
    "foamie-surfboards": "https://foamie.co/",
    "shapers-fins": "https://shaperssurf.com/",
    "blocksurf-fins": "https://blocksurf.com/",
    "gerry-lopez-surfboards": "https://www.gerrylopezsurfboards.com/",
    "murdey-surfboards": "https://www.murdeysurfboards.com/",
    "roger-hinds-surfboards": "https://www.rogerhindssurfboards.com/",
    "eleventh-street-surfboards": "https://11thstreetsurfboards.com/",
    "modern-surfboards": "https://us.surfindustries.com/collections/modern-surfboards",
    "inspired-surfboards": "https://inspiredsurfboards.com/",
    "wildflower-surfboards": "https://wildflowersurfboards.com/",
    "ocean-soul-surfboards": "https://oceansoulsurf.com/",
    "superbrand-surfboards": "https://www.superbrand.com.au/",
    "cj-nelson-designs": "https://cjnelsondesigns.com/",
    "hot-buttered-surfboards": "https://www.hotbuttered.com.au/",
    "hess-surfboards": "https://www.hesswoodsurfboards.com/",
    "jeff-clark-surfboards": "https://jeffclarksurfboards.com/",
    "aj-surfboards": "https://ajsurfboards.com.au/",
    "creed-surfboards": "https://creedsurfboards.com/",
    "dick-brewer-surfboards": "https://dickbrewersurfboards.com/",
    "fish-stix-surfboards": "https://fishstixsurfboards.com/",
    "jeff-bushman-surfboards": "https://bushmansurf.com/",
    "joistik-surfboards": "https://joistik.com.au/",
    "kane-surfboards": "https://kanesurfboards.com/",
    "miller-surfboards": "https://millersurfboards.com/",
    "natural-curves-surfboards": "https://naturalcurvessurfboards.com/",
    "pisces-surfboards": "https://piscessurfboards.com/",
    "7s-surfboards": "https://7ssurfboards.com/",
    "tyler-warren-surfboards": "https://tylerwarrensurfboards.com/",
}

# Curated direct logo URLs verified to download
KNOWN_LOGOS: dict[str, list[str]] = {
    "softech-surfboards": [
        "https://cdn.shopify.com/s/files/1/0056/8249/5577/files/softech-logo-x180.png",
        "https://www.softechsoftboards.com/cdn/shop/files/softech-new-logo-black1.png?v=1661232498",
    ],
    "machado-surfboards": [
        "https://rmsurfboards.com/cdn/shop/files/RMSLBKWH-01.png?v=1613735388",
        "https://rmsurfboards.com/cdn/shop/files/RMS_Logo.jpg",
    ],
    "torq-surfboards": [
        "https://www.torq-surfboards.com/files/layout/Torq_logo_white.png",
        "https://www.torq-surfboards.com/files/layout/Torq_logo_header_white.png",
    ],
    "chemistry-surfboards": [
        "https://content.cavewire.com/host/chemistry-us/path/media/theme/CHEM-LOGO-2024.png",
        "https://content.cavewire.com/host/chemistry-us/path/media/theme/logo_1_1.png",
    ],
    "takayama-surfboards": [
        "http://static1.squarespace.com/static/66e24bf34ac4632b7fec9136/t/67730fa3d2562f05758053aa/1735593891615/Signature1.2.png?format=1500w",
    ],
    "town-and-country-surfboards": [
        "https://tcsurf.com/cdn/shop/files/logo_small_150px_06ff5492-c86f-46c4-8213-6ad9b76a50df.png",
    ],
    "timmy-patterson-surfboards": [
        "https://static.wixstatic.com/media/cb8e82_f669aee98c36488bacdcd5e6865ad784~mv2.png",
        "https://static.wixstatic.com/media/cb8e82_3943144dbbdb43ef9cc364e108b0cfb9~mv2_d_1727_1727_s_2.png",
    ],
    "misfit-surfboards": [
        "https://cdn.shopify.com/s/files/1/0276/9865/9406/files/Misfit_Logo-blk.png",
    ],
    "foamie-surfboards": [
        "https://foamie.co/cdn/shop/files/CORPORATE_ARTWORK.png?v=1648519163",
        "https://foamie.co/cdn/shop/files/CORPORATE_ARTWORK_190x.png?v=1648519163",
        "https://foamie.co/cdn/shop/files/Foamie_Surf_Softboards.png?v=1681268038",
    ],
    "shapers-fins": [
        "https://cdn11.bigcommerce.com/s-6ww9rkf/images/stencil/original/shapers-logo_1673224844__52654.original.png",
    ],
    "blocksurf-fins": [
        "https://img1.wsimg.com/isteam/ip/ebdc9515-ec7b-4c26-9fe2-76f68ad48f70/logo/2121c3ae-29be-4dda-a7e7-f6e1b5ec32ab.jpg",
    ],
    "gerry-lopez-surfboards": [
        "http://static1.squarespace.com/static/53445d4ce4b044acbaa8a0a4/t/5d083c7515610000011b8eda/1560820854088/gl-signature.png?format=1500w",
    ],
    "murdey-surfboards": [
        "http://static1.squarespace.com/static/54b78a9ee4b0bf25db7a1d6e/t/651c8b49af38786c8c8b1576/1696369481724/Murdey_LOGOsm.png?format=1500w",
    ],
    "roger-hinds-surfboards": [
        "https://images.squarespace-cdn.com/content/v1/537d86e9e4b0f85b733cf5c6/1650516697756-P7RU2DAGIQM1ZT2UK4BQ/RH-Circle-Logo-7501.png",
        "https://images.squarespace-cdn.com/content/v1/537d86e9e4b0f85b733cf5c6/1506370061533-2BP4BI0P20C0YAHPBWUW/RH-ClassicLogo-WHITE-Rect-2017-v2.png",
    ],
    "eleventh-street-surfboards": [
        "https://d13u9j8agx9kjs.cloudfront.net/7420_11street/logo/300px_images/11th-Street-Surfboards_1_300.png",
        "https://11thstreetsurfboards.com/admin/fm/source/7420_11street/logo/11th-Street-Surfboards-logo.png",
    ],
    "modern-surfboards": [
        "https://cdn.shopify.com/s/files/1/0459/1481/6670/files/logo-modern-blk.gif?v=1674779458",
        "https://cdn.shopify.com/s/files/1/0459/1481/6670/files/logo-modern-blk.gif",
    ],
}


def api_request(
    method: str,
    path: str,
    *,
    data: bytes | None = None,
    content_type: str | None = None,
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, bytes, dict[str, str]]:
    url = f"{SUPABASE_URL}{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "User-Agent": UA,
    }
    if content_type:
        headers["Content-Type"] = content_type
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def fetch_brands() -> list[dict]:
    status, body, _ = api_request(
        "GET",
        "/rest/v1/brands?select=slug,name,website_url,logo_url&order=name.asc",
    )
    if status != 200:
        raise RuntimeError(f"Failed to fetch brands: {status} {body[:200]!r}")
    return json.loads(body)


def http_get(url: str, *, timeout: int = 20) -> tuple[int, bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,image/*,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            ctype = resp.headers.get("Content-Type", "")
            return resp.status, resp.read(), ctype
    except urllib.error.HTTPError as e:
        return e.code, e.read() if e.fp else b"", e.headers.get("Content-Type", "")
    except Exception:
        return 0, b"", ""


class LogoCandidateParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__()
        self.base_url = base_url
        self.candidates: list[tuple[int, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            prop = (attr.get("property") or attr.get("name") or "").lower()
            content = attr.get("content", "")
            if prop in {"og:image", "og:image:url", "twitter:image"} and content:
                self.candidates.append((35, absolutize(self.base_url, content)))
            if prop == "og:logo" and content:
                self.candidates.append((90, absolutize(self.base_url, content)))
        if tag == "link":
            rel = attr.get("rel", "").lower()
            href = attr.get("href", "")
            if not href:
                return
            if "icon" in rel:
                score = 20
                if "apple-touch-icon" in rel:
                    score = 50
                self.candidates.append((score, absolutize(self.base_url, href)))
        if tag == "img":
            src = attr.get("src") or attr.get("data-src") or ""
            if "," in src and " " in src:
                src = src.split(",")[0].strip().split(" ")[0]
            if not src:
                return
            blob = " ".join(
                [
                    src,
                    attr.get("alt", ""),
                    attr.get("class", ""),
                    attr.get("id", ""),
                ]
            ).lower()
            score = 0
            if "logo" in blob:
                score = 85
            elif re.search(r"/(logo|brand)[-_/]", src.lower()):
                score = 75
            if score:
                if any(x in src.lower() for x in ("hero", "banner", "product", "board", "sale")):
                    score -= 35
                if "favicon" in src.lower() or "32x32" in src.lower():
                    score -= 40
                self.candidates.append((score, absolutize(self.base_url, src)))


def absolutize(base: str, href: str) -> str:
    if href.startswith("//"):
        return "https:" + href
    return urllib.parse.urljoin(base if base.endswith("/") else base + "/", href)


def domain_of(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def shopify_guesses(website: str) -> list[str]:
    host = domain_of(website)
    return [
        f"https://{host}/cdn/shop/files/logo.png",
        f"https://{host}/cdn/shop/files/Logo.png",
        f"https://{host}/cdn/shop/files/logo.svg",
        f"https://www.{host}/cdn/shop/files/logo.png",
        f"https://{host}/logo.png",
        f"https://{host}/logo.svg",
        f"https://{host}/assets/logo.png",
        f"https://{host}/images/logo.png",
        f"https://{host}/wp-content/uploads/logo.png",
    ]


def unique_keep_order(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def discover_logo_urls(website: str) -> list[str]:
    urls: list[str] = []
    status, body, _ = http_get(website)
    if status and 200 <= status < 400 and body:
        html = body.decode("utf-8", errors="ignore")
        parser = LogoCandidateParser(website)
        try:
            parser.feed(html)
        except Exception:
            pass
        ranked = sorted(parser.candidates, key=lambda x: -x[0])
        urls.extend([u for _, u in ranked])

        for match in re.findall(
            r"(?:https?:)?//[^\"'\s>]+/(?:cdn/shop/files|cdn/shop/products|wp-content/uploads)[^\"'\s>]*(?:logo|Logo|brand)[^\"'\s>]*\.(?:png|jpg|jpeg|webp|svg|gif)",
            html,
        ):
            urls.append(absolutize(website, match))

        for match in re.findall(
            r"https://(?:static\.wixstatic\.com|images\.squarespace-cdn\.com|static1\.squarespace\.com)[^\"'\s>]+",
            html,
        ):
            if any(k in match.lower() for k in ("logo", "signature", "brand")):
                urls.append(match)

    urls.extend(shopify_guesses(website))
    return unique_keep_order(urls)


def extension_for(url: str, content_type: str, data: bytes) -> str:
    path = urllib.parse.urlparse(url).path.lower()
    for ext in (".svg", ".webp", ".png", ".gif", ".jpg", ".jpeg"):
        if path.endswith(ext):
            return "jpg" if ext == ".jpeg" else ext[1:]
    ct = content_type.lower()
    if "svg" in ct:
        return "svg"
    if "webp" in ct:
        return "webp"
    if "gif" in ct:
        return "gif"
    if "jpeg" in ct or "jpg" in ct:
        return "jpg"
    if "png" in ct:
        return "png"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if b"<svg" in data[:500].lower():
        return "svg"
    return "png"


def looks_like_image(data: bytes, content_type: str) -> bool:
    if len(data) < 200:
        return False
    head = data[:200].lower()
    if b"<html" in head or b"<!doctype" in head:
        return False
    ct = content_type.lower()
    if ct and not any(x in ct for x in ("image/", "svg", "octet-stream", "binary")):
        if not (
            data[:8] == b"\x89PNG\r\n\x1a\n"
            or data[:3] == b"\xff\xd8\xff"
            or data[:4] == b"RIFF"
            or data[:6] in (b"GIF87a", b"GIF89a")
            or b"<svg" in data[:500].lower()
        ):
            return False
    if len(data) > 2_500_000:
        return False
    return True


def download_best_logo(slug: str, candidate_urls: list[str]) -> Path | None:
    for url in candidate_urls[:50]:
        status, data, ctype = http_get(url, timeout=15)
        if not (status and 200 <= status < 400):
            continue
        if not looks_like_image(data, ctype):
            continue
        ext = extension_for(url, ctype, data)
        path = OUT_DIR / f"{slug}.{ext}"
        path.write_bytes(data)
        if ext != "svg" and path.stat().st_size < 800:
            path.unlink(missing_ok=True)
            continue
        return path
    return None


def content_type_for_ext(ext: str) -> str:
    return {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")


def upload_and_update(slug: str, path: Path) -> str | None:
    ext = path.suffix.lstrip(".").lower()
    storage_path = f"logos/{slug}.{ext}"
    data = path.read_bytes()
    ctype = content_type_for_ext(ext)

    status, body, _ = api_request(
        "POST",
        f"/storage/v1/object/{BUCKET}/{storage_path}",
        data=data,
        content_type=ctype,
        extra_headers={"x-upsert": "true"},
    )
    if status not in (200, 201):
        print(f"  ❌ upload failed ({status}): {body[:200]!r}")
        return None

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"
    patch_body = json.dumps({"logo_url": public_url}).encode()
    status2, body2, _ = api_request(
        "PATCH",
        f"/rest/v1/brands?slug=eq.{urllib.parse.quote(slug)}",
        data=patch_body,
        content_type="application/json",
        extra_headers={"Prefer": "return=minimal"},
    )
    if status2 not in (200, 204):
        print(f"  ❌ db update failed ({status2}): {body2[:200]!r}")
        return None
    return public_url


def resolve_website(brand: dict) -> str | None:
    if brand["slug"] in KNOWN_WEBSITES:
        return KNOWN_WEBSITES[brand["slug"]]
    if brand.get("website_url"):
        return brand["website_url"].strip()
    return None


def main() -> None:
    brands = fetch_brands()
    missing = [b for b in brands if not (b.get("logo_url") or "").strip()]
    print(f"Found {len(missing)} brands missing logos\n")

    ok = 0
    fail: list[str] = []

    for brand in missing:
        slug = brand["slug"]
        name = brand["name"]
        print(f"→ {name} ({slug})")

        candidates: list[str] = []
        if slug in KNOWN_LOGOS:
            candidates.extend(KNOWN_LOGOS[slug])

        website = resolve_website(brand)
        if website:
            print(f"  site: {website}")
            candidates.extend(discover_logo_urls(website))
        else:
            print("  no website known")

        candidates = unique_keep_order(candidates)
        if not candidates:
            fail.append(name)
            print("  ❌ no candidates")
            continue

        path = download_best_logo(slug, candidates)
        if not path:
            fail.append(name)
            print("  ❌ download failed")
            continue

        print(f"  downloaded {path.name} ({path.stat().st_size / 1024:.1f}KB)")
        public_url = upload_and_update(slug, path)
        if public_url:
            ok += 1
            print(f"  ✅ {public_url}")
        else:
            fail.append(name)

    print(f"\nDone. Uploaded {ok}/{len(missing)}")
    if fail:
        print("Still missing:")
        for name in fail:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
