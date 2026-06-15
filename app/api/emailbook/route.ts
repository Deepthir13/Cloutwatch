import { NextResponse } from "next/server";
import { emailBook } from "@/lib/emailBook";

export const dynamic = "force-dynamic";

type EmailBookBody = {
  email?: string;
  label?: string;
  brand?: string | null;
};

export async function GET() {
  return NextResponse.json({
    entries: emailBook.getAll(),
  });
}

export async function POST(request: Request) {
  let body: EmailBookBody;

  try {
    body = (await request.json()) as EmailBookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email || !body.label) {
    return NextResponse.json(
      { error: "Request body must include email and label." },
      { status: 400 },
    );
  }

  const entry = emailBook.add(body.email, body.label, body.brand ?? null);

  return NextResponse.json({ entry });
}

export async function PATCH(request: Request) {
  let body: Pick<EmailBookBody, "email">;

  try {
    body = (await request.json()) as Pick<EmailBookBody, "email">;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json(
      { error: "Request body must include email." },
      { status: 400 },
    );
  }

  const entry = emailBook.incrementUsage(body.email);

  return NextResponse.json({ entry });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  emailBook.remove(id);

  return NextResponse.json({ success: true });
}
