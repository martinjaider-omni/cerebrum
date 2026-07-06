/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'node-vibrant', 'playwright-core', '@playwright/browser-chromium'],
  },
}

export default nextConfig
