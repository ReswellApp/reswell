import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

// No-op comment: trigger a fresh deploy after Vercel env changes.

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
      // Shopify storefront product images
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/**',
      },
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
      { source: "/shop/cart", destination: "/cart", permanent: true },
      { source: "/shop/checkout/success", destination: "/checkout/success", permanent: true },
      { source: "/shop/checkout", destination: "/checkout", permanent: true },
      // `/index` is often treated like the site root; canonical directory lives at `/directory`.
      { source: "/index", destination: "/directory", permanent: true },
      { source: "/index/:path*", destination: "/directory/:path*", permanent: true },
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
