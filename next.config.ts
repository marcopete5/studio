import type { NextConfig } from 'next';

// Determine if the environment is production
const isProd = process.env.NODE_ENV === 'production';

// Check if this build is specifically for Netlify
const isNetlify = process.env.NETLIFY === 'true';

// Define your GitHub Pages repository name (the subpath)
const ghPagesRepoName = 'studio';

const nextConfig: NextConfig = {
    // Your existing TypeScript and ESLint configurations
    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },

    // --- Conditionally set assetPrefix and basePath ---
    // Apply only for production builds that are NOT for Netlify (i.e., for GitHub Pages)
    assetPrefix: isProd && !isNetlify ? `/${ghPagesRepoName}/` : undefined,
    basePath: isProd && !isNetlify ? `/${ghPagesRepoName}` : undefined,
    // --- End conditional assetPrefix and basePath ---

    output: 'export', // Essential for static site generation
    images: {
        unoptimized: true,
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
