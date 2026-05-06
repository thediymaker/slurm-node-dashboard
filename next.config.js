/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
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
