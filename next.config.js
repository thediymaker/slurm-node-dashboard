const allowedDevOrigins = process.env.NEXT_PUBLIC_BASE_URL
    ? [new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname]
    : []

// Serve under a sub-path behind a reverse proxy, e.g. NEXT_PUBLIC_BASE_PATH=/slurm/cluster1.
// Read at build time; trailing slashes are dropped and a leading one added.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "")
    .replace(/\/+$/, "")
    .replace(/^(?=[^/])/, "/")

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    basePath,
    env: {
        // Expose the normalized value to lib/base-path.ts
        NEXT_PUBLIC_BASE_PATH: basePath,
    },
    allowedDevOrigins,
    turbopack: {
        root: __dirname,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com'
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com'
            }
        ],
    },
}

module.exports = nextConfig