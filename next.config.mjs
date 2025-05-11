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
};

export default nextConfig;
