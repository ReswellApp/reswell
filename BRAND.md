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
**Public lifetime GMS (as of audit pull via `GET /api/feed/sold-stats` on www.reswell.app):**

| Metric | Value | Notes |
|--------|-------|-------|
| Lifetime GMS | **$111,874.63** | Headline marketplace GMS |
| Lifetime items sold | **396** | Confirmed + tipped sales per RPC |
| Lifetime blended AOV | **$282.51** | `$111,874.63 / 396` |
| Active listings | **~190+** | About page live count |
| Monthly GMS | **Unavailable** | Needs admin insights or DB |
| Ad spend / CTR / CPA / ROAS | **Unavailable** | Adspirer MCP not registered in this cloud agent |

| Platform | Campaigns | Monthly Spend | CTR | CPA | ROAS |
|----------|-----------|---------------|-----|-----|------|
| Google Ads | — | — | — | — | — |
| Meta Ads | — | — | — | — | — |
| ChatGPT Ads | — | — | — | — | — |

## Key Findings from Existing Campaigns
- In-repo Meta giveaway creatives (`marketing/meta-ads/`) — brand/hook/how-to-enter assets; no performance CSV in repo.
- Dropoff Meta carousel assets under `public/images/dropoff/meta-ads/`.
- Admin surfaces exist for first-party + GA4 ad-attributed sales (`/admin/ad-sales`) and Google/Meta Ads Manager (`/admin/ads`) — live numbers require production credentials.
- Tracking stack is mature in code (Google purchase conversion with `transaction_id`, Meta pixel+CAPI dedup via `event_id`, OpenAI `order_created`, first-party `order_ad_attribution`). Live health (pixels firing correctly in Events Manager / Google Ads) **not audited** — `audit_conversion_tracking` requires Adspirer.

## Competitors
- Facebook Marketplace, Craigslist, Boardal (explicit in About copy)
- Broader: local shop trade-ins, Facebook groups, OfferUp / eBay (not named in About)

## Seasonality
Not documented. Surf retail is typically seasonal by region/hemisphere; treat as gap until admin monthly GMS series is pulled.

## Notes
- Gaps: no brand voice guide; no budget; no monthly GMS in public API; Adspirer MCP server not available in this Cursor cloud agent (`MCP server does not exist: adspirer`).
- Known constraints:
  - Conversion action primary/secondary setup is configured manually in Google Ads UI (not via Adspirer MCP). Repo `.env.example` already warns: keep purchase as primary EVENT conversion; demote page_view / ATC / begin_checkout / auto-created to Secondary.
  - Live purchase conversion label (`SbbZCJjTirUcEJXB4KRD`) differs from `.env.example` (`FsjrCPnlwbAcEJXB4KRD`) — confirm which is intentional.
  - Canonical host is `www.reswell.app` (apex redirects).

## Strategy
Active strategy directives are maintained in `STRATEGY.md`. All skills and agents read that file before campaign creation, keyword research, and ad copy generation.
