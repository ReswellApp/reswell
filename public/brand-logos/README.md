# Brand Logos

Staging copies of brand logos sourced from official brand / distributor sites.
Canonical copies live in Supabase Storage (`brand-assets/logos/{slug}.*`) and are
referenced by `brands.logo_url`.

## Upload

```bash
# Backfill missing logos (download + upload + DB update)
python3 scripts/backfill-missing-brand-logos.py

# Or upload files already in this folder
npx tsx scripts/upload-brand-logos.ts
```

Requires `NEXT_PUBLIC_SUPABASE_URL` / `Next_Public_Supabase_Url` and
`SUPABASE_SERVICE_ROLE_KEY` / `Supabase_Service_Role_Key`.

## Notes

- Prefer official brand CDN assets (Shopify / Squarespace / brand sites).
- Do not use retailer chrome, favicons, or unrelated shop logos.
- Some niche softboard / fin brands still lack discoverable official logos.
