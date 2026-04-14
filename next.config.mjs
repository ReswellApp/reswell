import bundleAnalyzer from '@next/bundle-analyzer'

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
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // User listing + avatar photos (Supabase project subdomains)
      {
        protocol: 'https',
        hostname: '**.supabase.co',
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
      {
        protocol: 'https',
        hostname: 'www.sea.museum',
        pathname: '/**',
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
  async redirects() {
    return [
      { source: "/dashboard/purchases", destination: "/dashboard/orders", permanent: true },
      { source: "/dashboard/purchases/:id", destination: "/dashboard/orders/:id", permanent: true },
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
      { source: "/wetsuits", destination: "/boards", permanent: true },
      { source: "/wetsuits/:path*", destination: "/boards", permanent: true },
      { source: "/fins", destination: "/boards", permanent: true },
      { source: "/fins/:path*", destination: "/boards", permanent: true },
      { source: "/leashes", destination: "/boards", permanent: true },
      { source: "/leashes/:path*", destination: "/boards", permanent: true },
      { source: "/board-bags", destination: "/boards", permanent: true },
      { source: "/board-bags/:path*", destination: "/boards", permanent: true },
      { source: "/backpacks", destination: "/boards", permanent: true },
      { source: "/backpacks/:path*", destination: "/boards", permanent: true },
      { source: "/apparel-lifestyle", destination: "/boards", permanent: true },
      { source: "/apparel-lifestyle/:path*", destination: "/boards", permanent: true },
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
      { source: "/threads/new", destination: "/board-talk/new", permanent: true },
      { source: "/wax-room/new", destination: "/board-talk/new", permanent: true },
      { source: "/threads/:slug", destination: "/board-talk/:slug", permanent: true },
      { source: "/wax-room/:slug", destination: "/board-talk/:slug", permanent: true },
      { source: "/threads", destination: "/board-talk", permanent: true },
      { source: "/wax-room", destination: "/board-talk", permanent: true },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
