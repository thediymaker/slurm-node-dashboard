const allowedDevOrigins = process.env.NEXT_PUBLIC_BASE_URL
    ? [new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname]
    : []

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
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