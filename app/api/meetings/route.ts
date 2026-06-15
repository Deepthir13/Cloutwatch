import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  getAnthropicApiKey,
  getAnthropicErrorMessage,
} from "@/lib/anthropicServer";
import { meetingStore, type MeetingNote } from "@/lib/meetingStore";

export const dynamic = "force-dynamic";

type MeetingPostBody = {
  brand?: string;
  date?: string;
  raw_notes?: string;
};

type ExtractedMeeting = Pick<
  MeetingNote,
  | "decisions_made"
  | "action_items"
  | "open_questions"
  | "next_meeting"
  | "key_themes"
>;

function getTextFromAnthropicResponse(message: Message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

function parseExtractedMeeting(rawText: string): ExtractedMeeting {
  const jsonText = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(jsonText) as Partial<ExtractedMeeting>;

  return {
    decisions_made: Array.isArray(parsed.decisions_made)
      ? parsed.decisions_made.map(String)
      : [],
    action_items: Array.isArray(parsed.action_items)
      ? parsed.action_items.map((item) => ({
          owner: String(item.owner ?? ""),
          task: String(item.task ?? ""),
          due: String(item.due ?? ""),
        }))
      : [],
    open_questions: Array.isArray(parsed.open_questions)
      ? parsed.open_questions.map(String)
      : [],
    next_meeting: String(parsed.next_meeting ?? ""),
    key_themes: Array.isArray(parsed.key_themes)
      ? parsed.key_themes.map(String).slice(0, 4)
      : [],
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const brand =
    session?.user.role === "client" && session.user.brand
      ? session.user.brand
      : searchParams.get("brand");
  const notes = brand ? meetingStore.getByBrand(brand) : meetingStore.get();

  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  let body: MeetingPostBody;

  try {
    body = (await request.json()) as MeetingPostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.brand || !body.date || !body.raw_notes) {
    return NextResponse.json(
      { error: "Request body must include brand, date, and raw_notes." },
      { status: 400 },
    );
  }

  const apiKey = getAnthropicApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set in .env.local" },
      { status: 500 },
    );
  }

  const anthropic = new Anthropic({
    apiKey,
  });

  let message: Message;

  try {
    message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `Extract structured information from these meeting notes. Return ONLY valid JSON with keys: decisions_made (string[]), action_items (array of {owner, task, due}), open_questions (string[]), next_meeting (string), key_themes (2-4 short strings). Notes: ${body.raw_notes}`,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: getAnthropicErrorMessage(error) },
      { status: 500 },
    );
  }

  let extractedMeeting: ExtractedMeeting;

  try {
    extractedMeeting = parseExtractedMeeting(getTextFromAnthropicResponse(message));
  } catch {
    return NextResponse.json(
      { error: "Failed to parse structured meeting JSON from Anthropic." },
      { status: 502 },
    );
  }

  const savedNote = meetingStore.add({
    id: crypto.randomUUID(),
    brand: body.brand,
    date: body.date,
    raw_notes: body.raw_notes,
    ...extractedMeeting,
  });

  return NextResponse.json({ note: savedNote });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");

  meetingStore.clear(brand ?? undefined);

  return NextResponse.json({ success: true });
}
