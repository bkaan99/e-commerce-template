import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authService } from "@/modules/auth/container";
import { sessionCookieName } from "@/modules/auth/session-cookie";
import { getEnv } from "@/shared/env";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/**
 * Oturum JWT'de yalnızca kullanıcı kimliği ve tipi taşınır. Yetkiler her
 * istekte veritabanından okunur; rol değişikliği ve pasife alma anında etkili olur.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  // Auth.js'in kanonik adresi tek kaynaktan (APP_URL) alması için.
  process.env["AUTH_URL"] ??= env.APP_URL;

  return {
    secret: env.AUTH_SECRET,
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    cookies: {
      sessionToken: {
        name: sessionCookieName(env.NODE_ENV === "production"),
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: env.NODE_ENV === "production",
        },
      },
    },
    pages: { signIn: "/giris" },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) return null;

          const user = await authService.authenticate(
            parsed.data.email,
            parsed.data.password,
          );
          if (!user) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.type,
          };
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.userType = (user as { userType?: string }).userType;
        }
        return token;
      },
      session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        session.user.userType = token.userType as string | undefined;
        return session;
      },
    },
  };
});
