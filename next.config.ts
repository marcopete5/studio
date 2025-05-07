import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },
    output: 'export', // Enables static export
    basePath: '/studio', // Matches your GitHub Pages repository path
    assetPrefix: '/studio/', // Ensures assets are correctly prefixed
    images: {
        unoptimized: true, // Disables image optimization for static export
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'picsum.photos',
                port: '',
                pathname: '/**'
            }
        ]
    }
};

export default nextConfig;
