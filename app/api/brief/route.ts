import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { NextResponse } from "next/server";
import {
  getAnthropicApiKey,
  getAnthropicErrorMessage,
} from "@/lib/anthropicServer";
import { dataStore, type CreatorRow } from "@/lib/dataStore";
import { meetingStore } from "@/lib/meetingStore";
import { loadMockCampaigns } from "@/lib/mockCampaigns";

export const dynamic = "force-dynamic";

type BriefBody = {
  brand?: string;
};

type DeltaRow = CreatorRow & {
  eng_delta: number;
  EMV_delta: number;
  CPE_delta: number;
  sentiment_delta: number;
};

const deltaColumns = [
  "creator_handle",
  "tier",
  "platform",
  "eng_rate",
  "prev_eng_rate",
  "eng_delta",
  "EMV",
  "prev_EMV",
  "EMV_delta",
  "CPE",
  "prev_CPE",
  "CPE_delta",
  "sentiment_score",
  "prev_sentiment_score",
  "sentiment_delta",
  "fake_follower_flag",
];

function toNumber(value: CreatorRow[string]) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getTextFromAnthropicResponse(message: Message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

function getDeltaRows(rows: CreatorRow[]): DeltaRow[] {
  return rows.map((row) => ({
    ...row,
    eng_delta: Number((toNumber(row.eng_rate) - toNumber(row.prev_eng_rate)).toFixed(2)),
    EMV_delta: Number((toNumber(row.EMV) - toNumber(row.prev_EMV)).toFixed(0)),
    CPE_delta: Number((toNumber(row.CPE) - toNumber(row.prev_CPE)).toFixed(3)),
    sentiment_delta: Number(
      (toNumber(row.sentiment_score) - toNumber(row.prev_sentiment_score)).toFixed(3),
    ),
  }));
}

function escapeMarkdownCell(value: CreatorRow[string] | number) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function deltaRowsToMarkdownTable(rows: DeltaRow[]) {
  const header = `| ${deltaColumns.join(" | ")} |`;
  const separator = `| ${deltaColumns.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) =>
      `| ${deltaColumns
        .map((column) => escapeMarkdownCell(row[column as keyof DeltaRow] as CreatorRow[string] | number))
        .join(" | ")} |`,
  );

  return [header, separator, ...body].join("\n");
}

export async function POST(request: Request) {
  let body: BriefBody;

  try {
    body = (await request.json()) as BriefBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.brand) {
    return NextResponse.json(
      { error: "Request body must include brand." },
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

  const sourceRows = dataStore.isCustom() ? dataStore.get() : await loadMockCampaigns();
  const brandRows = sourceRows.filter((row) => row.brand === body.brand);
  const deltaRows = getDeltaRows(brandRows);
  const meetingNotes = meetingStore.getByBrand(body.brand);

  if (deltaRows.length === 0 && meetingNotes.length === 0) {
    return NextResponse.json(
      { error: "No creator data or meeting notes found for this brand." },
      { status: 400 },
    );
  }

  const anthropic = new Anthropic({
    apiKey,
  });
  const today = new Date().toISOString().slice(0, 10);

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2000,
      system:
        "You are a sharp strategic analyst. Be direct, data-backed, and ready for a real meeting. Reference specific creator names and numbers.",
      messages: [
        {
          role: "user",
          content: `You are a strategic analyst preparing for a brand meeting. Today is ${today}. Brand: ${body.brand}. All past meeting notes: ${JSON.stringify(meetingNotes)}. Creator performance with deltas: ${deltaRowsToMarkdownTable(deltaRows)}. Generate a sharp pre-meeting brief with exactly these sections: SINCE LAST MEETING (decisions confirmed, actions completed or pending), CREATOR PERFORMANCE HIGHLIGHTS (top performers, underperformers, notable trends), OPEN ITEMS TO CLOSE TODAY (unresolved questions, pending decisions), WATCH OUT FOR (things the brand may ask, data anomalies), SUGGESTED AGENDA (5 bullets max). Be sharp, scannable, meeting-ready. No filler.`,
        },
      ],
    });

    return NextResponse.json({
      brief: getTextFromAnthropicResponse(message),
      deltaRows,
      notesCount: meetingNotes.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getAnthropicErrorMessage(error) },
      { status: 500 },
    );
  }
}
