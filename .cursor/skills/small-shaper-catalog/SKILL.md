---
name: small-shaper-catalog
description: Fill Reswell's brands catalog with one small/indie surfboard shaper per run — official board models only. Use for scheduled Cursor automations or any request to discover/add small shaper brands and models.
---

# Small shaper catalog agent

One cloud run = **one** small surfboard shaper. Add or complete that brand and its **named surfboard models** only.

Read this file before scraping or writing to the database.

## Cursor automation (Hayden)

Create this at [cursor.com/automations](https://cursor.com/automations). This repo cannot register the automation by API.

| Setting | Value |
|---|---|
| Trigger | Scheduled, **once per day** (not hourly) |
| Repository | `ReswellApp/reswell` on `main` |
| Memories | On — remember completed slugs and skip reasons |
| Computer use | On (Squarespace/Shopify pages often need a real browser) |
| Tools | PR creation on. Do not enable Slack unless Hayden asks. |

**Prompt to paste:**

```
You are the Reswell small-shaper catalog agent.

Immediately read and follow `.cursor/skills/small-shaper-catalog/SKILL.md`.

Each run: pick ONE incomplete small surfboard shaper, scrape that shaper's official site, import only named surfboard models, commit a seed JSON, open a draft PR, then stop.

Never invent models. Never add fins, merch, SUPs, ding repair, or factory brands. Never run the importer without `--backfill /dev/null`. If there is no safe brand to do, exit with no PR.
```

## Hard rules

1. **One brand per run.** If the brand is unclear, stop.
2. **Surfboards only.** Skip fins, leashes, wetsuits, apparel, hats, ding repair, custom deposits, SUPs, foil boards, and accessories.
3. **Small/indie shapers only.** Independent shaper or small shaping bay with an official site. Skip factory/global brands listed in `scripts/data/surfboard-catalog-seed/small-shaper-catalog-skip-slugs.json`.
4. **Official source only.** Use the shaper's own site (Shopify, Squarespace, WordPress). Do not scrape retailers (e.g. Surfline, CCS, Amazon) or Instagram captions as the model list.
5. **Named production models only.** Skip "Custom", "Order deposit", "Ding repair", used boards, and one-off dimension SKUs (`2Cents EPS 5'6`).
6. **Do not overwrite good data.** `ensureBrand` does not replace filled website/location/founder fields. Do not delete existing models.
7. **Always** import with:
   `npx tsx scripts/import-core-shapers-catalog.ts --seed scripts/data/surfboard-catalog-seed/<slug>.json --backfill /dev/null`
8. **Draft PR** on `cursor/<slug>-models-780a` (or the current cloud branch prefix). Do not merge.
9. If photos 403 from datacenter IPs, keep the official image URL rather than inventing one. Do not upload HTML 404 pages as logos or photos.

## Pick the next brand

Run:

```bash
npx tsx scripts/list-incomplete-small-shaper-brands.ts
```

Pick the first candidate whose official site still has a public model list you have not already imported this week (check memories). Prefer existing `brands` rows with a website and few models over inventing a new brand.

Skip the row if:

- slug is in the skip file
- `website_url` is only Instagram/Facebook/TikTok (no scrapeable model list)
- it is clearly not a surfboard shaper (fin company, apparel, retailer)
- the official site has no named board models
- we already imported the full list (memories or `model_count` matches the live shop)

Do **not** wander the web creating random new brands unless the list script returns zero safe candidates. A new brand is allowed only when:

- it is a real independent surfboard shaper
- it has an official website with a model list
- it is not already in `brands` (check slug and name)
- you can fill `website_url`, location, and at least 3 named models with photos

## Scrape + seed

Follow the Barahona / 11th Street / Heinrich pattern:

- Collection or products JSON when the platform has it (`?format=json`, `/products.json`).
- One seed file: `scripts/data/surfboard-catalog-seed/<slug>.json`
- Shape: `{ "product_category_slug": "surfboards", "brands": [{ slug, name, website_url, location_label?, founder_name?, lead_shaper_name?, short_description?, models: [{ name, image_url, description?, board_category_slug? }] }] }`
- Prefer product-front photos, not action shots or dimension screenshots.
- Set `board_category_slug` when obvious (`longboard`, `shortboard`, `fish`, `hybrid`, `groveler`, `step-up-gun`, `asym`, `other`).

## After import

1. Confirm `brands.model_count` and that new `image_url` values are `brand-assets` (or a live official image if mirroring failed).
2. Commit only the seed JSON (and importer changes only if required for this brand).
3. Open a **draft** PR. Title like `Add <Brand> surfboard models to the catalog`.
4. Write the slug + model names into automation memories so the next run does not repeat it.
5. Stop. Do not start a second brand.

## Out of scope

- Logos (unless the brand has a broken HTML-as-PNG logo and Hayden asked)
- Listings, Elasticsearch backfills beyond what the importer already does
- Major-brand gap fills (`major-brands-gap-fill.json`)
- Fin catalogs
- Changing `.cursorrules`, auth, Stripe, or unrelated app code
