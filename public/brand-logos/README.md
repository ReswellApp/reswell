# Brand Logos

This folder contains brand logos downloaded from official brand websites for use in the Reswell brands directory.

## Logos Included

- **Bing Surfboards** - bing-logo.png (18KB)
- **Chilli Surfboards** - chilli-logo.png (2.3KB)
- **DHD Surfboards** - dhd-logo.png (9.7KB)
- **Hayden Shapes** - haydenshapes-logo.png (7KB)
- **Lost Surfboards** - lost-logo.jpg (63KB)
- **Lovelace Machine** - lovelace-logo.png (217KB)
- **Pyzel Surfboards** - pyzel-logo.png (36KB)
- **Roberts Surfboards** - roberts-logo.png (3.2KB)
- **SharpEye Surfboards** - sharpeye-logo.png (51KB)

## Logos Still Using External URLs

The following brands still reference external CDN URLs (region-locked or require specific headers):

- **Album Surf** - Using Shopify CDN
- **Channel Islands Surfboards** - Region selection required
- **JS Industries** - Region selection required

## Uploading to Supabase

To upload these logos to Supabase storage and update the database:

1. Ensure you have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local`
2. Run: `npx tsx scripts/upload-brand-logos.ts`

The script will:
- Upload logos to the `brand-assets` storage bucket under `logos/`
- Update each brand's `logo_url` in the database to point to the Supabase storage URL
- Handle existing files by removing and re-uploading

## Sources

All logos were downloaded from the brands' official websites between August 2026:

- Bing: https://bingsurf.com
- Chilli: https://www.chillisurfboards.com
- DHD: https://dhdsurf.com (2025 modern logo)
- Hayden Shapes: https://www.haydenshapes.com (2026 logo)
- Lost: https://lostsurfboards.net
- Lovelace: https://lovemachinesurfboards.com
- Pyzel: https://pyzelsurfboards.com
- Roberts: https://www.robertssurf.com
- SharpEye: https://sharpeyesurfboards.com
