import { NextResponse } from "next/server";
import { dataStore } from "@/lib/dataStore";
import {
  buildWeeklyDigestHtml,
  buildWeeklyDigestText,
  getWeeklyDigestSubject,
} from "@/lib/gmail";
import { loadMockCampaigns } from "@/lib/mockCampaigns";
import { meetingStore } from "@/lib/meetingStore";
import { notificationStore } from "@/lib/notificationStore";
import { getClientEmailForBrand } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const requestSecret = request.headers.get("x-cron-secret");

  if (!cronSecret || requestSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sourceRows = dataStore.isCustom() ? dataStore.get() : await loadMockCampaigns();
  const brands = Array.from(
    new Set(
      sourceRows
        .map((row) => row.brand)
        .filter((brand): brand is string => typeof brand === "string" && brand.length > 0),
    ),
  );

  let queuedCount = 0;

  for (const brand of brands) {
    const toEmail = getClientEmailForBrand(brand);

    if (!toEmail) {
      continue;
    }

    const creatorRows = sourceRows.filter((row) => row.brand === brand);
    const digestData = {
      creators: creatorRows,
      meetingNotes: meetingStore.getByBrand(brand),
    };

    notificationStore.add({
      id: crypto.randomUUID(),
      brand,
      toEmail,
      subject: getWeeklyDigestSubject(brand),
      bodyHtml: buildWeeklyDigestHtml(brand, digestData),
      bodyText: buildWeeklyDigestText(brand, digestData),
      status: "pending",
      createdAt: new Date().toISOString(),
      sentAt: null,
    });
    queuedCount += 1;
  }

  return NextResponse.json({
    success: true,
    queued: queuedCount,
  });
}
