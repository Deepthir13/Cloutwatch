import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getGmailErrorMessage, sendRedFlagAlert } from "@/lib/gmail";
import { getClientEmailForBrand } from "@/lib/users";

export const dynamic = "force-dynamic";

type RedFlagBody = {
  brand?: string;
  creator?: string;
  reason?: string;
  severity?: string;
};

export async function POST(request: Request) {
  let body: RedFlagBody;

  try {
    body = (await request.json()) as RedFlagBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.brand || !body.creator || !body.reason || !body.severity) {
    return NextResponse.json(
      { error: "Request body must include brand, creator, reason, and severity." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  if (session?.authError) {
    return NextResponse.json(
      { error: "Google Gmail access expired. Sign out and sign in with Google again." },
      { status: 401 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Gmail access token. Sign in with Google again." },
      { status: 401 },
    );
  }

  const toEmail = getClientEmailForBrand(body.brand);

  if (!toEmail) {
    return NextResponse.json(
      { error: "No client email found for that brand." },
      { status: 404 },
    );
  }

  try {
    await sendRedFlagAlert(
      body.brand,
      toEmail,
      body.creator,
      body.reason,
      body.severity,
      accessToken,
    );
  } catch (error) {
    return NextResponse.json({ error: getGmailErrorMessage(error) }, { status: 502 });
  }

  return NextResponse.json({ success: true, sentTo: toEmail });
}
