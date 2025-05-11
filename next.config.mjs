/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/convert-emoji/**/*": ["scripts/**", "public/fonts/**"],
    },
  },
};

export default nextConfig;
