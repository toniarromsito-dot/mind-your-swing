import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor en "modo remoto": el WebView nativo no lleva la web empaquetada
// dentro del binario, carga directamente el despliegue real de Vercel. Es
// obligatorio para esta app porque usa Server Actions, Server Components
// con datos de Postgres y rutas API con secretos (Anthropic, Stripe,
// ElevenLabs) — nada de eso puede convertirse en un export estático sin
// reescribir la aplicación. Con este enfoque, iOS/Android son exactamente
// el mismo backend que la web: cero duplicación de lógica.
const config: CapacitorConfig = {
  appId: "com.mindyourswing.app",
  appName: "Mind Your Swing",
  webDir: "public",
  server: {
    url: "https://mind-your-swing.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#1F3D2B",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1F3D2B",
    },
  },
};

export default config;
