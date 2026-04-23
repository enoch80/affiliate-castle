/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { serverComponentsExternalPackages: ['puppeteer','canvas','sharp'] }
}
module.exports = nextConfig
