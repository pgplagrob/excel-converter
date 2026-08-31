/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: `${__dirname}/..`,
  },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
