/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'node-vibrant', 'playwright-core', '@sparticuz/chromium'],
  },
}

export default nextConfig
