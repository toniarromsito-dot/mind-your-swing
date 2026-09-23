# Mind Your Swing

Compañero mental de golf impulsado por IA: acompaña al jugador **antes** y **durante** la ronda trabajando el componente mental del juego (nervios, frustración, rutinas pre-golpe, mentalidad de proceso), no la mecánica de swing.

Aplicación Next.js completa: frontend, backend, base de datos, autenticación con Google e IA conversacional con Claude, todo en el mismo proyecto.

---

## 1. Estado del proyecto

Implementado y funcionando de extremo a extremo en local (build, tests unitarios, tests de integración contra una base de datos real y un test end-to-end con Playwright, todos en verde):

- Login con Google (Auth.js / NextAuth v5).
- Crear ronda, navegar hoyo a hoyo, registrar par/distancia/golpes/putts.
- Chat con el coach IA (Claude, streaming), con contexto real de la ronda/hoyo actual, tono e historial reciente del jugador. Tono motivador, no solo calmado.
- Voz del coach (opcional, ElevenLabs): las respuestas se pueden escuchar además de leer, con un interruptor para silenciarlas.
- Llamada de voz en tiempo real (opcional, ElevenLabs Conversational AI): botón "Llamar al coach" para una conversación de voz en vivo, generada con el mismo Claude que el chat de texto.
- Instalable como app (PWA): "Añadir a pantalla de inicio" / "Instalar app" desde el móvil, con icono y modo standalone.
- Suscripción (opcional, Stripe): plan Gratis (5 min de llamada/mes) y plan Pro (40 min/mes), con checkout y portal de facturación.
- Check-in de estado de ánimo por hoyo y pre-ronda.
- Resumen post-ronda con evolución del ánimo (gráfico) y cierre generado por el coach.
- Historial de rondas y perfil de usuario con preferencias del coach.
- **Aprende** (`/aprender`): fundamentos de swing para principiantes, contenido estático y genérico, separado a propósito del coach mental (que no da indicaciones técnicas).
- **Comunidad** (`/historias`): los propios jugadores comparten sus historias y consejos reales — nada generado por IA ni atribuido a golfistas reales externos.
- Interfaz completa en español e inglés (selector en el login y en el perfil), incluyendo las respuestas del coach.
- UI premium, mobile-first, con modo claro/oscuro.

Dos cosas **solo tú puedes completar** porque requieren tus propias credenciales (ver sección 4): crear las credenciales OAuth de Google y obtener una API key de Anthropic. Sin ellas, la app funciona pero el login real y el chat con el coach no estarán disponibles (el chat se degrada con gracia y avisa que falta configurar la clave). La voz del coach (ElevenLabs) es opcional: sin su API key, el chat funciona igual, solo sin audio.

---

## 2. Arquitectura y decisiones técnicas

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Frontend y backend (Route Handlers + Server Actions) en un solo proyecto, desplegable directamente en Vercel. |
| UI | Tailwind CSS v4 + shadcn/ui (sobre Base UI) | Componentes accesibles con acabado premium rápido. Paleta verde/neutra cálida definida en `src/app/globals.css` (tokens light/dark). |
| Auth | Auth.js (NextAuth) v5 + proveedor Google, sesiones en base de datos | Login sin fricción con la cuenta de Google que el usuario ya tiene; sesión persistida en Postgres vía `@auth/prisma-adapter`. |
| Base de datos | PostgreSQL + Prisma ORM | Modelo relacional simple (usuarios, rondas, hoyos, check-ins de ánimo, mensajes). |
| IA conversacional | SDK oficial de Anthropic (`@anthropic-ai/sdk`), llamado solo desde el backend | La API key nunca llega al cliente. Streaming de texto vía un endpoint propio (`/api/chat`) que devuelve NDJSON (una línea JSON por evento: `token`/`done`/`error`), consumido con `fetch` + `ReadableStream` en el cliente — sin dependencias extra de streaming. |
| Despliegue | Vercel + Postgres gestionado (Neon o Supabase) | Ver sección 6. |

### Decisiones que merecen una nota

- **Prisma 7 vs 6**: Prisma 7 cambió el datasource de schema (`url = env(...)`) por un sistema de `prisma.config.ts` + adaptadores de driver. Para mantener el flujo clásico y bien documentado de `DATABASE_URL` en `.env` (más fácil de explicar a alguien no técnico), el proyecto usa **Prisma 6** (`^6.19.3`), que sigue siendo una versión actual y con soporte.
- **Base de datos local sin Docker**: se incluye `scripts/local-postgres.mjs`, que levanta un Postgres real embebido (paquete `embedded-postgres`) sin necesidad de Docker ni permisos de administrador. Es una alternativa a Docker pensada para arrancar rápido; en producción se usa Postgres gestionado igualmente.
- **`system prompt` centralizado**: toda la identidad y reglas del coach viven en `src/lib/coach/prompt.ts`. El contexto (campo, hoyo, resultado, ánimo reciente, patrones históricos) se construye en `src/lib/coach/context.ts` a partir de datos reales de la base de datos — nunca lo escribe el usuario.
- **Ruta de login de desarrollo** (`src/app/api/dev-login`): permite iniciar sesión sin pasar por Google OAuth real, solo para pruebas manuales y end-to-end locales. Devuelve `404` fuera de `NODE_ENV=production`, así que nunca existe en producción. Es lo que usa el test end-to-end de Playwright para no depender de credenciales reales de Google en CI.
- **Rate limiting en memoria**: `src/lib/rate-limit.ts` limita el chat a 12 mensajes/minuto por usuario. Es "básico" a propósito (spec): válido para una sola instancia; si el tráfico lo justifica, sustituir por un store compartido (p. ej. Upstash Redis).
- **i18n sin librería externa**: `src/lib/i18n/dictionaries.ts` centraliza todos los textos (es/en). El idioma se resuelve en `src/lib/i18n/current-locale.ts`: si hay sesión, manda `User.language` (persistido en el perfil); si no, una cookie que cambia el toggle de la landing. Los diccionarios que cruzan a un Client Component se mantienen como strings/arrays planos (las funciones no pueden pasar la frontera Server→Client Component de Next.js); para los pocos textos con interpolación se usa una plantilla `"Hoyo {n}"` + el helper `fmt()` (`src/lib/i18n/format.ts`).
- **Voz vía ElevenLabs, no navegador**: se eligió una API de voz realista sobre la Web Speech API nativa (gratis pero con voces muy robóticas) porque el objetivo es que suene bien mientras se juega, no solo que funcione. La llamada vive en `/api/tts` (backend), y el modelo `eleven_multilingual_v2` cubre es/en sin cambiar de modelo según el idioma. Es "best-effort": si falla o no hay clave, el chat de texto sigue funcionando exactamente igual.
- **Llamada en vivo: Claude detrás de un agente de ElevenLabs, no el LLM de ElevenLabs**: la conversación de voz usa ElevenLabs Conversational AI solo para el oído y la voz (STT/TTS); el texto lo sigue generando Claude, vía la integración "Custom LLM" de ElevenLabs. `src/app/api/voice/v1/chat/completions/route.ts` expone un endpoint compatible con la API de Chat Completions de OpenAI (streaming SSE) que por dentro llama a Anthropic — así el agente de voz usa exactamente el mismo modelo, tono y reglas que el chat de texto. Protegido con un secreto compartido (`ELEVENLABS_CUSTOM_LLM_SECRET`) en vez de la sesión del usuario, porque quien llama es el servidor de ElevenLabs, no el navegador. El contexto real de la ronda (campo, hoyo, ánimo) se pasa como "dynamic variables" de ElevenLabs, generadas en `src/app/api/voice/session/route.ts` a partir de los mismos datos que usa el chat de texto.
- **Contenido de swing separado del coach mental**: `/aprender` es contenido estático (estructurado en el diccionario de i18n, no generado por IA en tiempo real) con fundamentos genéricos para principiantes. El coach en sí también puede responder preguntas técnicas puntuales si se lo piden (no las evita), pero su foco por diseño sigue siendo el componente mental — `/aprender` existe como referencia aparte, no como su reemplazo.
- **Límite de minutos de llamada por mes natural, no por ciclo de Stripe**: `src/lib/billing.ts` suma la duración de las llamadas (`VoiceCallLog`) desde el día 1 del mes en curso, en vez de consultar el `current_period_start` real de la suscripción en Stripe. Es una simplificación deliberada (evita una llamada a la API de Stripe en cada intento de llamada) razonable para el volumen de esta app; si se necesitara más precisión o facturación por consumo real, habría que sustituirlo por el ciclo exacto de Stripe.

### Modelo de datos (resumen)

`User` (con preferencias de coach: tono, idioma; y de suscripción: `plan`, IDs de Stripe) → `Round` (ronda de golf) → `Hole` (hoyos de esa ronda, par/distancia/golpes/putts) y `MoodEntry` (check-in de ánimo, ligado a una ronda y opcionalmente a un hoyo) → `Message` (mensajes de la conversación con el coach, rol usuario/asistente). `Story` (historias de la comunidad) y `VoiceCallLog` (duración de cada llamada, para el límite de minutos del plan) cuelgan solo de `User`, independientes de las rondas. Esquema completo en [`prisma/schema.prisma`](prisma/schema.prisma).

---

## 3. Instalación local

Requisitos: Node.js 20+ y npm. No hace falta Docker.

```bash
npm install
```

### 3.1. Base de datos local

**Opción A — sin Docker (recomendada para empezar rápido):** el proyecto incluye un Postgres embebido.

```bash
npm run db:local
```

Deja esta terminal abierta (el proceso mantiene el servidor Postgres corriendo en `localhost:5544`). En otra terminal, continúa con la configuración del `.env` (sección 4) y las migraciones (3.2). Para pararlo: `Ctrl+C` en esa terminal, o `npm run db:local:stop`.

**Opción B — Docker:**

```bash
docker run --name mind-your-swing-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mindyourswing -p 5544:5432 -d postgres:16
```

**Opción C — Neon o Supabase (gratis) incluso para desarrollo:** crea un proyecto en [neon.tech](https://neon.tech) o [supabase.com](https://supabase.com) y usa la cadena de conexión que te den como `DATABASE_URL`.

### 3.2. Variables de entorno y migraciones

```bash
cp .env.example .env
```

Rellena `.env` siguiendo la sección 4 de este README. Con `DATABASE_URL` ya apuntando a tu Postgres:

```bash
npm run db:migrate
```

### 3.3. Arrancar la app

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## 4. Configuración de credenciales (paso a paso)

### 4.1. Credenciales OAuth de Google — **solo tú puedes crearlas**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto (o usa uno existente).
2. Menú lateral → **APIs & Services** → **OAuth consent screen**. Configúralo como "External", rellena nombre de la app y tu email de contacto. No hace falta enviarlo a revisión para uso personal/desarrollo (modo "Testing", añadiéndote como usuario de prueba).
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** → tipo **Web application**.
4. En **Authorized redirect URIs** añade:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Producción: `https://tu-dominio.vercel.app/api/auth/callback/google` (añádelo cuando tengas el dominio final; puedes editarlo después).
5. Copia el **Client ID** y **Client Secret** a tu `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

### 4.2. API key de Anthropic — **solo tú puedes crearla**

1. Crea una cuenta en [console.anthropic.com](https://console.anthropic.com/) si no tienes una.
2. **Settings → API Keys → Create Key**.
3. Copia la clave a tu `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-4-5
   ```
   `ANTHROPIC_MODEL` es configurable: cambia el modelo sin tocar código.

   Si al probar el chat ves en la terminal un error `"This API key is not scoped to a workspace"`, tu key no está asociada a un workspace concreto. Ve a **console.anthropic.com → Settings → Workspaces**, copia el ID del workspace que quieras usar, y añádelo como `ANTHROPIC_WORKSPACE_ID=` en tu `.env`.

### 4.3. `NEXTAUTH_SECRET`

Genera uno con:

```bash
npx auth secret
```

o manualmente con `openssl rand -base64 32`, y pégalo en `.env`.

### 4.4. Voz del coach (ElevenLabs) — opcional

1. Crea una cuenta en [elevenlabs.io](https://elevenlabs.io/) (tiene plan gratuito limitado; la voz es de pago a partir de cierto uso).
2. **Settings → API Keys** y copia tu clave a `.env` como `ELEVENLABS_API_KEY=`.
3. Opcional: elige una voz en la [librería de voces](https://elevenlabs.io/app/voice-library), copia su ID y añádelo como `ELEVENLABS_VOICE_ID=`. Sin esto, se usa una voz pública por defecto.

Si no configuras esto, el chat funciona exactamente igual, solo sin audio (el botón de voz simplemente no reproduce nada).

### 4.5. Llamada de voz en tiempo real (ElevenLabs Conversational AI) — opcional

Esto es distinto de la voz del punto anterior: en vez de escribir y escuchar la respuesta, el jugador pulsa "Llamar al coach" y mantiene una conversación de voz en vivo (micrófono ↔ altavoz), como una llamada. Usa el mismo Claude que el resto de la app: ElevenLabs solo hace de oído y voz (STT + TTS), la generación de texto sigue pasando por nuestro backend con el prompt real de la ronda.

**Requiere que la app ya esté desplegada** (Vercel u otro hosting público): ElevenLabs necesita poder llamar a tu servidor por HTTPS, así que esto no funciona contra `localhost`.

1. Crea una cuenta en [elevenlabs.io](https://elevenlabs.io/) si no la tienes (comparte cuenta con la voz del punto 4.4).
2. **Agents → Create an agent**. En el mensaje del sistema, pega esto (las variables `{{ }}` se rellenan solas con los datos reales de cada ronda):
   ```
   # Personalidad
   Eres el coach de Mind Your Swing, psicólogo deportivo especializado en golf. Acompañas a {{player_name}} antes y durante su ronda. Tu foco principal es el componente mental: nervios, frustración, rutinas pre-golpe, mentalidad de proceso ("un golpe a la vez"). Si te pregunta algo técnico (grip, postura, swing), respóndele también, de forma breve y práctica.

   Eres motivador de verdad: celebras lo bueno y reencuadras con convicción tras un mal golpe. Frases cortas, cálidas, con energía positiva. Nunca jerga clínica. Termina casi siempre con una acción concreta y pequeña.

   # Contexto de la ronda actual
   Campo: {{course}}
   Hoyo actual: {{hole_number}} (par {{hole_par}})
   Progreso de la ronda: {{round_progress}}
   Estado de ánimo reciente: {{recent_mood}}

   # Idioma
   Responde siempre en {{language}}.
   ```
3. Elige una voz para el agente.
4. Copia el **Agent ID** (aparece en la URL del agente, `.../agents/agent_...`) a `.env`/Vercel como `ELEVENLABS_AGENT_ID=`.
5. Genera un secreto aleatorio: `openssl rand -hex 32`. Guárdalo como `ELEVENLABS_CUSTOM_LLM_SECRET=` en `.env`/Vercel.
6. En el dashboard de ElevenLabs, crea un **workspace secret** (Settings → Secrets, o vía API `POST /v1/convai/secrets`) con ese mismo valor.
7. En la configuración del agente, cambia el **LLM** a **Custom LLM**:
   - **URL**: `https://<tu-dominio>/api/voice/v1/chat/completions`
   - **API key**: selecciona el secreto que creaste en el paso 6
8. Publica el agente.

Todo esto también se puede hacer por API (así es como se configuró en este proyecto) — ver `src/app/api/voice/session/route.ts` y `src/app/api/voice/v1/chat/completions/route.ts` para el contrato exacto (dynamic variables y formato de streaming compatible con OpenAI Chat Completions).

Sin `ELEVENLABS_AGENT_ID`/`ELEVENLABS_CUSTOM_LLM_SECRET` configurados, el botón de llamada simplemente muestra un error controlado; el resto de la app no se ve afectado.

### 4.6. Suscripción (Stripe) — opcional

Plan Gratis (5 min de llamada/mes) vs. plan Pro (40 min/mes) — ver `src/lib/billing.ts` para los límites exactos. Sin esto configurado, todo el mundo se queda en el plan Gratis y el botón "Pasar a Pro" del perfil avisa de que los pagos no están listos; el resto de la app funciona igual.

1. Crea una cuenta en [dashboard.stripe.com/register](https://dashboard.stripe.com/register) (gratis, comisión solo por transacción). Trabaja en **modo Test** al principio (interruptor arriba a la derecha del dashboard).
2. **Developers → API keys**, copia la **Secret key** (`sk_test_...`) a `.env` como `STRIPE_SECRET_KEY=`.
3. **Product catalog → Add product**: crea un producto (ej. "Mind Your Swing Pro") con **dos precios recurrentes** sobre el mismo producto — mensual (14,99€/mes) y anual (143,90€/año, ahorro del 20%). Copia cada **Price ID** (`price_...`) a `.env` como `STRIPE_PRO_PRICE_ID_MONTHLY=` y `STRIPE_PRO_PRICE_ID_ANNUAL=`. El trial de 3 días se aplica desde el código (`subscription_data.trial_period_days`), no hace falta configurarlo en Stripe.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<tu-dominio>/api/stripe/webhook`
   - Eventos a escuchar: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copia el **Signing secret** (`whsec_...`) a `.env`/Vercel como `STRIPE_WEBHOOK_SECRET=`.
5. Para probar en local sin desplegar, usa la [Stripe CLI](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to localhost:3000/api/stripe/webhook` (te da un `whsec_...` propio para local).
6. Cuando quieras cobrar de verdad, cambia el interruptor del dashboard a **modo Live** y repite los pasos 2-4 con las claves `sk_live_...` / `price_...` / `whsec_...` de producción.

**Cómo se aplican los minutos incluidos**: cada llamada terminada se registra en `VoiceCallLog` (duración en segundos). `/api/voice/session` suma los minutos usados en lo que va de mes natural antes de dejar empezar una llamada nueva; si se supera el límite del plan, devuelve un 402 y la UI pide pasar a Pro. Es una aproximación al mes natural, no al ciclo exacto de facturación de Stripe — suficiente para el volumen de esta app, pero anótalo si migras a facturación por consumo más fina.

### 4.7. Vídeos de swing con puntuación automática (`/aprender/videos`) — opcional

Un jugador Pro puede subir un vídeo de su swing y recibir, al instante, una puntuación 0-100 y feedback en texto — sin esperar a que Antonio lo revise. Cómo funciona, en orden:

1. **Subida**: el vídeo va directo del navegador a Vercel Blob (`@vercel/blob/client`), autorizado por `src/app/api/swing-videos/upload/route.ts` (comprueba sesión + plan Pro antes de emitir el token). El servidor nunca recibe el archivo de vídeo en sí.
2. **Detección de pose**: en el propio navegador, `src/lib/swing/pose-landmarker.ts` usa [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) (WASM + modelo "lite", cargados desde el CDN oficial de Google) para extraer ~20 fotogramas/segundo de keypoints del cuerpo. El vídeo tampoco sale del dispositivo para este paso.
3. **Puntuación heurística**: `src/lib/swing/scoring.ts` (función pura, con tests unitarios) calcula 5 métricas clásicas — estabilidad de la cabeza, mantenimiento del ángulo de columna, rango de rotación de caderas, transferencia de peso y tempo subida:bajada — y las combina en una puntuación 0-100. **Esto es una estimación heurística, no un análisis biomecánico validado ni un sustituto de un profesor de golf**: los propios textos de la app lo dejan claro al jugador.
4. **Feedback en lenguaje natural**: los números (nunca el vídeo ni fotogramas) se mandan a Claude (`src/lib/swing/feedback.ts`), que los traduce a un feedback breve y motivador en el idioma del jugador.
5. El vídeo, la puntuación y el feedback automático quedan guardados (`SwingVideo` en Prisma) y visibles para el propio jugador en `/aprender/videos`, y para Antonio en `/admin/videos`, donde puede añadir su propio feedback manual encima.

**Revisión manual (`/admin/videos`)**: solo accesible para los emails listados en `ADMIN_EMAILS` (separados por comas). Sin esta variable, nadie puede entrar a esa página.

**Cuenta propietaria (`OWNER_EMAILS`)**: los emails listados ahí (separados por comas, mismo formato que `ADMIN_EMAILS`) obtienen acceso Pro completo en toda la app —Analizador de Swing, Mind, multijugador, todas las modalidades— sin pasar por Stripe ni depender de `plan` en base de datos (ver `src/lib/plan.ts` → `hasProAccess`). Pensada para desarrollar y enseñar el producto. Un owner es también admin automáticamente (no hace falta repetir el email en `ADMIN_EMAILS`). Los usuarios normales (Free/Pro vía Stripe) no cambian.

### 4.8. Publicidad (AdMob) — opcional, solo app nativa

Fase 11F: banner de anuncios para usuarios Free en la app nativa (iOS/Android) — la web nunca muestra anuncios, y Pro/owner nunca los ve en ninguna plataforma (`canUseFeature(user, "AD_FREE")`, ver `src/lib/entitlements.ts`). Sin las variables de abajo, el sistema queda completamente inerte: nunca se llama al SDK de AdMob (ver `isAdMobConfigured()` en `src/lib/ads/config.ts`) — el resto de la app funciona exactamente igual.

Ubicaciones permitidas (allowlist explícita en `src/lib/ads/policy.ts`): `/dashboard`, `/community`, `/aprende`, `/insights`. Jugar (`/play/*`, incluido Focus Mode) y Coach quedan sin anuncios por diseño — no están en la lista.

Para activar anuncios reales necesitas, fuera de este repo:

1. Una cuenta de [AdMob](https://admob.google.com/) con la app dada de alta para iOS y Android (cada plataforma tiene su propio **App ID**, formato `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).
2. Un **Ad Unit** de tipo banner por plataforma (formato `ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`, distinto del App ID) — cópialos a `.env`/Vercel como `NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID=` y `NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS=`.
3. Dar de alta el **App ID** en los proyectos nativos (este repo no lo incluye, cada dev/CI debe configurarlo con su propio AdMob App ID):
   - Android: en `android/app/src/main/AndroidManifest.xml`, meta-data `com.google.android.gms.ads.APPLICATION_ID`.
   - iOS: en `ios/App/App/Info.plist`, clave `GADApplicationIdentifier`.
4. **Consentimiento (obligatorio antes de servir anuncios personalizados de verdad)**: GDPR/RGPD en la UE (Google UMP — el plugin ya expone `AdMob.requestConsentInfo()`/`AdMob.showConsentForm()`) y ATT en iOS 14+ (`AdMob.trackingAuthorizationStatus()`/`requestTrackingAuthorization()`). Esta fase deja la integración preparada para llamarlos, pero **no implementa el flujo de consentimiento en la UI** — bloqueante antes de servir tráfico publicitario real, no solo una mejora.
5. `npx cap sync` tras configurar lo anterior para que los proyectos nativos recojan el plugin `@capacitor-community/admob`.

### 4.9. Resumen de variables (`.env.example`)

```
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
ANTHROPIC_WORKSPACE_ID=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_AGENT_ID=
ELEVENLABS_CUSTOM_LLM_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PRO_PRICE_ID_MONTHLY=
STRIPE_PRO_PRICE_ID_ANNUAL=
STRIPE_WEBHOOK_SECRET=
ADMIN_EMAILS=
OWNER_EMAILS=
NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID=
NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS=
```

(`BLOB_READ_WRITE_TOKEN` no va en `.env.example`: lo provisiona automáticamente Vercel al enlazar un store de Vercel Blob — ver 6.2.)

---

## 5. Pruebas

```bash
npm test              # unitarias (lógica de negocio: golf, ánimo, prompt del coach, validación)
npm run test:integration   # integración: server actions y /api/chat contra una base de datos Postgres real
npm run test:e2e       # end-to-end (Playwright): login → crear ronda → jugar un hoyo → chat → resumen
```

Las pruebas de **integración** usan una base de datos separada de la de desarrollo (`mindyourswing_test`), para no ensuciar tus datos locales:

```bash
npm run db:test:create   # crea la base de datos de test (una vez, con Postgres local ya arrancado)
npm run db:test:migrate  # aplica las migraciones ahí
npm run test:integration
```

Las pruebas de **e2e** arrancan su propio servidor de desarrollo (puerto 3100) apuntando a esa misma base de datos de test, y usan la ruta `/api/dev-login` para autenticarse sin pasar por Google OAuth real (por eso no necesitan credenciales de Google ni de Anthropic: la llamada a `/api/chat` se mockea a nivel de red en el propio test).

---

## 6. Despliegue a producción

### 6.1. Base de datos gestionada

Crea una base de datos Postgres en [Neon](https://neon.tech) o [Supabase](https://supabase.com) (ambos tienen plan gratuito). Copia la cadena de conexión — normalmente termina en `?sslmode=require`.

### 6.2. Vercel

1. Sube el repositorio a GitHub/GitLab y en [vercel.com](https://vercel.com) → **Add New Project** → importa el repo.
2. En **Environment Variables**, añade las mismas variables que en `.env` pero con valores de producción:
   - `DATABASE_URL`: la de Neon/Supabase.
   - `NEXTAUTH_URL`: `https://tu-dominio.vercel.app`.
   - `NEXTAUTH_SECRET`: genera uno **distinto** al de desarrollo.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: los mismos del paso 4.1 (o crea un OAuth client separado para producción si prefieres aislar entornos).
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (y `ANTHROPIC_WORKSPACE_ID` si tu key lo pide).
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (opcionales, solo si quieres voz en producción).
   - `ELEVENLABS_AGENT_ID`, `ELEVENLABS_CUSTOM_LLM_SECRET` (opcionales, solo para la llamada de voz en tiempo real — ver 4.5; el agente debe apuntar a este mismo dominio de producción).
   - `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID_MONTHLY`, `STRIPE_PRO_PRICE_ID_ANNUAL`, `STRIPE_WEBHOOK_SECRET` (opcionales, solo para cobrar el plan Pro — ver 4.6; usa las claves `sk_live_...` cuando actives el modo Live en Stripe).
   - `ADMIN_EMAILS` (opcional, solo para poder acceder a `/admin/videos` — ver 4.7).
   - `OWNER_EMAILS` (opcional, acceso Pro completo sin Stripe para la cuenta propietaria — ver 4.7).
   - `BLOB_READ_WRITE_TOKEN`: se provisiona solo al crear/enlazar un store de [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (`npx vercel blob create-store <nombre>` o desde el dashboard, pestaña Storage) — necesario para que funcione la subida de vídeos de swing.
3. Despliega.

### 6.3. Migraciones en producción

Antes o justo después del primer despliegue, aplica las migraciones contra la base de datos de producción:

```bash
DATABASE_URL="<tu-connection-string-de-produccion>" npx prisma migrate deploy
```

(Puedes ejecutarlo desde tu máquina apuntando a la URL de producción, o añadirlo como paso de build en Vercel: `npx prisma migrate deploy && next build`.)

### 6.4. Actualizar la redirect URI de Google

Vuelve a **Google Cloud Console → Credentials** y añade a **Authorized redirect URIs**:

```
https://tu-dominio.vercel.app/api/auth/callback/google
```

---

## 7. Estructura de páginas

| Ruta | Contenido |
|---|---|
| `/` | Landing pública + botón "Iniciar sesión con Google". |
| `/dashboard` | Home: ronda en curso, accesos rápidos, resumen de ánimo. |
| `/rondas/nueva` | Crear ronda (campo, fecha, hoyos, check-in mental inicial). |
| `/rondas/[id]` | Ronda en curso: navegación hoyo a hoyo, chat del coach integrado (drawer, 1-2 toques desde cualquier hoyo). |
| `/rondas/[id]/resumen` | Resumen post-ronda: resultado, evolución del ánimo, cierre del coach. |
| `/historial` | Rondas pasadas. |
| `/aprender` | Fundamentos de swing para principiantes (contenido estático, no del coach mental) + vídeos embebidos (Pro). |
| `/aprender/videos` | Sube tu swing, recibe puntuación automática al instante (plan Pro) — ver 4.7. |
| `/admin/videos` | Revisión manual de vídeos de swing, solo para `ADMIN_EMAILS` — ver 4.7. |
| `/historias` | Historias y consejos reales compartidos por la comunidad de jugadores. |
| `/perfil` | Datos de usuario, preferencias del coach (tono, idioma), suscripción, cerrar sesión. |

---

## 8. Seguridad

- La API key de Anthropic y el secreto de Google nunca se exponen al cliente; toda llamada a la IA pasa por `src/app/api/chat/route.ts` (backend).
- Validación de entrada con Zod en todos los server actions y endpoints (`src/lib/validations.ts`).
- Todas las páginas y acciones sobre datos personales comprueban la sesión (`requireUserId()` / `auth()`), y las consultas siempre filtran por `userId` para evitar acceso cruzado entre usuarios.
- Rate limiting básico en `/api/chat`.
- Si la IA falla o tarda, el chat lo muestra como un mensaje de error con opción de "Reintentar", sin dejar la interfaz colgada.
- El contenido del chat se renderiza como texto plano (`white-space: pre-wrap`), nunca como HTML, evitando XSS vía mensajes.

---

## 9. Posibles siguientes pasos (fuera del MVP)

Explícitamente fuera de alcance por ahora (ver spec): motor oficial de hándicap. Ideas razonables para una v2: notificaciones push antes de una ronda agendada, analítica más rica de patrones de ánimo a largo plazo, más idiomas además de es/en, exportar el historial a PDF, moderación/reportar en las historias de la comunidad si crece el volumen de usuarios, y para la puntuación automática de swing: comparar contra vídeo de referencia lateral (no solo frontal), detectar automáticamente las fases del swing en vez de asumir proporciones fijas del clip, e ir ajustando los pesos de cada métrica con feedback real de Antonio sobre si la puntuación automática acierta o no.
