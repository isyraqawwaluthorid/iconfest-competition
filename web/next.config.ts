import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Peta kamera pindah ke /kamera saat beranda menjadi peta tematik; tautan lama tetap berfungsi.
  async redirects() {
    return [{ source: "/peta", destination: "/kamera", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
