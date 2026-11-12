/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile internal workspace TS packages.
  transpilePackages: ["@rtc/schemas", "@rtc/search", "@rtc/shared"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "placehold.co" }],
  },
};
export default nextConfig;
