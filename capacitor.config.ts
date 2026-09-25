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
  // Marca en el User-Agent para que el servidor sepa que la página se pinta
  // dentro de la app (ver src/lib/native-app.ts) — p. ej. para no mostrar
  // nunca los pagos de Stripe dentro de la app (App Store 3.1.1 / Google
  // Play Billing). Debe coincidir con NATIVE_APP_USER_AGENT_MARKER.
  appendUserAgent: "MindYourSwingApp",
  server: {
    // /app-entry es la puerta de entrada exclusiva de la app nativa (no la
    // portada pública "/"): comprueba sesión y, si no hay, muestra su
    // propia pantalla de login que abre Google en una Custom Tab — ver
    // src/app/app-entry y src/components/native-login-screen.tsx.
    url: "https://mind-your-swing.vercel.app/app-entry",
    cleartext: false,
    // Capacitor iOS solo trata como "de la app" las URLs que EMPIEZAN por
    // server.url completo (con /app-entry incluido): cualquier otra carga
    // completa de página del mismo dominio (/dashboard tras el redirect de
    // /app-entry, /api/mobile/session al volver del login, /settings...) se
    // abría en Safari. Android compara solo el host, por eso allí no pasaba.
    allowNavigation: ["mind-your-swing.vercel.app"],
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
    // Solo se usa Google (Credential Manager en Android). Sin esto el plugin
    // empaqueta también los SDK de Facebook y Twitter, que MYS no usa — y el
    // de Facebook declara dominios de tracking en el informe de privacidad.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        twitter: false,
      },
    },
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
