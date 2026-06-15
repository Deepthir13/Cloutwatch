"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { type CreatorRow } from "@/lib/dataStore";

type DataResponse = {
  rows: CreatorRow[];
  isCustom: boolean;
};

type AgentId = "scout" | "risk" | "strategy";

type AgentOutputs = Record<AgentId, string>;

type SavedAgentRun = {
  outputs: AgentOutputs;
  activeAgent: AgentId;
  savedAt: string;
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

type RenderBlock =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "table";
      rows: string[][];
    }
  | {
      type: "line";
      text: string;
    };

type RenderSection = {
  heading: string;
  blocks: Exclude<RenderBlock, { type: "heading" }>[];
};

const goals = [
  "Brand Awareness",
  "Conversion & Sales",
  "Engagement & Community",
  "Product Launch",
  "Sentiment & Credibility",
];

const tiers = ["nano", "micro", "macro", "mega"];
const savedAgentRunPrefix = "creator-iq:agent-run:";

const agentSteps: {
  id: AgentId;
  label: string;
  role: string;
  icon: string;
  accent: "green" | "amber";
}[] = [
  {
    id: "scout",
    label: "Scout Agent",
    role: "Ranks creator upside",
    icon: "🔍",
    accent: "green",
  },
  {
    id: "risk",
    label: "Risk Agent",
    role: "Audits fit and safety",
    icon: "⚠",
    accent: "amber",
  },
  {
    id: "strategy",
    label: "Strategist Agent",
    role: "Builds the investment brief",
    icon: "📋",
    accent: "green",
  },
];

function getBrands(rows: CreatorRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.brand)
        .filter((brand): brand is string => typeof brand === "string" && brand.length > 0),
    ),
  ).sort();
}

function toNumber(value: CreatorRow[string]) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function cleanMarkdown(text: string) {
  return text
    .replace(/^[-*]\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^\*\*([^*]+)\*\*$/, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^\*+/, "")
    .replace(/\*+$/, "")
    .trim();
}

function isTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function parseTableRow(line: string) {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cleanMarkdown(cell));
}

function isSeparatorRow(row: string[]) {
  return row.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function getBlocks(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: RenderBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isTableLine(line)) {
      const tableLines: string[] = [];

      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const rows = tableLines.map(parseTableRow).filter((row) => !isSeparatorRow(row));

      if (rows.length > 0) {
        blocks.push({ type: "table", rows });
      }

      continue;
    }

    const cleaned = cleanMarkdown(line).replace(/^[-–—]+$/, "").trim();

    if (!cleaned) {
      index += 1;
      continue;
    }

    const isHeading =
      line.startsWith("#") ||
      /^[A-Z0-9][A-Z0-9\s&()/-]+:?$/.test(cleaned) ||
      cleaned.toLowerCase().startsWith("top 5 ranked creators") ||
      cleaned.toLowerCase().includes("recommended tier mix");

    blocks.push({
      type: isHeading ? "heading" : "line",
      text: cleaned.replace(/:$/, ""),
    });
    index += 1;
  }

  return blocks;
}

function getSections(blocks: RenderBlock[]) {
  const sections: RenderSection[] = [];

  blocks.forEach((block) => {
    if (block.type === "heading") {
      sections.push({
        heading: block.text,
        blocks: [],
      });
      return;
    }

    if (sections.length === 0) {
      sections.push({
        heading: "Recommendation Summary",
        blocks: [],
      });
    }

    sections[sections.length - 1].blocks.push(block);
  });

  return sections.filter((section) => section.blocks.length > 0);
}

function getRiskLevel(text: string) {
  const match = text.match(/\b(GREEN|AMBER|RED)\b/i);

  return match?.[1]?.toUpperCase() as "GREEN" | "AMBER" | "RED" | undefined;
}

function RiskBadge({ level }: { level: "GREEN" | "AMBER" | "RED" }) {
  const className = getRiskDotClassName(level);

  return (
    <span
      aria-label={`${level} risk`}
      title={`${level} risk`}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
    />
  );
}

function getRiskDotClassName(level: "GREEN" | "AMBER" | "RED") {
  const className =
    level === "GREEN"
      ? "bg-green-primary shadow-[0_0_10px_rgba(26,255,102,0.55)]"
      : level === "AMBER"
        ? "bg-amber-warn shadow-[0_0_10px_rgba(255,170,0,0.5)]"
        : "bg-red-flag shadow-[0_0_10px_rgba(255,68,68,0.5)]";

  return className;
}

function RiskDot({ level }: { level: "GREEN" | "AMBER" | "RED" }) {
  const className = getRiskDotClassName(level);

  return (
    <span
      aria-label={`${level} risk`}
      title={`${level} risk`}
      className={`inline-block h-4 w-4 shrink-0 rounded-full ${className}`}
    />
  );
}

function renderHighlightedText(text: string) {
  const tokens = text.split(/(@[\w.]+|\bGREEN\b|\bAMBER\b|\bRED\b|\bLOW\b|\bMEDIUM\b|\bHIGH\b)/g);

  return tokens.map((token, index) => {
    if (!token) {
      return null;
    }

    if (token.startsWith("@")) {
      return (
        <span
          key={`${token}-${index}`}
          className="mx-0.5 inline-flex rounded-full border border-green-dim/70 bg-green-ghost px-2 py-0.5 font-mono text-[0.72rem] font-semibold text-green-primary"
        >
          {token}
        </span>
      );
    }

    if (/^(GREEN|LOW)$/i.test(token)) {
      return (
        <span key={`${token}-${index}`} className="font-semibold text-green-primary">
          {token}
        </span>
      );
    }

    if (/^(AMBER|MEDIUM)$/i.test(token)) {
      return (
        <span key={`${token}-${index}`} className="font-semibold text-amber-warn">
          {token}
        </span>
      );
    }

    if (/^(RED|HIGH)$/i.test(token)) {
      return (
        <span key={`${token}-${index}`} className="font-semibold text-red-flag">
          {token}
        </span>
      );
    }

    return <Fragment key={`${token}-${index}`}>{token}</Fragment>;
  });
}

function splitReasonIntoPoints(value: string) {
  const cleaned = cleanMarkdown(value).replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return [];
  }

  const bySemicolon = cleaned.split(/\s*;\s+/).map((part) => part.trim()).filter(Boolean);
  if (bySemicolon.length > 1) {
    return bySemicolon.slice(0, 4);
  }

  const byBullet = cleaned
    .split(/\s*(?:\d+\.\s+|[-•]\s+)/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (byBullet.length > 1) {
    return byBullet.slice(0, 4);
  }

  // Split on real sentence ends only — never break decimals like 0.84 or $0.05
  const bySentence = cleaned
    .split(/\.\s+(?=[A-Z(])/)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter(Boolean);

  if (bySentence.length > 1) {
    return bySentence.slice(0, 4);
  }

  return [cleaned];
}

function RenderCell({
  value,
  showRiskBadge,
  isReasonCell,
  isRiskLevelCell,
}: {
  value: string;
  showRiskBadge: boolean;
  isReasonCell: boolean;
  isRiskLevelCell: boolean;
}) {
  const riskLevel = showRiskBadge ? getRiskLevel(value) : undefined;
  const reasonPoints = isReasonCell ? splitReasonIntoPoints(value) : [];

  if (isRiskLevelCell && riskLevel) {
    return (
      <span className="flex justify-center">
        <RiskDot level={riskLevel} />
      </span>
    );
  }

  return (
    <span className="flex items-start gap-2">
      {riskLevel ? <RiskBadge level={riskLevel} /> : null}
      {reasonPoints.length > 0 ? (
        <ul className="space-y-2">
          {reasonPoints.map((point, index) => (
            <li
              key={`${point}-${index}`}
              className="flex gap-2 text-sm leading-6 text-grey-100"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-grey-500" />
              <span className="break-words">{renderHighlightedText(point)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span>{renderHighlightedText(value)}</span>
      )}
    </span>
  );
}

function getInsightLabel(text: string, fallbackIndex: number) {
  const [label, ...rest] = text.split(":");

  if (rest.length > 0 && label.length <= 64) {
    return {
      label,
      body: rest.join(":").trim(),
    };
  }

  const handleMatch = text.match(/(@[\w.]+(?:\s*(?:,|and)\s*@[\w.]+)*)/);

  return {
    label: handleMatch?.[1] ?? `Insight ${fallbackIndex + 1}`,
    body: text,
  };
}

function InsightCard({
  text,
  index,
  agentId,
  accent,
}: {
  text: string;
  index: number;
  agentId: AgentId;
  accent: "green" | "amber";
}) {
  const riskLevel = agentId === "risk" ? getRiskLevel(text) : undefined;
  const insight = getInsightLabel(text, index);
  const accentClass = accent === "amber" ? "text-amber-warn" : "text-green-primary";
  const borderClass = accent === "amber" ? "border-amber-warn/30" : "border-green-dim/40";

  return (
    <article className={`rounded-2xl border ${borderClass} bg-bg-card/80 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${borderClass} bg-bg-surface font-mono text-[0.68rem] font-bold ${accentClass}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <h4 className="text-sm font-semibold text-grey-100">
            {renderHighlightedText(insight.label)}
          </h4>
        </div>
        {riskLevel ? <RiskBadge level={riskLevel} /> : null}
      </div>
      <p className="text-sm leading-7 text-grey-300">
        {renderHighlightedText(insight.body)}
      </p>
    </article>
  );
}

function OutputTable({
  rows,
  agentId,
  accent,
}: {
  rows: string[][];
  agentId: AgentId;
  accent: "green" | "amber";
}) {
  const [headerRow, ...bodyRows] = rows;
  const accentText = accent === "amber" ? "text-amber-warn" : "text-green-primary";
  const hasRiskLevelColumn = headerRow.some((header) => /risk\s*level/i.test(header));

  function getColumnClass(header: string, cellIndex: number) {
    const normalizedHeader = header.toLowerCase();
    const base = "px-4 py-4 align-top leading-6 text-grey-100";

    if (/risk\s*level/.test(normalizedHeader)) {
      return `${base} w-28 text-center`;
    }

    if (/rank|allocation|amount|budget|emv|range|score|%/.test(normalizedHeader)) {
      return `${base} whitespace-nowrap text-center font-mono tabular-nums`;
    }

    if (/creator|handle/.test(normalizedHeader) || cellIndex <= 1) {
      return `${base} whitespace-nowrap font-semibold`;
    }

    if (/why|fit|rationale|reason|status/.test(normalizedHeader)) {
      return `${base} min-w-[380px] max-w-[640px] break-words`;
    }

    return base;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-card shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-[linear-gradient(135deg,rgba(26,255,102,0.08),rgba(255,255,255,0.02))] px-4 py-3">
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-grey-500">
          Structured recommendation
        </p>
        {agentId === "risk" && hasRiskLevelColumn ? (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-grey-500">
            <span>Risk:</span>
            {(["GREEN", "AMBER", "RED"] as const).map((level) => (
              <span key={level} className="inline-flex items-center gap-1.5">
                <RiskBadge level={level} />
                {level}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-auto border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-surface/80">
              {headerRow.map((cell) => (
                <th
                  key={cell}
                  className={`px-4 py-3 font-mono text-[0.66rem] font-bold uppercase tracking-[0.14em] ${accentText}`}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr
                key={`${row.join("-")}-${rowIndex}`}
                className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-bg-surface/60"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${cell}-${cellIndex}`}
                    className={getColumnClass(headerRow[cellIndex] ?? "", cellIndex)}
                  >
                    <RenderCell
                      value={cell}
                      showRiskBadge={agentId === "risk"}
                      isReasonCell={/why|fit|rationale|reason/i.test(
                        headerRow[cellIndex] ?? "",
                      )}
                      isRiskLevelCell={/risk\s*level/i.test(headerRow[cellIndex] ?? "")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormattedAgentOutput({
  content,
  agentId,
  accent,
}: {
  content: string;
  agentId: AgentId;
  accent: "green" | "amber";
}) {
  const blocks = getBlocks(content);
  const sections = getSections(blocks);
  const accentText = accent === "amber" ? "text-amber-warn" : "text-green-primary";

  return (
    <div className="space-y-5">
      {sections.map((section, sectionIndex) => (
        <section
          key={`${section.heading}-${sectionIndex}`}
          className="overflow-hidden rounded-3xl border border-border-subtle bg-bg-elevated/70"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(26,255,102,0.12),transparent_32%)] px-5 py-4">
            <div>
              <p className={`font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] ${accentText}`}>
                {section.heading}
              </p>
              <p className="mt-1 text-xs text-grey-500">
                {section.blocks.length} {section.blocks.length === 1 ? "item" : "items"}
              </p>
            </div>
            <span className={`h-2 w-2 rounded-full ${accent === "amber" ? "bg-amber-warn" : "bg-green-primary"}`} />
          </div>

          <div className="space-y-4 p-4">
            {section.blocks.map((block, blockIndex) => {
              if (block.type === "table") {
                return (
                  <OutputTable
                    key={`table-${sectionIndex}-${blockIndex}`}
                    rows={block.rows}
                    agentId={agentId}
                    accent={accent}
                  />
                );
              }

              return (
                <InsightCard
                  key={`${block.text}-${sectionIndex}-${blockIndex}`}
                  text={block.text}
                  index={blockIndex}
                  agentId={agentId}
                  accent={accent}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function AgentStage({
  step,
  output,
  isActive,
  isRunning,
  onSelect,
}: {
  step: (typeof agentSteps)[number];
  output: string;
  isActive: boolean;
  isRunning: boolean;
  onSelect: () => void;
}) {
  const isComplete = output.length > 0;
  const accent =
    step.accent === "amber"
      ? {
          text: "text-amber-warn",
          border: "border-amber-warn",
          bg: "bg-amber-warn/10",
          shadow: "shadow-[0_0_24px_rgba(255,170,0,0.18)]",
        }
      : {
          text: "text-green-primary",
          border: "border-green-primary",
          bg: "bg-green-ghost",
          shadow: "shadow-[0_0_24px_rgba(26,255,102,0.22)]",
        };

  return (
    <article
      className={[
        "relative rounded-3xl border bg-bg-elevated p-4 transition-all",
        isActive || isComplete
          ? `${accent.border} ${accent.shadow}`
          : "border-border-subtle",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!isComplete && !isRunning}
        className="flex w-full items-center justify-between gap-4 text-left disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-4">
          <span
            className={[
              "flex h-12 w-12 items-center justify-center rounded-2xl border text-xl",
              isComplete || isRunning
                ? `${accent.border} ${accent.bg}`
                : "border-border-subtle bg-bg-surface grayscale",
            ].join(" ")}
          >
            {step.icon}
          </span>
          <span>
            <span className={`block font-mono text-xs font-bold uppercase tracking-[0.18em] ${isComplete || isRunning ? accent.text : "text-grey-500"}`}>
              {step.label}
            </span>
            <span className="mt-1 block text-sm text-grey-300">{step.role}</span>
          </span>
        </span>
        <span
          className={[
            "rounded-full border px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em]",
            isComplete
              ? `${accent.border} ${accent.bg} ${accent.text}`
              : isRunning
                ? "border-green-dim bg-green-ghost text-green-primary"
                : "border-border-subtle bg-bg-surface text-grey-500",
          ].join(" ")}
        >
          {isComplete ? "View output" : isRunning ? "Running" : "Queued"}
        </span>
      </button>

      {isActive && output ? (
        <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-surface/70 px-4 py-3 text-sm text-grey-300">
          Output is open in the viewer.
        </div>
      ) : null}
    </article>
  );
}

export function CreatorAgentWorkflow() {
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedGoal, setSelectedGoal] = useState(goals[0]);
  const [selectedTiers, setSelectedTiers] = useState<string[]>(tiers);
  const [budget, setBudget] = useState("");
  const [agentOutputs, setAgentOutputs] = useState<AgentOutputs>({
    scout: "",
    risk: "",
    strategy: "",
  });
  const [activeAgent, setActiveAgent] = useState<AgentId>("scout");
  const [analysisError, setAnalysisError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [savedRun, setSavedRun] = useState<SavedAgentRun | null>(null);
  const [saveStatus, setSaveStatus] = useState("");

  async function loadData() {
    try {
      const response = await fetch("/api/data");

      if (!response.ok) {
        setLoadError("Failed to load creator data.");
        return;
      }

      const payload = (await response.json()) as DataResponse;
      const brands = getBrands(payload.rows);

      setRows(payload.rows);
      setIsCustom(payload.isCustom);
      setSelectedBrand((currentBrand) => currentBrand || brands[0] || "");
      setLoadError("");
    } catch {
      setLoadError("Failed to load creator data.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const savedRunKey = useMemo(
    () =>
      `${savedAgentRunPrefix}${JSON.stringify({
        brand: selectedBrand,
        goal: selectedGoal,
        tiers: [...selectedTiers].sort(),
        budget: budget.trim() || "unspecified",
      })}`,
    [budget, selectedBrand, selectedGoal, selectedTiers],
  );

  useEffect(() => {
    if (!selectedBrand) {
      setSavedRun(null);
      return;
    }

    try {
      const saved = window.localStorage.getItem(savedRunKey);
      setSavedRun(saved ? (JSON.parse(saved) as SavedAgentRun) : null);
    } catch {
      setSavedRun(null);
    }
    setSaveStatus("");
  }, [savedRunKey, selectedBrand]);

  const brands = useMemo(() => getBrands(rows), [rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.brand === selectedBrand &&
          selectedTiers.includes(String(row.tier)),
      ),
    [rows, selectedBrand, selectedTiers],
  );
  const totalEmv = filteredRows.reduce((sum, row) => sum + toNumber(row.EMV), 0);
  const avgCpe =
    filteredRows.length > 0
      ? filteredRows.reduce((sum, row) => sum + toNumber(row.CPE), 0) /
        filteredRows.length
      : 0;

  function toggleTier(tier: string) {
    setSelectedTiers((currentTiers) =>
      currentTiers.includes(tier)
        ? currentTiers.filter((currentTier) => currentTier !== tier)
        : [...currentTiers, tier],
    );
  }

  function selectCompletedAgent(agentId: AgentId, output: string, isRunning: boolean) {
    if (output || isRunning) {
      setActiveAgent(agentId);
    }
  }

  function saveAgentRun() {
    const hasOutput = Object.values(agentOutputs).some(Boolean);

    if (!hasOutput) {
      return;
    }

    const nextSavedRun = {
      outputs: agentOutputs,
      activeAgent,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(savedRunKey, JSON.stringify(nextSavedRun));
      setSavedRun(nextSavedRun);
      setSaveStatus("Saved");
    } catch {
      setSaveStatus("Could not save");
    }
  }

  function loadSavedAgentRun() {
    if (!savedRun) {
      return;
    }

    setAgentOutputs(savedRun.outputs);
    setActiveAgent(savedRun.activeAgent);
    setAnalysisError("");
    setSaveStatus("Loaded saved output");
  }

  function clearSavedAgentRun() {
    window.localStorage.removeItem(savedRunKey);
    setSavedRun(null);
    setSaveStatus("Saved output cleared");
  }

  async function launchAgents() {
    setIsAnalyzing(true);
    setAgentOutputs({
      scout: "",
      risk: "",
      strategy: "",
    });
    setActiveAgent("scout");
    setAnalysisError("");
    setSaveStatus("");

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brand: selectedBrand,
          goal: selectedGoal,
          tiers: selectedTiers,
          budget: budget.trim() || "unspecified",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setAnalysisError(payload?.error ?? "Agent launch failed.");
        return;
      }

      if (!response.body) {
        setAnalysisError("Agent stream failed to start.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const event = JSON.parse(line) as AgentStreamEvent;

          if (event.type === "error") {
            setAnalysisError(event.error);
            continue;
          }

          if (event.type === "scout") {
            setAgentOutputs((current) => ({ ...current, scout: event.scout }));
            setActiveAgent("scout");
          }

          if (event.type === "risk") {
            setAgentOutputs((current) => ({ ...current, risk: event.risk }));
            setActiveAgent("risk");
          }

          if (event.type === "strategy") {
            setAgentOutputs((current) => ({ ...current, strategy: event.strategy }));
            setActiveAgent("strategy");
          }

          if (event.type === "complete") {
            setAgentOutputs({
              scout: event.scout,
              risk: event.risk,
              strategy: event.strategy,
            });
          }
        }
      }
    } catch {
      setAnalysisError("Agent run failed. Check the API route and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const activeIndex = agentSteps.findIndex((step) => step.id === activeAgent);
  const hasAgentOutput = Object.values(agentOutputs).some(Boolean);

  return (
    <div className="space-y-6">
      {loadError ? (
        <ErrorCard
          message={loadError}
          onRetry={() => {
            setLoadError("");
            void loadData();
          }}
        />
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-border-subtle bg-bg-card">
        <div className="border-b border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(26,255,102,0.14),transparent_35%),#161616] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-green-primary">
                Creator Pick Desk
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-grey-100">
                Pick creators to invest in
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-grey-300">
                Scout ranks the field, Risk audits the shortlist, and Strategist
                turns it into a meeting-ready investment brief.
              </p>
            </div>
            <span
              className={[
                "rounded-full border px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                isCustom
                  ? "border-green-dim bg-green-ghost text-green-primary"
                  : "border-border-subtle bg-bg-surface text-grey-500",
              ].join(" ")}
            >
              {isCustom ? "Custom upload" : "Mock dataset"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Brand
            </span>
            <select
              value={selectedBrand}
              onChange={(event) => setSelectedBrand(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors focus:border-green-primary"
            >
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Campaign Goal
            </span>
            <select
              value={selectedGoal}
              onChange={(event) => setSelectedGoal(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors focus:border-green-primary"
            >
              {goals.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Budget Optional
            </span>
            <input
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="e.g. $75k"
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors placeholder:text-grey-500 focus:border-green-primary"
            />
          </label>

          <div className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Tiers
            </span>
            <div className="grid grid-cols-2 gap-2">
              {tiers.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => toggleTier(tier)}
                  className={[
                    "rounded-lg border px-3 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors",
                    selectedTiers.includes(tier)
                      ? "border-green-dim bg-green-ghost text-green-primary"
                      : "border-border-subtle bg-bg-surface text-grey-500 hover:text-grey-100",
                  ].join(" ")}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Creators in scope", String(filteredRows.length)],
          ["Projected EMV pool", `$${formatCompact(totalEmv)}`],
          ["Avg CPE", `$${avgCpe.toFixed(2)}`],
        ].map(([label, value]) => (
          <article
            key={label}
            className="rounded-2xl border border-border-subtle bg-bg-card p-5"
          >
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-green-primary">
              {value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-border-subtle bg-bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
              Agent pipeline
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-grey-100">
              Launch the investment desk
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savedRun ? (
              <button
                type="button"
                onClick={loadSavedAgentRun}
                disabled={isAnalyzing}
                className="rounded-md border border-border-subtle bg-bg-surface px-4 py-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-grey-100 transition-colors hover:border-green-dim hover:text-green-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Load Saved
              </button>
            ) : null}
            <button
              type="button"
              disabled={!hasAgentOutput || isAnalyzing}
              onClick={saveAgentRun}
              className="rounded-md border border-border-subtle px-4 py-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-grey-300 transition-colors hover:border-green-dim hover:text-green-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Output
            </button>
            {savedRun ? (
              <button
                type="button"
                onClick={clearSavedAgentRun}
                disabled={isAnalyzing}
                className="rounded-md border border-border-subtle px-4 py-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-grey-500 transition-colors hover:text-red-flag disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              disabled={!selectedBrand || selectedTiers.length === 0 || isAnalyzing}
              onClick={launchAgents}
              className="inline-flex items-center gap-3 rounded-md border border-green-dim bg-green-ghost px-5 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-primary transition-colors hover:bg-green-primary hover:text-bg-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-primary border-t-transparent" />
              ) : null}
              ⬡ LAUNCH AGENTS
            </button>
          </div>
        </div>

        {(savedRun || saveStatus) ? (
          <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-surface px-4 py-3 text-sm text-grey-300">
            {saveStatus ||
              `Saved output available from ${new Date(savedRun?.savedAt ?? "").toLocaleString()}.`}
          </div>
        ) : null}

        {analysisError ? (
          <div className="mt-5">
            <ErrorCard
              message={analysisError}
              onRetry={() => {
                setAnalysisError("");
                void launchAgents();
              }}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            {agentSteps.map((step, index) => {
              const output = agentOutputs[step.id];
              const previousComplete =
                index === 0 || agentOutputs[agentSteps[index - 1].id].length > 0;
              const isRunning = isAnalyzing && !output && previousComplete;

              return (
                <Fragment key={step.id}>
                  <AgentStage
                    step={step}
                    output={output}
                    isActive={activeAgent === step.id}
                    isRunning={isRunning}
                    onSelect={() => selectCompletedAgent(step.id, output, isRunning)}
                  />
                  {index < agentSteps.length - 1 ? (
                    <div className="ml-8 h-6 w-px bg-gradient-to-b from-green-primary/70 to-border-subtle" />
                  ) : null}
                </Fragment>
              );
            })}
          </div>

          <div className="rounded-3xl border border-border-subtle bg-bg-elevated p-5">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.18em] text-green-primary">
                  Output Viewer
                </p>
                <h3 className="mt-1 text-xl font-semibold text-grey-100">
                  {agentSteps[activeIndex]?.label ?? "Scout Agent"}
                </h3>
              </div>
              <span className="rounded-full border border-border-subtle bg-bg-card px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-grey-500">
                Click an agent on the left
              </span>
            </div>

            {agentOutputs[activeAgent] ? (
              <FormattedAgentOutput
                content={agentOutputs[activeAgent]}
                agentId={activeAgent}
                accent={agentSteps[activeIndex]?.accent ?? "green"}
              />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-bg-card/60 p-8 text-center">
                <div>
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-grey-500">
                    Awaiting agent output
                  </p>
                  <p className="mt-3 max-w-md text-sm leading-6 text-grey-300">
                    Launch agents to populate this viewer. Each completed stage
                    lights up on the left, then you can click it to inspect the
                    formatted recommendation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
