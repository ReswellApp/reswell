# Performance Marketing Agent — Memory

## Brand Learnings
- Canonical product site: `https://www.reswell.app` (www primary; apex redirects). Marketing creatives also reference `reswell.com`.
- Headline GMS RPC: `marketplace_listing_confirmed_sale_stats` — confirmed checkout lines + tipped mark-as-sold listing prices; shipping excluded.
- Marketplace fee: **7%** of item price (`MARKETPLACE_FEE_PERCENT` in `lib/seller-fees.ts`); seller keeps 93%.
- Public lifetime stats (2026-11-06): **$111,874.63 GMS**, **396** items sold, **AOV $282.51**, ~**190+** live listings.
- Sold-feed rebuild (same day): 395 sale lines, **$118,542** feed GMS, surfboard AOV **$484**, fins AOV **$68**. L30d **~$27.6k** GMS; Oct peak **~$29.4k**. Growth plateaued Sep→Oct.
- Seller concentration: Hayden Garfield’s shop **65%** of feed GMS; **48** unique sellers lifetime.
- Path to $100k/mo ≈ **3.6×** current run-rate; at $484 board AOV needs ~**207** board sales/mo (~7/day) vs ~47–64 in peak months.
- Live pixels observed on homepage HTML: Google Ads `AW-18062254229` (purchase label `SbbZCJjTirUcEJXB4KRD`), Meta Pixel `3235180370002055`, OpenAI Ads `MTgkh5iHP4FrMGxqdRkGw9`, GA4 `G-58F75TGNXF`.
- `.env.example` purchase conversion label (`FsjrCPnlwbAcEJXB4KRD`) ≠ live label — flag for ops confirmation.
- Admin tools in product: `/admin/ads` (Google/Meta managers), `/admin/ad-sales` (first-party + GA4 attributed sales).
- Meta creative folders: `marketing/meta-ads/` (giveaway), `public/images/dropoff/meta-ads/`.
- Adspirer MCP not available in this cloud agent — cannot pull spend/ROAS/CPA or run `audit_conversion_tracking`.

## User Preferences
[Not yet determined — will learn from interactions]

## Decision Log
- **2026-11-06:** Bootstrapped Adspirer brand workspace (`BRAND.md`, `STRATEGY.md`) from repo + public API because Adspirer MCP server was not available in the Cursor cloud agent (`MCP server does not exist: adspirer`). No spend-affecting actions taken. Audit goal: path to **$100k/mo GMS**. Enriched with full sold-feed monthly series the same day.
