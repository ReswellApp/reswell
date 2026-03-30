import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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
