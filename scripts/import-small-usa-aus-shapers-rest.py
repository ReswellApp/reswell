#!/usr/bin/env python3
"""
REST import for daily USA/Australia small-shaper seed.

Mirrors first-party logos and model photos into Supabase `brand-assets`,
then inserts `brands` + `brand_product_categories` + `brand_models`.
Skips existing slugs / model names. Surfboards category only.
"""
from __future__ import annotations

import hashlib
import json
import os
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

SEED = Path("/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-22.json")
CTX = ssl.create_default_context()
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

SUPABASE_API = "https://lqwsewptsirsglasnwmn.supabase.co"
BUCKET = "brand-assets"


def env_key() -> str:
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("Supabase_Service_Role_Key")
        or ""
    ).strip()
    if not key:
        raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY")
    return key


def rest(method: str, path: str, key: str, payload: dict | list | None = None, prefer: str | None = None) -> tuple[int, object]:
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": UA,
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(
        SUPABASE_API.rstrip("/") + path,
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=CTX) as resp:
            raw = resp.read()
            body = json.loads(raw.decode()) if raw else None
            return resp.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            body = json.loads(raw) if raw else {"error": raw}
        except json.JSONDecodeError:
            body = {"error": raw}
        return exc.code, body


def download(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=30, context=CTX) as resp:
        ctype = (resp.headers.get("content-type") or "application/octet-stream").split(";")[0]
        return resp.read(), ctype


def ext_for(url: str, ctype: str) -> str:
    ctype = ctype.lower()
    if "png" in ctype:
        return "png"
    if "webp" in ctype:
        return "webp"
    if "svg" in ctype:
        return "svg"
    if "jpeg" in ctype or "jpg" in ctype:
        return "jpg"
    path = url.split("?", 1)[0].lower()
    for ext in ("png", "webp", "jpg", "jpeg", "svg"):
        if path.endswith("." + ext):
            return "jpg" if ext == "jpeg" else ext
    return "jpg"


def upload_object(key: str, path_in_bucket: str, body: bytes, ctype: str) -> str:
    encoded = "/".join(quote(part, safe="") for part in path_in_bucket.split("/") if part)
    url = f"{SUPABASE_API}/storage/v1/object/{BUCKET}/{encoded}"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": ctype,
            "x-upsert": "true",
            "cache-control": "31536000",
            "User-Agent": UA,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=CTX) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        if exc.code not in (200, 201):
            raise RuntimeError(f"upload {path_in_bucket}: {exc.code} {raw[:200]}") from exc
    return f"{SUPABASE_API}/storage/v1/object/public/{BUCKET}/{encoded}"


def mirror(key: str, source_url: str, kind: str) -> str | None:
    try:
        body, ctype = download(source_url)
    except Exception as exc:
        print(f"    mirror fetch fail {source_url[:80]}: {exc}")
        return None
    if len(body) < 80:
        print(f"    mirror too small {source_url[:80]}")
        return None
    ext = ext_for(source_url, ctype)
    digest = hashlib.sha256(source_url.encode()).hexdigest()[:20]
    if kind == "logo":
        path = f"logos/daily-2026-08-22-{digest}.{ext}"
    else:
        path = f"board-models/mirror-{digest}.{ext}"
    try:
        return upload_object(key, path, body, ctype if ctype.startswith("image/") else f"image/{ext}")
    except Exception as exc:
        print(f"    mirror upload fail: {exc}")
        return None


def existing_brand(key: str, slug: str) -> dict | None:
    status, body = rest("GET", f"/rest/v1/brands?slug=eq.{quote(slug)}&select=id,slug,model_count", key)
    if status != 200 or not body:
        return None
    return body[0] if isinstance(body, list) and body else None


def existing_model_names(key: str, brand_id: str) -> set[str]:
    names: set[str] = set()
    offset = 0
    while True:
        status, body = rest(
            "GET",
            f"/rest/v1/brand_models?brand_id=eq.{brand_id}&select=name&limit=1000&offset={offset}",
            key,
        )
        if status != 200 or not isinstance(body, list) or not body:
            break
        for row in body:
            names.add((row.get("name") or "").casefold().strip())
        if len(body) < 1000:
            break
        offset += 1000
    return names


def ensure_category(key: str, brand_id: str) -> None:
    status, body = rest(
        "GET",
        f"/rest/v1/brand_product_categories?brand_id=eq.{brand_id}&category_slug=eq.surfboards&select=brand_id",
        key,
    )
    if status == 200 and isinstance(body, list) and body:
        return
    rest(
        "POST",
        "/rest/v1/brand_product_categories",
        key,
        {"brand_id": brand_id, "category_slug": "surfboards"},
        prefer="return=minimal",
    )


def refresh_count(key: str, brand_id: str) -> int:
    status, body = rest(
        "GET",
        f"/rest/v1/brand_models?brand_id=eq.{brand_id}&select=id",
        key,
        prefer="count=exact",
    )
    # Prefer header count via a second request if needed
    status2, rows = rest(
        "GET",
        f"/rest/v1/brand_models?brand_id=eq.{brand_id}&select=id",
        key,
    )
    count = len(rows) if isinstance(rows, list) else 0
    rest(
        "PATCH",
        f"/rest/v1/brands?id=eq.{brand_id}",
        key,
        {"model_count": count},
        prefer="return=minimal",
    )
    return count


def main() -> None:
    key = env_key()
    seed = json.loads(SEED.read_text())
    brands = seed["brands"]
    print(json.dumps({"seed": str(SEED), "brands": len(brands), "models": seed["summary"]["model_count"]}, indent=2))

    created_brands = 0
    existing_brands = 0
    created_models = 0
    skipped_models = 0
    errors: list[str] = []

    for brand in brands:
        slug = brand["slug"]
        found = existing_brand(key, slug)
        logo_url = None
        if brand.get("logo_url"):
            logo_url = mirror(key, brand["logo_url"], "logo") or brand["logo_url"]

        if found:
            brand_id = found["id"]
            existing_brands += 1
            print(f"EXISTING {slug} {brand_id}")
            if logo_url:
                rest(
                    "PATCH",
                    f"/rest/v1/brands?id=eq.{brand_id}",
                    key,
                    {"logo_url": logo_url},
                    prefer="return=minimal",
                )
        else:
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            payload = {
                "slug": slug,
                "name": brand["name"],
                "short_description": brand.get("short_description"),
                "website_url": brand.get("website_url"),
                "logo_url": logo_url,
                "founder_name": brand.get("founder_name"),
                "lead_shaper_name": brand.get("lead_shaper_name"),
                "location_label": brand.get("location_label"),
                "model_count": 0,
                "about_paragraphs": [],
                "updated_at": now,
            }
            status, body = rest("POST", "/rest/v1/brands", key, payload, prefer="return=representation")
            if status not in (200, 201) or not body:
                errors.append(f"{slug}: brand insert {status} {body}")
                print("FAIL brand", slug, status, body)
                continue
            brand_id = body[0]["id"] if isinstance(body, list) else body["id"]
            created_brands += 1
            print(f"CREATED {slug} {brand_id}")

        ensure_category(key, brand_id)
        have = existing_model_names(key, brand_id)
        for model in brand["models"]:
            name = (model.get("name") or "").strip()
            if not name:
                skipped_models += 1
                continue
            if name.casefold() in have:
                skipped_models += 1
                continue
            image_url = None
            if model.get("image_url"):
                image_url = mirror(key, model["image_url"], "model")
            row = {
                "brand_id": brand_id,
                "name": name,
                "description": (model.get("description") or "").strip() or None,
                "image_url": image_url,
                "product_category_slug": "surfboards",
            }
            status, body = rest("POST", "/rest/v1/brand_models", key, row, prefer="return=minimal")
            if status in (200, 201):
                created_models += 1
                have.add(name.casefold())
            elif status == 409:
                skipped_models += 1
            else:
                errors.append(f"{slug}/{name}: {status} {body}")
                print("  model fail", slug, name, status, body)
        count = refresh_count(key, brand_id)
        print(json.dumps({"brand": slug, "model_count": count, "created_models_so_far": created_models}))

    summary = {
        "done": True,
        "created_brands": created_brands,
        "existing_brands": existing_brands,
        "created_models": created_models,
        "skipped_models": skipped_models,
        "error_count": len(errors),
        "errors": errors[:20],
    }
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
