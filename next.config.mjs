import path from 'path'
import fs from 'node:fs'
import { fileURLToPath } from 'url'
import bundleAnalyzer from '@next/bundle-analyzer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const siteWordmarkSvgPath = path.join(__dirname, 'public', 'images', 'reswell-logo.svg')

/** Enables `<img src="/images/reswell-logo.svg">` in the site chrome; component falls back on error to raster. */
function siteWordmarkVectorEnabled() {
  try {
    const st = fs.statSync(siteWordmarkSvgPath)
    return st.isFile() && st.size >= 96
  } catch {
    return false
  }
}

const NEXT_PUBLIC_SITE_WORDMARK_USE_VECTOR_SVG = siteWordmarkVectorEnabled()
  ? 'true'
  : 'false'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// No-op comment: trigger a fresh deploy after Vercel env changes.

/** Hostnames for next/image in brand profiles (logos and art from brand sites / CDNs). */
const brandCatalogImageHosts = [
  'albumsurf.com',
  'bingsurf.com',
  'cisurfboards.com',
  'd3iswawdztsslu.cloudfront.net',
  'dhdsurf.com',
  'i.vimeocdn.com',
  'i.ytimg.com',
  'ianc57.sg-host.com',
  'instafeed.nfcube.com',
  'lostsurfboards.net',
  'lovemachinesurfboards.com',
  'pyzelsurfboards.com',
  'scontent.cdninstagram.com',
  'sharpeyesurfboards.com',
  'us.jsindustries.com',
  'www.chillisurfboards.com',
  'www.haydenshapes.com',
  'www.robertssurf.com',
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['exceljs', 'archiver'],
  outputFileTracingIncludes: {
    '/app/api/admin/facebook-marketplace-bulk/export/route': [
      './lib/facebook-marketplace/templates/**',
    ],
  },
  env: {
    NEXT_PUBLIC_SITE_WORDMARK_USE_VECTOR_SVG,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Required to support PostHog trailing-slash API requests.
  skipTrailingSlashRedirect: true,
  images: {
    // Default is 'attachment', which sets Content-Disposition on /_next/image so
    // opening or sharing those URLs downloads the file instead of showing it in-tab.
    contentDispositionType: 'inline',
    // Allowlisted `quality` values for `<Image />` — required in Next.js 16+.
    // Include 75 for components that omit `quality` (Next default).
    qualities: [72, 75, 80, 88, 90, 92, 95, 100],
    // Supabase Storage objects and brand-CDN assets are immutable per-URL, so we
    // can safely keep optimized variants in Vercel's edge cache for a long time.
    // Default is 60s which forces a re-optimization roughly every page load and
    // floods logs with `/_next/image` requests.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      // User listing + avatar photos (Supabase project subdomains)
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Custom domain for the same Supabase Storage public bucket (some DB rows use this host)
      {
        protocol: 'https',
        hostname: 'app.reswell.app',
        pathname: '/storage/v1/object/public/**',
      },
      // Admin sell-form “Fill seed listing” placeholder photos (picsum)
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      // Index / brand image URLs (Shopify CDN + custom domains with /cdn/shop/)
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
      ...brandCatalogImageHosts.map((hostname) => ({
        protocol: 'https',
        hostname,
        pathname: '/**',
      })),
      // Press / collections assets
      {
        protocol: 'https',
        hostname: 'images.squarespace-cdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cms-web.seamuseum.net',
        pathname: '/**',
      },
      // Blog / editorial covers
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      // Maps Static API previews (conversation location pins — same GCP key as Places)
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/**',
      },
    ],
  },
  experimental: {
    // Tree-shake icon/component libraries so only imported symbols end up in the
    // bundle — biggest win for lucide-react (hundreds of icons) and Radix UI.
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
    ],
  },
  async headers() {
    // Static marketing photos (content-hashed via next/image imports; public path
    // still needs long Cache-Control for direct hits). Swap file → new deploy/hash busts cache.
    const staticMarketingImageCacheControl =
      'public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=86400'

    const categoryBrowseAtmosphereImages = [
      '/images/brand/boards-browse-barrel.jpg',
      '/images/brand/fiji-underboard.jpg',
      '/images/brand/wetsuits-browse-atmosphere.jpg',
      '/images/brand/apparel-browse-atmosphere.jpg',
    ]

    return [
      {
        source: '/images/home/hero-backdrop-mesa-v2.jpg',
        headers: [{ key: 'Cache-Control', value: staticMarketingImageCacheControl }],
      },
      {
        source: '/images/home/hero-backdrop-tahiti.jpg',
        headers: [{ key: 'Cache-Control', value: staticMarketingImageCacheControl }],
      },
      ...categoryBrowseAtmosphereImages.map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: staticMarketingImageCacheControl }],
      })),
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
          },
        ],
      },
    ]
  },
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")

    // Derive PostHog asset host from the ingest host env var.
    const posthogIngestHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').replace(/\/$/, '')
    const posthogAssetsHost = posthogIngestHost
      .replace('us.i.posthog.com', 'us-assets.i.posthog.com')
      .replace('eu.i.posthog.com', 'eu-assets.i.posthog.com')
    const posthogAfterFiles = posthogIngestHost
      ? [
          { source: '/ingest/static/:path*', destination: `${posthogAssetsHost}/static/:path*` },
          { source: '/ingest/array/:path*', destination: `${posthogAssetsHost}/array/:path*` },
          { source: '/ingest/:path*', destination: `${posthogIngestHost}/:path*` },
        ]
      : []

    // Static listing photos: edge-rewrite to Supabase public objects so Google Merchant /
    // Googlebot-Image fetch a direct image file instead of a serverless resize handler.
    // Requests with ?variant= still hit app/media/listings/[...path]/route.ts.
    return {
      beforeFiles: supabaseUrl
        ? [
            {
              source: "/media/listings/:path*",
              missing: [{ type: "query", key: "variant" }],
              destination: `${supabaseUrl}/storage/v1/object/public/listings/:path*`,
            },
          ]
        : [],
      afterFiles: posthogAfterFiles,
    }
  },
  async redirects() {
    return [
      { source: "/dashboard/orders", destination: "/dashboard/purchases", permanent: true },
      { source: "/dashboard/orders/:id", destination: "/dashboard/purchases/:id", permanent: true },
      { source: "/dashboard/claims", destination: "/dashboard", permanent: true },
      { source: "/dashboard/claims/:path*", destination: "/dashboard", permanent: true },
      { source: "/dashboard/disputes", destination: "/dashboard", permanent: true },
      { source: "/dashboard/disputes/:path*", destination: "/dashboard", permanent: true },
      { source: "/dashboard/sales/disputes", destination: "/dashboard/sales", permanent: true },
      { source: "/dashboard/sales/disputes/:path*", destination: "/dashboard/sales", permanent: true },
      { source: "/admin/disputes", destination: "/admin", permanent: true },
      { source: "/admin/disputes/:path*", destination: "/admin", permanent: true },
      { source: "/admin/collection-requests", destination: "/admin", permanent: true },
      { source: "/admin/collection-requests/:path*", destination: "/admin", permanent: true },
      {
        source: "/dashboard/listings/:id/offer-settings",
        destination: "/dashboard/listings",
        permanent: true,
      },
      { source: "/admin/claims", destination: "/admin", permanent: true },
      { source: "/admin/claims/:path*", destination: "/admin", permanent: true },
      // /offers/foo → hub; exact /offers is app/offers/page.tsx (redirects must not steal :path* from bare /offers)
      { source: "/offers/:path+", destination: "/dashboard/offers", permanent: true },
      { source: "/listings", destination: "/dashboard/listings", permanent: true },
      { source: "/saved", destination: "/favorites", permanent: true },
      { source: "/dashboard/reports", destination: "/dashboard", permanent: true },
      { source: "/dashboard/reports/:path*", destination: "/dashboard", permanent: true },
      { source: "/admin/reports", destination: "/admin", permanent: true },
      { source: "/admin/reports/:path*", destination: "/admin", permanent: true },
      // Legacy /used/* URLs → flat marketplace routes + /gear
      {
        source: "/used/checkout/success",
        destination: "/checkout/success",
        permanent: true,
      },
      {
        source: "/used/:id/checkout",
        destination: "/checkout?listing=:id",
        permanent: true,
      },
      { source: "/used", destination: "/boards", permanent: true },
      { source: "/used/:path*", destination: "/boards", permanent: true },
      { source: "/gear", destination: "/boards", permanent: true },
      { source: "/gear/:path*", destination: "/boards", permanent: true },
      { source: "/categories", destination: "/boards", permanent: true },
      { source: "/categories/:path*", destination: "/boards", permanent: true },
      { source: "/board-bags", destination: "/boardbags", permanent: true },
      { source: "/board-bags/:path*", destination: "/boardbags", permanent: true },
      { source: "/backpacks", destination: "/surfpacks", permanent: true },
      { source: "/backpacks/:path*", destination: "/surfpacks", permanent: true },
      { source: "/apparel-lifestyle", destination: "/apparel", permanent: true },
      { source: "/apparel-lifestyle/:path*", destination: "/apparel", permanent: true },
      { source: "/collectibles-vintage", destination: "/boards", permanent: true },
      { source: "/collectibles-vintage/:path*", destination: "/boards", permanent: true },
      { source: "/shop/cart", destination: "/cart", permanent: true },
      { source: "/shop/checkout/success", destination: "/checkout/success", permanent: true },
      { source: "/shop/checkout", destination: "/checkout", permanent: true },
      { source: "/index", destination: "/brands", permanent: true },
      { source: "/index/:path*", destination: "/brands", permanent: true },
      {
        source: "/directory/brands/:slug/models/:path*",
        destination: "/brands/:slug",
        permanent: true,
      },
      { source: "/directory/brands/:slug", destination: "/brands/:slug", permanent: true },
      { source: "/directory", destination: "/brands", permanent: true },
      { source: "/directory/:path*", destination: "/brands", permanent: true },
      { source: "/board-talk/new", destination: "/threads/new", permanent: true },
      { source: "/board-talk/:slug", destination: "/threads/:slug", permanent: true },
      { source: "/board-talk", destination: "/threads", permanent: true },
      { source: "/boardtalk/new", destination: "/threads/new", permanent: true },
      { source: "/boardtalk/:slug", destination: "/threads/:slug", permanent: true },
      { source: "/boardtalk", destination: "/threads", permanent: true },
      { source: "/wax-room/new", destination: "/threads/new", permanent: true },
      { source: "/wax-room/:slug", destination: "/threads/:slug", permanent: true },
      { source: "/wax-room", destination: "/threads", permanent: true },
      { source: "/threads/whats-new", destination: "/threads", permanent: true },
      { source: "/sell/quick", destination: "/sell/boards", permanent: true },
      { source: "/sell/quick/:path*", destination: "/sell/boards", permanent: true },
      { source: "/feed", destination: "/sold", permanent: true },
      { source: "/surfers", destination: "/", permanent: true },
      { source: "/surfers/:path*", destination: "/", permanent: true },
      // Do not add /FAQ → /faq: Next redirects are case-insensitive, so that rule loops on /faq.
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
