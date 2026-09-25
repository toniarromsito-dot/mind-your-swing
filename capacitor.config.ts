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
    // /app-entry es la puerta de entrada exclusiva de la app nativa (no la
    // portada pública "/"): comprueba sesión y, si no hay, muestra su
    // propia pantalla de login que abre Google en una Custom Tab — ver
    // src/app/app-entry y src/components/native-login-screen.tsx.
    url: "https://mind-your-swing.vercel.app/app-entry",
    cleartext: false,
    // Fase 12E — fallback local (public/offline.html, empaquetado en
    // webDir) que el propio WebView nativo muestra cuando la carga de la
    // URL remota de arriba falla (arranque en frío sin red, DNS caído,
    // etc.) — verificado como mecanismo real y ya soportado por Capacitor
    // (BridgeWebViewClient.onReceivedError/onReceivedHttpError llaman a
    // bridge.getErrorUrl()), no un componente nativo nuevo. No interfiere
    // con la protección de partida offline de NativeAppInit: esa lógica ya
    // evita el reload en el caso que protege, así que la navegación que
    // dispara este fallback nunca llega a intentarse en ese escenario.
    errorPath: "offline.html",
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
