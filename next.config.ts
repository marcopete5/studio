import type { NextConfig } from 'next';

// Determine if the environment is production
const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
    // Your existing TypeScript and ESLint configurations
    typescript: {
        ignoreBuildErrors: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },

    // ---START: Added for GitHub Pages deployment to /studio/ ---
    assetPrefix: isProd ? '/studio/' : undefined, // Prefixes assets (CSS, JS, images) with /studio/ in production
    basePath: isProd ? '/studio' : undefined, // Sets the base path for routing to /studio in production
    // ---END: Added for GitHub Pages deployment ---

    // Your existing output and images configurations
    output: 'export', // Essential for static site generation for gh-pages
    images: {
        unoptimized: true, // Often helpful for gh-pages as Next.js image optimization requires a server
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'picsum.photos',
                port: '', // Default port, so empty string is fine
                pathname: '/**'
            }
        ]
    }
};

export default nextConfig;
