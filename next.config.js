/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Mark problematic server-only packages as external
    if (isServer) {
      config.externals = [
        ...config.externals,
        'puppeteer',
        'puppeteer-extra',
        'puppeteer-extra-plugin-stealth',
        'pdf-parse',
        'mammoth',
        '@lancedb/lancedb',
        '@xenova/transformers',
        'apache-arrow',
      ];
    }

    // Handle .node files (native bindings)
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.node$/,
      type: 'asset/resource',
    });

    return config;
  },
};

module.exports = nextConfig;
