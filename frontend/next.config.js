/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Allow framework dev iframe to embed the app inside the preview shell.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
