# Reswell — Paid Media Workspace

## Brand Overview
Reswell is a nationwide peer-to-peer surfboard and surf-gear marketplace (canonical site: `https://www.reswell.app`; marketing creatives also use `reswell.com`). Buyers and sellers list used (and some new) boards and gear with built-in shipping and Purchase Protection on Reswell checkout. Based in Santa Barbara; founders Hayden Garfield and David Kalt (Reverb / Pangobooks). Competitors called out in product copy: Facebook Marketplace, Boardal, Craigslist.

**GMS definition (admin / public headline):** confirmed checkout merchandise (item price × qty, including in-stock brand-new quantities) plus listing prices of sold listings with a succeeded seller tip — no double-count. Shipping is excluded from GMS. Source: `marketplace_listing_confirmed_sale_stats` + `lib/seller-fees.ts`.

**Take rate:** 7% marketplace fee on item (listing) price; seller keeps 93%. Shipping is buyer-paid and not fee'd. Stripe processing absorbed by Reswell. Some sellers may have fee waived (Reswell Seller program).

## Brand Voice
No dedicated brand-voice guide in-repo. Observed tone from About / Meta giveaway creatives / help copy:
- Direct, surfer-native, trust-forward
- Emphasize nationwide reach, shipping, Purchase Protection, focused marketplace (not FB Marketplace)
- Avoid flashy marketplace hype; founders frame the brand as early and honest

Add guidelines to this folder to improve ad copy quality.

## Target Audiences
- Surfers who know what they want and have thin local inventory (nationwide demand)
- Power buyers/sellers rotating quivers or selling as a side hustle
- Sellers who want reach beyond local pickup
- Buyers/sellers who care about checkout trust / Purchase Protection

Platform targeting parameters: not available (Adspirer MCP not connected in this environment). In-product Meta catalog labels include Shipping, Gear, city labels (Santa Barbara / Ventura), and shop custom labels (HaydenGarfield, OutSurfing, Brownstone, Jyeejr).

## Active Platforms
Status from **code + live site HTML** (not Adspirer connections):

| Platform | Product integration | Live site evidence (2026-11-06) | Adspirer connection |
|----------|---------------------|----------------------------------|---------------------|
| Google Ads | Site tag + purchase conversion + admin Ads Manager API | `AW-18062254229`; purchase send_to `AW-18062254229/SbbZCJjTirUcEJXB4KRD`; GA4 `G-58F75TGNXF` | **Unknown — MCP unavailable** |
| Meta Ads | Pixel + CAPI + catalog feed + admin Ads Manager | Pixel `3235180370002055` (PageView); creatives in `marketing/meta-ads/` | **Unknown — MCP unavailable** |
| ChatGPT / OpenAI Ads | Measurement pixel + catalog feed | Pixel `MTgkh5iHP4FrMGxqdRkGw9` | **Unknown — MCP unavailable** |
| Klaviyo | Flows, onsite, catalog feed | Company ID in `.env.example`: `RvZrDu` (not verified in initial HTML; likely consent-gated) | **Unknown — MCP unavailable** |
| LinkedIn Ads | No integration found | — | Not connected / N/A |
| TikTok Ads | No ads integration found | — | Not connected / N/A |
| Amazon Ads | No integration found | — | Not connected / N/A |

First-party attribution (`lib/ads/attribution.ts`) classifies: `google_ads`, `meta_ads`, `meta_referral`, `other` (gclid / fbclid / paid UTMs; 90-day cookie).

## Budget & Guardrails
- Monthly total: **Not specified — ask user**
- Platform allocation: unknown (no live spend data)
- Max CPC / Target CPA / Min ROAS: not specified
- Economics guardrail: at 7% take, **$100k GMS ≈ $7,000 platform fee revenue** before Stripe costs, fee waivers, refunds, and tip revenue

## KPI Targets
- Primary growth goal (this audit): **$100,000 / month GMS**
- Secondary: platform revenue (fees + seller tips), AOV, sell-through, new listings, new users
- Ad efficiency targets: not specified — ask user

## Current Performance Snapshot
**As of 2026-11-06 (America/Los_Angeles).** Official lifetime from `GET /api/feed/sold-stats`. Monthly / trailing from public sold-feed sale lines (`soldPrice` × sale; 395 lines — $118,542 sum; methodology differs slightly from official RPC).

| Metric | Value | Notes |
|--------|-------|-------|
| Lifetime GMS (official) | **$111,874.63** | 396 items sold |
| Lifetime blended AOV (official) | **$282.51** | `$111,875 / 396` |
| Sold-feed GMS (trend source) | **$118,541.98** | 395 sale lines; surfboard AOV **$484.15** |
| Live inventory | **190+** | About page |
| Unique selling shops (lifetime feed) | **48** | Top shop **65.3%** of feed GMS |
| L30d GMS | **$27,625** | 101 orders · run-rate ≈ current month pace |
| L60d / L90d run-rate | **~$28.2k / ~$27.0k** | Growth **plateaued** since Sep |
| Peak calendar month | **Oct 2026 ~$29.4k** | Sep ~$28.6k · Aug ~$22.6k |
| Ad spend / CTR / CPA / ROAS | **Unavailable** | Adspirer MCP not registered in this cloud agent |

### Monthly GMS (sold feed, PT calendar months)

| Month | GMS | Orders | AOV | Surfboard GMS | Surfboard orders |
|-------|-----|--------|-----|---------------|------------------|
| 2026-05 | $8,390 | 14 | $599 | $8,390 | 14 |
| 2026-06 | $9,686 | 29 | $334 | $8,921 | 16 |
| 2026-07 | $14,209 | 44 | $323 | $13,110 | 26 |
| 2026-08 | $22,637 | 88 | $257 | $20,420 | 47 |
| 2026-09 | $28,555 | 101 | $283 | $26,145 | 64 |
| 2026-10 | $29,427 | 97 | $303 | $26,145 | 47 |
| 2026-11 (partial through Nov 6) | $4,313 | 19 | $227 | $3,510 | 6 |

### Category mix (lifetime sold feed)
- Surfboards: **$107,966** (91% of feed GMS) · 223 orders · AOV $484
- Fins: **$9,359** · 137 orders · AOV $68
- All other gear: **<$1.3k** combined

## Key Findings from Existing Campaigns
- In-repo Meta giveaway creatives (`marketing/meta-ads/`) — brand/hook/how-to-enter assets; no performance CSV in repo.
- Dropoff Meta carousel assets under `public/images/dropoff/meta-ads/`.
- Admin surfaces exist for first-party + GA4 ad-attributed sales (`/admin/ad-sales`) and Google/Meta Ads Manager (`/admin/ads`) — live numbers require production credentials.
- Tracking stack is mature in code (Google purchase conversion with `transaction_id`, Meta pixel+CAPI dedup via `event_id`, OpenAI `order_created`, first-party `order_ad_attribution`). Live health **not audited** — `audit_conversion_tracking` requires Adspirer.
- **Growth constraint:** Sep→Oct GMS flat (~$28–29k). Path to $100k is **~3.6×** current run-rate, not a small optimization.

## Competitors
- Facebook Marketplace, Craigslist, Boardal (explicit in About copy)
- Broader: local shop trade-ins, Facebook groups, OfferUp / eBay (not named in About)

## Seasonality
Not documented. Sold-feed months show spring ramp (May) through summer/fall peak; treat regional surf seasonality as a gap until admin monthly series + ad seasonality are pulled.

## Notes
- Gaps: no brand voice guide; no budget; Adspirer MCP server not available in this Cursor cloud agent (`MCP server does not exist: adspirer`).
- Known constraints:
  - Conversion action primary/secondary setup is configured manually in Google Ads UI (not via Adspirer MCP). Repo `.env.example` already warns: keep purchase as primary EVENT conversion; demote page_view / ATC / begin_checkout / auto-created to Secondary.
  - Live purchase conversion label (`SbbZCJjTirUcEJXB4KRD`) differs from `.env.example` (`FsjrCPnlwbAcEJXB4KRD`) — confirm which is intentional.
  - Canonical host is `www.reswell.app` (apex redirects).
  - Sold-feed GMS ≠ official sold-stats GMS (price/qty methodology); use sold-stats for headline, sold-feed for trend shape.

## Strategy
Active strategy directives are maintained in `STRATEGY.md`. All skills and agents read that file before campaign creation, keyword research, and ad copy generation.
