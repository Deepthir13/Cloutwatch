import { NextResponse } from "next/server";
import { setLoginAsCookie } from "@/lib/loginAsCookie";

export async function POST(request: Request) {
  const body = (await request.json()) as { loginAs?: string };
  const loginAs = body.loginAs;

  if (loginAs !== "employee" && loginAs !== "brand") {
    return NextResponse.json({ error: "Invalid login type." }, { status: 400 });
  }

  setLoginAsCookie(loginAs);

  return NextResponse.json({ ok: true });
}
