import type { NextConfig } from 'next'

const demo = process.env.WARDEN_DEMO === '1'

const nextConfig: NextConfig = {
  // The demo (fixture data) runs as a separate instance, so it needs its own build dir.
  distDir: demo ? '.next-demo' : '.next',
  transpilePackages: ['@warden/decoder', '@warden/engine'],
  serverExternalPackages: ['@electric-sql/pglite'],
  env: { NEXT_PUBLIC_WARDEN_DEMO: demo ? '1' : '0' },
  async rewrites() {
    return [{ source: '/v1/:path*', destination: '/api/v1/:path*' }]
  },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
}

export default nextConfig
