import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dataStore } from "@/lib/dataStore";
import { weeklyDigestStore } from "@/lib/digestStore";
import {
  buildWeeklyDigestHtml,
  buildWeeklyDigestText,
  getGmailErrorMessage,
  getWeeklyDigestSubject,
  sendWeeklyDigest,
} from "@/lib/gmail";
import { loadMockCampaigns } from "@/lib/mockCampaigns";
import { meetingStore } from "@/lib/meetingStore";
import { notificationStore } from "@/lib/notificationStore";
import { getClientEmailForBrand } from "@/lib/users";

export const dynamic = "force-dynamic";

type WeeklyBody = {
  brand?: string;
  toEmail?: string;
  digestId?: string;
  bodyHtml?: string;
  bodyText?: string;
};

export async function POST(request: Request) {
  let body: WeeklyBody;

  try {
    body = (await request.json()) as WeeklyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.brand) {
    return NextResponse.json(
      { error: "Request body must include brand." },
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

  const toEmail = body.toEmail?.trim() || getClientEmailForBrand(body.brand);

  if (!toEmail) {
    return NextResponse.json(
      { error: "No client email found for that brand." },
      { status: 404 },
    );
  }

  const sourceRows = dataStore.isCustom() ? dataStore.get() : await loadMockCampaigns();
  const creatorRows = sourceRows.filter((row) => row.brand === body.brand);

  if (creatorRows.length === 0) {
    return NextResponse.json(
      { error: "No creator rows found for that brand." },
      { status: 400 },
    );
  }

  const bodyHtml =
    body.bodyHtml ??
    buildWeeklyDigestHtml(body.brand, {
      creators: creatorRows,
      meetingNotes: meetingStore.getByBrand(body.brand),
    });
  const digestId = body.digestId ?? crypto.randomUUID();
  const subject = getWeeklyDigestSubject(body.brand);

  try {
    await sendWeeklyDigest(
      body.brand,
      toEmail,
      {
        creators: creatorRows,
        meetingNotes: meetingStore.getByBrand(body.brand),
        bodyHtml,
      },
      accessToken,
    );
  } catch (error) {
    return NextResponse.json({ error: getGmailErrorMessage(error) }, { status: 502 });
  }

  if (body.digestId) {
    if (body.bodyHtml) {
      notificationStore.updateBody(body.digestId, body.bodyHtml, body.bodyText);
    }
    notificationStore.markSent(body.digestId);
  } else {
    notificationStore.add({
      id: digestId,
      brand: body.brand,
      toEmail,
      subject,
      bodyHtml,
      bodyText: body.bodyText ?? buildWeeklyDigestText(body.brand, {
        creators: creatorRows,
        meetingNotes: meetingStore.getByBrand(body.brand),
      }),
      status: "sent",
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    });
  }

  weeklyDigestStore.add({
    id: crypto.randomUUID(),
    brand: body.brand,
    toEmail,
    subject,
    content: bodyHtml,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, sentTo: toEmail });
}
