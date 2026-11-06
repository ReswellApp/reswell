# Performance Marketing Agent — Memory

## Brand Learnings
- Canonical product site: `https://www.reswell.app` (www primary; apex redirects). Marketing creatives also reference `reswell.com`.
- Headline GMS RPC: `marketplace_listing_confirmed_sale_stats` — confirmed checkout lines + tipped mark-as-sold listing prices; shipping excluded.
- Marketplace fee: **7%** of item price (`MARKETPLACE_FEE_PERCENT` in `lib/seller-fees.ts`); seller keeps 93%.
- Public lifetime stats (2026-11-06): **$111,874.63 GMS**, **396** items sold, **AOV $282.51**, ~**190+** live listings.
- Live pixels observed on homepage HTML: Google Ads `AW-18062254229` (purchase label `SbbZCJjTirUcEJXB4KRD`), Meta Pixel `3235180370002055`, OpenAI Ads `MTgkh5iHP4FrMGxqdRkGw9`, GA4 `G-58F75TGNXF`.
- `.env.example` purchase conversion label (`FsjrCPnlwbAcEJXB4KRD`) ≠ live label — flag for ops confirmation.
- Admin tools in product: `/admin/ads` (Google/Meta managers), `/admin/ad-sales` (first-party + GA4 attributed sales).
- Meta creative folders: `marketing/meta-ads/` (giveaway), `public/images/dropoff/meta-ads/`.

## User Preferences
[Not yet determined — will learn from interactions]

## Decision Log
- **2026-11-06:** Bootstrapped Adspirer brand workspace (`BRAND.md`, `STRATEGY.md`) from repo + public API because Adspirer MCP server was not available in the Cursor cloud agent (`MCP server does not exist: adspirer`). No spend-affecting actions taken. Audit goal: path to **$100k/mo GMS**.
