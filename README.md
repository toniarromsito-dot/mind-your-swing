# Mind Your Swing

Compañero mental de golf impulsado por IA: acompaña al jugador **antes** y **durante** la ronda trabajando el componente mental del juego (nervios, frustración, rutinas pre-golpe, mentalidad de proceso), no la mecánica de swing.

Aplicación Next.js completa: frontend, backend, base de datos, autenticación con Google e IA conversacional con Claude, todo en el mismo proyecto.

---

## 1. Estado del proyecto

Implementado y funcionando de extremo a extremo en local (build, tests unitarios, tests de integración contra una base de datos real y un test end-to-end con Playwright, todos en verde):

- Login con Google (Auth.js / NextAuth v5).
- Crear ronda, navegar hoyo a hoyo, registrar par/distancia/golpes/putts.
- Chat con el coach IA (Claude, streaming), con contexto real de la ronda/hoyo actual, tono e historial reciente del jugador.
- Check-in de estado de ánimo por hoyo y pre-ronda.
- Resumen post-ronda con evolución del ánimo (gráfico) y cierre generado por el coach.
- Historial de rondas y perfil de usuario con preferencias del coach.
- UI premium, mobile-first, con modo claro/oscuro.

Dos cosas **solo tú puedes completar** porque requieren tus propias credenciales (ver sección 4): crear las credenciales OAuth de Google y obtener una API key de Anthropic. Sin ellas, la app funciona pero el login real y el chat con el coach no estarán disponibles (el chat se degrada con gracia y avisa que falta configurar la clave).

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

### Modelo de datos (resumen)

`User` (con preferencias de coach: tono, idioma) → `Round` (ronda de golf) → `Hole` (hoyos de esa ronda, par/distancia/golpes/putts) y `MoodEntry` (check-in de ánimo, ligado a una ronda y opcionalmente a un hoyo) → `Message` (mensajes de la conversación con el coach, rol usuario/asistente). Esquema completo en [`prisma/schema.prisma`](prisma/schema.prisma).

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

### 4.4. Resumen de variables (`.env.example`)

```
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

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
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
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
| `/perfil` | Datos de usuario, preferencias del coach, cerrar sesión. |

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

Explícitamente fuera de alcance por ahora (ver spec): análisis de vídeo/sensores de swing, motor oficial de hándicap, multijugador/social. Ideas razonables para una v2: notificaciones push antes de una ronda agendada, analítica más rica de patrones de ánimo a largo plazo, multi-idioma más allá de es/en, exportar el historial a PDF.
