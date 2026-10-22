import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads go straight to Supabase Storage, so actions only carry JSON.
    serverActions: { bodySizeLimit: '1mb' },
  },
}

export default nextConfig
