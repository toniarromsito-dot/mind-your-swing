import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import { NativeAppInit } from "@/components/native-app-init";
import { getDictionary } from "@/lib/i18n/current-locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    title: t.meta.title,
    description: t.meta.description,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Mind Your Swing",
    },
    // La metadata API de Next.js con appleWebApp.capable solo emite la
    // etiqueta genérica "mobile-web-app-capable" — iOS Safari sigue
    // comprobando específicamente la etiqueta con el prefijo "apple-" para
    // decidir si abrir en pantalla completa (sin su barra) al lanzar desde
    // el icono de la pantalla de inicio. Sin ella, Safari puede abrir la
    // PWA instalada como una pestaña normal en vez de standalone.
    other: {
      "apple-mobile-web-app-capable": "yes",
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1F3D2B",
  // "cover" deja que el contenido se extienda bajo el notch/Dynamic
  // Island — necesario para que env(safe-area-inset-*) tenga valores
  // reales en vez de 0 dentro del WebView nativo de Capacitor.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getDictionary();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
        <PwaRegister />
        <NativeAppInit />
      </body>
    </html>
  );
}
