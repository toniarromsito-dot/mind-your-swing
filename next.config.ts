import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Fotos de perfil de Google (OAuth) — necesario para next/image.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Fotos de fondo de las tarjetas del dashboard (Unsplash, licencia libre).
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
