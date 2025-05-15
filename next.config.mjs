/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/convert-emoji/**/*": [
        "scripts/**",
        "public/fonts/**",
        "node_modules/**",
      ],
    },
  },
  env: {
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
};

export default nextConfig;
