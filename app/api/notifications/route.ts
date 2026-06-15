import { NextResponse } from "next/server";
import { notificationStore, redFlagStore } from "@/lib/notificationStore";

export const dynamic = "force-dynamic";

type NotificationPatchBody = {
  id?: string;
  bodyHtml?: string;
  bodyText?: string;
};

export async function GET() {
  return NextResponse.json({
    pendingDigests: notificationStore.getAll(),
    pendingCount: notificationStore.getPendingCount(),
    redFlags: redFlagStore.getAll().filter((alert) => alert.status === "unseen"),
    unseenCount: redFlagStore.getUnseenCount(),
  });
}

export async function PATCH(request: Request) {
  let body: NotificationPatchBody;

  try {
    body = (await request.json()) as NotificationPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.id || typeof body.bodyHtml !== "string") {
    return NextResponse.json(
      { error: "Request body must include id and bodyHtml." },
      { status: 400 },
    );
  }

  const notification = notificationStore.updateBody(body.id, body.bodyHtml, body.bodyText);

  if (!notification) {
    return NextResponse.json({ error: "Digest not found." }, { status: 404 });
  }

  return NextResponse.json({ notification });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  if (type === "redflag") {
    const alert = redFlagStore.markSeen(id);

    if (!alert) {
      return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, alert });
  }

  const notification = notificationStore.markSent(id);

  if (!notification) {
    return NextResponse.json({ error: "Digest not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, notification });
}
