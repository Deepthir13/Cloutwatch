import { type NextAuthOptions } from "next-auth";
import { type JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { clearLoginAsCookie, getLoginAsCookie } from "@/lib/loginAsCookie";
import {
  getUserProfile,
  resolveAccessForLoginAs,
  type LoginAs,
} from "@/lib/users";

async function refreshGoogleAccessToken(token: JWT) {
  if (!token.refreshToken) {
    return {
      ...token,
      error: "MissingRefreshToken",
    };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });
    const refreshedTokens = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
    };

    if (!response.ok || !refreshedTokens.access_token) {
      return {
        ...token,
        error: refreshedTokens.error ?? "RefreshAccessTokenError",
      };
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpiresAt: Date.now() + (refreshedTokens.expires_in ?? 3600) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "select_account",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!getUserProfile(user.email)) {
        return false;
      }

      const loginAs = getLoginAsCookie();

      if (loginAs !== "employee" && loginAs !== "brand") {
        return false;
      }

      const access = resolveAccessForLoginAs(user.email, loginAs as LoginAs);

      if (!access) {
        return `/login?as=${loginAs}&error=WrongAccountType`;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.email) {
        const loginAs = getLoginAsCookie();

        if (loginAs === "employee" || loginAs === "brand") {
          const access = resolveAccessForLoginAs(user.email, loginAs);

          if (access) {
            token.role = access.role;
            token.brand = access.brand;
          }

          clearLoginAsCookie();
        }
      }

      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.accessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
      }

      if (account?.refresh_token) {
        token.refreshToken = account.refresh_token;
      }

      if (
        token.accessToken &&
        token.accessTokenExpiresAt &&
        Date.now() < token.accessTokenExpiresAt - 60_000
      ) {
        return token;
      }

      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.brand = token.brand;
      }

      session.accessToken = token.accessToken;
      session.authError = token.error;

      return session;
    },
  },
};
