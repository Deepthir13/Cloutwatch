import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { NextResponse } from "next/server";
import { dataStore, REQUIRED_COLS, type CreatorRow } from "@/lib/dataStore";
import {
  getAnthropicApiKey,
  getAnthropicErrorMessage,
} from "@/lib/anthropicServer";
import { loadMockCampaigns } from "@/lib/mockCampaigns";

export const dynamic = "force-dynamic";

type AnalyzeBody = {
  brand?: string;
  goal?: string;
  tiers?: string[];
};

function escapeMarkdownCell(value: CreatorRow[string]) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function rowsToMarkdownTable(rows: CreatorRow[]) {
  const columns = REQUIRED_COLS;
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${columns.map((column) => escapeMarkdownCell(row[column])).join(" | ")} |`,
  );

  return [header, separator, ...body].join("\n");
}

function getTextFromAnthropicResponse(message: Message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

export async function POST(request: Request) {
  let body: AnalyzeBody;

  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.brand || !body.goal || !Array.isArray(body.tiers)) {
    return NextResponse.json(
      { error: "Request body must include brand, goal, and tiers." },
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
  const tierSet = new Set(body.tiers);
  const filteredRows = sourceRows.filter(
    (row) => row.brand === body.brand && tierSet.has(String(row.tier)),
  );

  if (filteredRows.length === 0) {
    return NextResponse.json(
      { error: "No creator rows match the selected brand and tiers." },
      { status: 400 },
    );
  }

  const anthropic = new Anthropic({
    apiKey,
  });

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1500,
      system:
        "You are a sharp, data-driven creator investment strategist. Be concise, specific, and bold in your recommendations.",
      messages: [
        {
          role: "user",
          content: `You are a senior creator investment strategist. Brand: ${body.brand}. Campaign Goal: ${body.goal}. Creator data: ${rowsToMarkdownTable(filteredRows)}. Return a sharp investment recommendation with these sections: RECOMMENDED TIER STRATEGY, TOP 3 CREATORS TO INVEST IN, BUDGET SPLIT RECOMMENDATION, RISK FLAGS, ESTIMATED RETURNS. Be direct, data-backed, opinionated. Use specific numbers.`,
        },
      ],
    });

    return NextResponse.json({
      analysis: getTextFromAnthropicResponse(message),
      filteredRows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getAnthropicErrorMessage(error) },
      { status: 500 },
    );
  }
}
