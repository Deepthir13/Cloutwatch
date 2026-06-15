import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getCreatorRowsMentionedInOutput,
  rowsToMarkdownTable,
  runRiskAgent,
  runScoutAgent,
  runStrategistAgent,
} from "@/lib/agents";
import {
  getAnthropicApiKey,
  getAnthropicErrorMessage,
} from "@/lib/anthropicServer";
import { dataStore, type CreatorRow } from "@/lib/dataStore";
import { loadMockCampaigns } from "@/lib/mockCampaigns";
import { redFlagStore } from "@/lib/notificationStore";

export const dynamic = "force-dynamic";

type AgentsBody = {
  brand?: string;
  goal?: string;
  tiers?: string[];
  budget?: string;
};

type AgentStreamEvent =
  | {
      type: "scout";
      scout: string;
    }
  | {
      type: "risk";
      risk: string;
    }
  | {
      type: "strategy";
      strategy: string;
    }
  | {
      type: "complete";
      scout: string;
      risk: string;
      strategy: string;
    }
  | {
      type: "error";
      error: string;
    };

function enqueueEvent(controller: ReadableStreamDefaultController, event: AgentStreamEvent) {
  const encoder = new TextEncoder();

  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

function cleanRiskCell(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s*/, "")
    .trim();
}

function getAlertSeverity(reason: string): "CRITICAL" | "HIGH" {
  return /\bcritical\b/i.test(reason) ? "CRITICAL" : "HIGH";
}

function parseRedFlagCreators(riskOutput: string, shortlistedRows: CreatorRow[]) {
  const findings = new Map<
    string,
    { creator: string; reason: string; severity: "CRITICAL" | "HIGH" }
  >();
  const handles = shortlistedRows
    .map((row) => String(row.creator_handle ?? ""))
    .filter(Boolean);

  for (const line of riskOutput.split("\n")) {
    const trimmedLine = line.trim();

    if (!trimmedLine || !/\bRED\b/i.test(trimmedLine)) {
      continue;
    }

    if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
      const cells = trimmedLine
        .slice(1, -1)
        .split("|")
        .map(cleanRiskCell);

      if (cells.some((cell) => /^-+$/.test(cell)) || !cells.some((cell) => /^RED$/i.test(cell))) {
        continue;
      }

      const creator = cells[0] ?? "Unknown creator";
      const reason = cells.slice(2).join(" · ") || trimmedLine;

      findings.set(creator.toLowerCase(), {
        creator,
        reason,
        severity: getAlertSeverity(reason),
      });
      continue;
    }

    const matchedHandle = handles.find((handle) =>
      trimmedLine.toLowerCase().includes(handle.toLowerCase()),
    );

    if (matchedHandle) {
      findings.set(matchedHandle.toLowerCase(), {
        creator: matchedHandle,
        reason: cleanRiskCell(trimmedLine),
        severity: getAlertSeverity(trimmedLine),
      });
    }
  }

  return Array.from(findings.values());
}

async function getMitigationSteps({
  apiKey,
  brand,
  creator,
  reason,
}: {
  apiKey: string;
  brand: string;
  creator: string;
  reason: string;
}) {
  const anthropic = new Anthropic({
    apiKey,
  });
  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 180,
    messages: [
      {
        role: "user",
        content: `A creator ${creator} has been flagged RED for: ${reason}.
Brand: ${brand}.

Return only 3 short bullet points.
Each bullet must be 12 words or fewer.
No heading, no paragraph, no markdown bold.
Focus on immediate analyst actions.`,
      },
    ],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

async function handleRedFlagAlerts({
  requestUrl,
  brand,
  apiKey,
  riskOutput,
  shortlistedRows,
}: {
  requestUrl: string;
  brand: string;
  apiKey: string;
  riskOutput: string;
  shortlistedRows: CreatorRow[];
}) {
  const redFlagFindings = parseRedFlagCreators(riskOutput, shortlistedRows);
  const redFlagUrl = new URL("/api/email/redflag", requestUrl);

  for (const finding of redFlagFindings) {
    const mitigation = await getMitigationSteps({
      apiKey,
      brand,
      creator: finding.creator,
      reason: finding.reason,
    });

    redFlagStore.add({
      id: crypto.randomUUID(),
      brand,
      creator: finding.creator,
      reason: finding.reason,
      severity: finding.severity,
      mitigation,
      status: "unseen",
      createdAt: new Date().toISOString(),
    });

    await fetch(redFlagUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brand,
        creator: finding.creator,
        reason: finding.reason,
        severity: finding.severity,
      }),
    }).catch(() => null);
  }
}

export async function POST(request: Request) {
  let body: AgentsBody;

  try {
    body = (await request.json()) as AgentsBody;
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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const scout = await runScoutAgent({
          apiKey,
          brand: body.brand ?? "",
          goal: body.goal ?? "",
          tiers: body.tiers ?? [],
          creatorMarkdownTable: rowsToMarkdownTable(sourceRows),
        });
        enqueueEvent(controller, { type: "scout", scout });

        const scoutMentionedRows = getCreatorRowsMentionedInOutput(scout, sourceRows);
        const shortlistedRows =
          scoutMentionedRows.length > 0 ? scoutMentionedRows : filteredRows;
        const risk = await runRiskAgent({
          apiKey,
          scoutOutput: scout,
          shortlistedCreatorMarkdownTable: rowsToMarkdownTable(shortlistedRows),
        });
        await handleRedFlagAlerts({
          requestUrl: request.url,
          brand: body.brand ?? "",
          apiKey,
          riskOutput: risk,
          shortlistedRows,
        });
        enqueueEvent(controller, { type: "risk", risk });

        const strategy = await runStrategistAgent({
          apiKey,
          brand: body.brand ?? "",
          goal: body.goal ?? "",
          budget: body.budget,
          scoutOutput: scout,
          riskOutput: risk,
        });
        enqueueEvent(controller, { type: "strategy", strategy });
        enqueueEvent(controller, {
          type: "complete",
          scout,
          risk,
          strategy,
        });
      } catch (error) {
        enqueueEvent(controller, {
          type: "error",
          error: getAnthropicErrorMessage(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}
