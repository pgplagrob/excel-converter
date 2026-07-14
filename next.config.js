/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["xlsx-js-style"],
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;
