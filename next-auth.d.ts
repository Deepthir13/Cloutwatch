import { type DefaultSession } from "next-auth";
import { type UserRole } from "@/lib/users";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    authError?: string;
    user: {
      role: UserRole;
      brand: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    brand: string | null;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: string;
  }
}
