/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/threads/new", destination: "/wax-room/new", permanent: true },
      { source: "/threads/:slug", destination: "/wax-room/:slug", permanent: true },
      { source: "/threads", destination: "/wax-room", permanent: true },
    ]
  },
}

export default nextConfig
