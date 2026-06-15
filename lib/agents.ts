import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { REQUIRED_COLS, type CreatorRow } from "@/lib/dataStore";

const MODEL = "claude-opus-4-6";
const MAX_TOKENS = 1200;

type AgentClientOptions = {
  apiKey: string;
};

type ScoutAgentInput = {
  brand: string;
  goal: string;
  tiers: string[];
  creatorMarkdownTable: string;
};

type RiskAgentInput = {
  scoutOutput: string;
  shortlistedCreatorMarkdownTable: string;
};

type StrategistAgentInput = {
  brand: string;
  goal: string;
  budget?: string;
  scoutOutput: string;
  riskOutput: string;
};

function escapeMarkdownCell(value: CreatorRow[string]) {
  return String(value ?? "").replaceAll("|", "\\|");
}

export function rowsToMarkdownTable(rows: CreatorRow[]) {
  const columns = REQUIRED_COLS;
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${columns.map((column) => escapeMarkdownCell(row[column])).join(" | ")} |`,
  );

  return [header, separator, ...body].join("\n");
}

export function getTextFromAnthropicResponse(message: Message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

function getAnthropicClient({ apiKey }: AgentClientOptions) {
  return new Anthropic({
    apiKey,
  });
}

async function runAgent({
  apiKey,
  system,
  prompt,
}: AgentClientOptions & {
  system: string;
  prompt: string;
}) {
  const anthropic = getAnthropicClient({ apiKey });
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return getTextFromAnthropicResponse(message);
}

export async function runScoutAgent({
  apiKey,
  brand,
  goal,
  tiers,
  creatorMarkdownTable,
}: AgentClientOptions & ScoutAgentInput) {
  return runAgent({
    apiKey,
    system:
      "You are a creator talent scout. Your job is to find the best creator matches for a campaign goal. Be specific, data-driven, and rank ruthlessly.",
    prompt: `Brand: ${brand}
Campaign goal: ${goal}
Requested tiers: ${tiers.join(", ")}

Full creator dataset:
${creatorMarkdownTable}

Return structured markdown with exactly these sections:
1. Top 5 ranked creators as a markdown table with columns: rank, handle, tier, platform, why they fit, predicted EMV range. Keep "why they fit" to exactly 2-3 short semicolon-separated points, max 8 words per point. No paragraphs.
2. Recommended tier mix, using exact percentages that add to 100%. Keep each rationale to 1 concise sentence.
3. One creator to watch but not yet commit to, in 1 concise sentence`,
  });
}

export async function runRiskAgent({
  apiKey,
  scoutOutput,
  shortlistedCreatorMarkdownTable,
}: AgentClientOptions & RiskAgentInput) {
  return runAgent({
    apiKey,
    system:
      "You are a creator risk auditor. You review creator shortlists for red flags, anomalies, and brand safety issues. Be skeptical. Catch what others miss.",
    prompt: `Scout Agent output:
${scoutOutput}

Full creator data for the shortlisted creators:
${shortlistedCreatorMarkdownTable}

Return structured markdown with exactly these sections:
1. Risk level per creator: GREEN / AMBER / RED with one-line reason, max 14 words per creator
2. Overall campaign risk score: LOW / MEDIUM / HIGH
3. Any creator that should be immediately removed and why, max 1 concise sentence
4. One systemic risk across the whole shortlist if any, max 1 concise sentence`,
  });
}

export async function runStrategistAgent({
  apiKey,
  brand,
  goal,
  budget,
  scoutOutput,
  riskOutput,
}: AgentClientOptions & StrategistAgentInput) {
  return runAgent({
    apiKey,
    system:
      "You are a senior creator investment strategist. You synthesize talent recommendations and risk reports into a final investment brief. Be decisive and meeting-ready.",
    prompt: `Brand: ${brand}
Campaign goal: ${goal}
Budget: ${budget?.trim() || "unspecified"}

Scout Agent output:
${scoutOutput}

Risk Agent output:
${riskOutput}

Return the final brief with exactly these sections:
1. Final recommended creator list after the risk filter
2. Budget split across tiers with exact percentages
3. Expected blended EMV range
4. 3 things to say in the client meeting, each as a short bullet
5. 1 risk to monitor going forward, max 1 concise sentence`,
  });
}

export function getCreatorRowsMentionedInOutput(output: string, rows: CreatorRow[]) {
  const normalizedOutput = output.toLowerCase();

  return rows.filter((row) => {
    const handle = String(row.creator_handle ?? "").toLowerCase();

    return handle.length > 0 && normalizedOutput.includes(handle);
  });
}
