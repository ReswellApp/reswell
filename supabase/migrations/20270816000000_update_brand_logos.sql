-- Update brand logos with proper logo URLs instead of product images

-- Update Channel Islands Surfboards logo (CI logo from their CDN)
UPDATE public.brands
SET logo_url = 'https://cisurfboards.com/cdn/shop/files/CI_LOGO_BLACK.png?v=1613157972'
WHERE slug = 'channel-islands-surfboards';

-- Update JS Surfboards logo to Traktor logo
UPDATE public.brands
SET logo_url = 'https://jsindustries.com/cdn/shop/files/JS-Logo.svg?v=1709804069'
WHERE slug = 'js-surfboards';

-- Update DHD Surfboards logo to 2025 modern logo
UPDATE public.brands
SET logo_url = 'https://dhdsurf.com/cdn/shop/files/DHD-Logo-2025.png?v=1732578705'
WHERE slug = 'dhd-surfboards';

-- Update Hayden Shapes logo to 2026 official logo
UPDATE public.brands
SET logo_url = 'https://www.haydenshapes.com/cdn/shop/files/HS-LOGO-2026.png?v=1785200609'
WHERE slug = 'hayden-shapes';

-- Update Lovelace Machine logo to proper white header logo
UPDATE public.brands
SET logo_url = 'https://lovemachinesurfboards.com/cdn/shop/files/lovemachine_WHITE_HEADER.png?v=1732061686'
WHERE slug = 'lovelace-machine';

COMMENT ON TABLE public.brands IS 'Surfboard brand profiles with updated logo URLs (August 2026)';
