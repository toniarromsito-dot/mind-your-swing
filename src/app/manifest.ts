import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mind Your Swing",
    short_name: "MYS",
    description: "Tu coach mental de golf: calma antes del golpe, foco durante la ronda.",
    // /app-entry decide él mismo: sesión activa -> /dashboard directo; si
    // no, muestra el onboarding (NativeOnboarding) antes de pedir login, en
    // vez de aterrizar en la landing pública de marketing. Así abrir la PWA
    // instalada se siente como abrir una app, no como abrir una pestaña.
    start_url: "/app-entry",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F5EE",
    theme_color: "#1F3D2B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
