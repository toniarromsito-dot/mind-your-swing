import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isAppleSignInConfigured } from "@/lib/auth-providers";

const appleEnabled = isAppleSignInConfigured();

// Apple devuelve el login con un POST cross-site (response_mode=form_post)
// desde appleid.apple.com: con las cookies state/nonce en SameSite=Lax (lo
// que pone Auth.js por defecto) el navegador no las manda en ese POST y la
// verificación falla siempre. Solo en HTTPS (SameSite=None exige Secure) y
// solo si Apple está activo — el login de Google sigue igual que siempre.
const secureCookies = process.env.NODE_ENV === "production";
const appleCookieFix: NextAuthConfig["cookies"] =
  appleEnabled && secureCookies
    ? {
        state: {
          name: "__Secure-authjs.state",
          options: { httpOnly: true, sameSite: "none", path: "/", secure: true, maxAge: 60 * 15 },
        },
        nonce: {
          name: "__Secure-authjs.nonce",
          options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
        },
      }
    : undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    // allowDangerousEmailAccountLinking: la misma persona puede entrar con
    // Google en la web y con Apple en el iPhone — si el email coincide, es
    // la MISMA cuenta de MYS, no un "OAuthAccountNotLinked". Seguro aquí
    // porque ambos providers solo devuelven emails verificados.
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    ...(appleEnabled
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  ...(appleCookieFix ? { cookies: appleCookieFix } : {}),
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
