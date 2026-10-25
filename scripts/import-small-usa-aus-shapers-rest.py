#!/usr/bin/env python3
"""REST import for daily small USA/Australia surfboard catalog seeds."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SEED = Path(
    "/workspace/scripts/data/surfboard-catalog-seed/small-usa-aus-shapers-2026-08-19-daily.json"
)
SUPABASE = "https://lqwsewptsirsglasnwmn.supabase.co"


def client():
    key = os.environ.get("Supabase_Service_Role_Key") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise SystemExit("Missing Supabase service role key")
    return SUPABASE, key


def request(method: str, path: str, key: str, *, body=None, prefer: str | None = None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{SUPABASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read().decode()
            return resp.getcode(), json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode()
        raise RuntimeError(f"{method} {path} -> {exc.code}: {detail}") from exc


def main() -> None:
    _, key = client()
    seed = json.loads(SEED.read_text())
    brands = seed["brands"]
    created_brands = 0
    existing_brands = 0
    created_models = 0
    skipped_models = 0
    errors: list[str] = []

    for brand in brands:
        slug = brand["slug"]
        _, found = request("GET", f"/rest/v1/brands?slug=eq.{slug}&select=id,model_count", key)
        if found:
            brand_id = found[0]["id"]
            existing_brands += 1
        else:
            _, inserted = request(
                "POST",
                "/rest/v1/brands",
                key,
                body={
                    "slug": slug,
                    "name": brand["name"],
                    "short_description": brand.get("short_description"),
                    "website_url": brand.get("website_url"),
                    "logo_url": brand.get("logo_url"),
                    "founder_name": brand.get("founder_name"),
                    "lead_shaper_name": brand.get("lead_shaper_name"),
                    "location_label": brand.get("location_label"),
                    "model_count": 0,
                    "about_paragraphs": [],
                },
                prefer="return=representation",
            )
            brand_id = inserted[0]["id"]
            created_brands += 1

        try:
            request(
                "POST",
                "/rest/v1/brand_product_categories",
                key,
                body={"brand_id": brand_id, "category_slug": "surfboards"},
                prefer="return=minimal",
            )
        except RuntimeError as exc:
            if "23505" not in str(exc):
                errors.append(f"{slug} category: {exc}")

        for model in brand["models"]:
            name = model["name"].strip()
            _, existing = request(
                "GET",
                f"/rest/v1/brand_models?brand_id=eq.{brand_id}&name=eq.{urllib.parse.quote(name)}&select=id",
                key,
            )
            if existing:
                skipped_models += 1
                continue
            try:
                request(
                    "POST",
                    "/rest/v1/brand_models",
                    key,
                    body={
                        "brand_id": brand_id,
                        "name": name,
                        "description": model.get("description"),
                        "image_url": model.get("image_url"),
                        "product_category_slug": "surfboards",
                    },
                    prefer="return=minimal",
                )
                created_models += 1
            except RuntimeError as exc:
                if "23505" in str(exc):
                    skipped_models += 1
                else:
                    errors.append(f"{slug}/{name}: {exc}")

        _, models = request(
            "GET",
            f"/rest/v1/brand_models?brand_id=eq.{brand_id}&select=id",
            key,
        )
        request(
            "PATCH",
            f"/rest/v1/brands?id=eq.{brand_id}",
            key,
            body={"model_count": len(models or [])},
            prefer="return=minimal",
        )
        print(json.dumps({"brand": slug, "id": brand_id, "models": len(brand["models"])}))

    print(
        json.dumps(
            {
                "done": True,
                "created_brands": created_brands,
                "existing_brands": existing_brands,
                "created_models": created_models,
                "skipped_models": skipped_models,
                "errors": errors[:20],
            },
            indent=2,
        )
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
