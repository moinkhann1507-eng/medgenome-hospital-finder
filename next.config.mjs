/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow external images for Leaflet tiles
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tile.openstreetmap.org' },
      { protocol: 'https', hostname: 'a.tile.openstreetmap.org' },
      { protocol: 'https', hostname: 'b.tile.openstreetmap.org' },
      { protocol: 'https', hostname: 'c.tile.openstreetmap.org' },
    ],
  },
}

export default nextConfig
