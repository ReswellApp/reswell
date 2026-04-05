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
      { source: "/saved", destination: "/favorites", permanent: true },
      { source: "/dashboard/reports", destination: "/dashboard", permanent: true },
      { source: "/dashboard/reports/:path*", destination: "/dashboard", permanent: true },
      { source: "/admin/reports", destination: "/admin", permanent: true },
      { source: "/admin/reports/:path*", destination: "/admin", permanent: true },
      // Legacy /used/* URLs → flat marketplace routes + /gear
      {
        source: "/used/checkout/success",
        destination: "/checkout/listing/success",
        permanent: true,
      },
      {
        source: "/used/:id/checkout",
        destination: "/checkout/listing?listing=:id",
        permanent: true,
      },
      { source: "/used", destination: "/gear", permanent: true },
      { source: "/used/:path*", destination: "/:path*", permanent: true },
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
