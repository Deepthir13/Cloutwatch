import { cookies } from "next/headers";

export const LOGIN_AS_COOKIE = "login-as";

export function setLoginAsCookie(loginAs: "employee" | "brand") {
  cookies().set(LOGIN_AS_COOKIE, loginAs, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
}

export function clearLoginAsCookie() {
  cookies().delete(LOGIN_AS_COOKIE);
}

export function getLoginAsCookie() {
  return cookies().get(LOGIN_AS_COOKIE)?.value ?? null;
}
