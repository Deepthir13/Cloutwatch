"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { REQUIRED_COLS, type CreatorRow } from "@/lib/dataStore";

type DataResponse = {
  rows: CreatorRow[];
  isCustom: boolean;
};

type ChartTab =
  | "engagement"
  | "cpe"
  | "sentiment"
  | "ranking";

const goals = [
  "Brand Awareness",
  "Conversion & Sales",
  "Engagement & Community",
  "Product Launch",
  "Sentiment & Credibility",
];

const tiers = ["nano", "micro", "macro", "mega"];

const tierColors: Record<string, string> = {
  nano: "#1aff66",
  micro: "#0dcc4e",
  macro: "#ffaa00",
  mega: "#ff6644",
};

const chartTabs: { id: ChartTab; label: string }[] = [
  { id: "engagement", label: "Engagement vs EMV" },
  { id: "cpe", label: "CPE by Tier" },
  { id: "sentiment", label: "Sentiment Map" },
  { id: "ranking", label: "Creator Ranking" },
];

function toNumber(value: CreatorRow[string]) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toBoolean(value: CreatorRow[string]) {
  return value === true || String(value).toLowerCase() === "true";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDelta(current: number, previous: number, lowerIsBetter = false) {
  if (previous === 0) {
    return {
      value: 0,
      positive: true,
    };
  }

  const delta = ((current - previous) / previous) * 100;

  return {
    value: delta,
    positive: lowerIsBetter ? delta <= 0 : delta >= 0,
  };
}

function getSentimentColor(sentiment: number) {
  if (sentiment >= 0.85) {
    return "#1aff66";
  }

  if (sentiment >= 0.78) {
    return "#ffaa00";
  }

  return "#ff4444";
}

function getKpis(rows: CreatorRow[]) {
  const avgEngRate = average(rows.map((row) => toNumber(row.eng_rate)));
  const prevAvgEngRate = average(rows.map((row) => toNumber(row.prev_eng_rate)));
  const totalEmv = rows.reduce((sum, row) => sum + toNumber(row.EMV), 0);
  const prevTotalEmv = rows.reduce((sum, row) => sum + toNumber(row.prev_EMV), 0);
  const avgCpe = average(rows.map((row) => toNumber(row.CPE)));
  const prevAvgCpe = average(rows.map((row) => toNumber(row.prev_CPE)));
  const avgSentiment = average(rows.map((row) => toNumber(row.sentiment_score)));
  const prevAvgSentiment = average(
    rows.map((row) => toNumber(row.prev_sentiment_score)),
  );
  const flagCount = rows.filter((row) => toBoolean(row.fake_follower_flag)).length;

  return [
    {
      label: "Avg Eng Rate",
      value: `${avgEngRate.toFixed(1)}%`,
      delta: getDelta(avgEngRate, prevAvgEngRate),
    },
    {
      label: "Total EMV",
      value: `$${formatCompact(totalEmv)}`,
      delta: getDelta(totalEmv, prevTotalEmv),
    },
    {
      label: "Avg CPE",
      value: `$${avgCpe.toFixed(2)}`,
      delta: getDelta(avgCpe, prevAvgCpe, true),
    },
    {
      label: "Avg Sentiment",
      value: avgSentiment.toFixed(2),
      delta: getDelta(avgSentiment, prevAvgSentiment),
    },
    {
      label: "Flag Count",
      value: String(flagCount),
      delta: {
        value: flagCount === 0 ? 0 : 100,
        positive: flagCount === 0,
      },
    },
  ];
}

function normalize(value: number, min: number, max: number, invert = false) {
  if (max === min) {
    return 50;
  }

  const normalized = ((value - min) / (max - min)) * 100;

  return invert ? 100 - normalized : normalized;
}

function getRankingRows(rows: CreatorRow[]) {
  const emvValues = rows.map((row) => toNumber(row.EMV));
  const cpeValues = rows.map((row) => toNumber(row.CPE));
  const minEmv = Math.min(...emvValues, 0);
  const maxEmv = Math.max(...emvValues, 0);
  const minCpe = Math.min(...cpeValues, 0);
  const maxCpe = Math.max(...cpeValues, 0);

  return rows
    .map((row) => {
      const score =
        toNumber(row.eng_rate) * 0.3 +
        normalize(toNumber(row.EMV), minEmv, maxEmv) * 0.25 +
        normalize(toNumber(row.CPE), minCpe, maxCpe, true) * 0.2 +
        toNumber(row.sentiment_score) * 100 * 0.15 +
        toNumber(row.past_brand_fit_score) * 10 * 0.1 -
        (toBoolean(row.fake_follower_flag) ? 15 : 0);

      return {
        creator: String(row.creator_handle),
        score: Number(score.toFixed(1)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function getTierCpeRows(rows: CreatorRow[]) {
  return tiers.map((tier) => {
    const tierRows = rows.filter((row) => row.tier === tier);

    return {
      tier,
      current: Number(average(tierRows.map((row) => toNumber(row.CPE))).toFixed(3)),
      previous: Number(
        average(tierRows.map((row) => toNumber(row.prev_CPE))).toFixed(3),
      ),
    };
  });
}

type TooltipEntry = {
  name?: string;
  value?: unknown;
  dataKey?: string;
  payload?: unknown;
};

type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
};

function getPayload<T>(entry: unknown): T {
  if (entry && typeof entry === "object" && "payload" in entry) {
    return (entry as { payload: T }).payload;
  }

  return entry as T;
}

function formatTooltipValue(key: string | undefined, value: unknown) {
  const numberValue = Number(value);

  if (key?.toLowerCase().includes("emv")) {
    return `$${formatCompact(numberValue)}`;
  }

  if (key?.toLowerCase().includes("cpe")) {
    return `$${numberValue.toFixed(3)}`;
  }

  if (key?.toLowerCase().includes("rate")) {
    return `${numberValue.toFixed(1)}%`;
  }

  if (key?.toLowerCase().includes("sentiment")) {
    return numberValue.toFixed(2);
  }

  if (typeof value === "number") {
    return value.toFixed(1);
  }

  return String(value ?? "");
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const source = payload[0]?.payload as Record<string, unknown> | undefined;
  const title =
    source?.creator_handle ?? source?.creator ?? source?.tier ?? label ?? "Selection";

  return (
    <div className="rounded-xl border border-green-primary bg-bg-elevated px-4 py-3 shadow-[0_0_24px_rgba(26,255,102,0.16)]">
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
        {String(title)}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <p key={`${entry.dataKey ?? entry.name}`} className="text-xs text-grey-100">
            <span className="text-grey-500">{entry.name ?? entry.dataKey}: </span>
            {formatTooltipValue(entry.dataKey, entry.value)}
          </p>
        ))}
      </div>
    </div>
  );
}

function getBrands(rows: CreatorRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.brand)
        .filter((brand): brand is string => typeof brand === "string" && brand.length > 0),
    ),
  ).sort();
}

function getRoiInsight(tab: ChartTab, point: unknown) {
  if (tab === "cpe") {
    const row = getPayload<{ tier: string; current: number; previous: number }>(point);
    const delta = row.current - row.previous;
    const direction = delta <= 0 ? "improved" : "got more expensive";

    return `${row.tier.toUpperCase()} creators now average $${row.current.toFixed(
      3,
    )} CPE vs $${row.previous.toFixed(3)} before, so this tier ${direction} by $${Math.abs(
      delta,
    ).toFixed(3)} per engagement.`;
  }

  if (tab === "ranking") {
    const row = getPayload<{ creator: string; score: number }>(point);

    return `${row.creator} has a composite investment score of ${row.score}. This blends engagement, EMV, CPE efficiency, sentiment, brand fit, and fake-follower risk into one ranking signal.`;
  }

  const row = getPayload<CreatorRow>(point);
  const creator = String(row.creator_handle ?? "This creator");

  if (tab === "sentiment") {
    const sentiment = toNumber(row.sentiment_score);
    const engRate = toNumber(row.eng_rate);
    const zone =
      sentiment >= 0.85
        ? "strong trust zone"
        : sentiment >= 0.78
          ? "watch zone"
          : "risk zone";

    return `${creator} sits at ${sentiment.toFixed(
      2,
    )} sentiment with ${engRate.toFixed(
      1,
    )}% engagement. That places them in the ${zone}, so read this point as audience quality plus response strength.`;
  }

  return `${creator} pairs ${toNumber(row.eng_rate).toFixed(1)}% engagement with $${formatCompact(
    toNumber(row.EMV),
  )} EMV. Higher and farther right means stronger awareness value; low-left points need a tighter budget or clearer conversion role.`;
}

export default function RoiAnalyzerPage() {
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedGoal, setSelectedGoal] = useState(goals[0]);
  const [selectedTiers, setSelectedTiers] = useState<string[]>(tiers);
  const [activeTab, setActiveTab] = useState<ChartTab>("engagement");
  const [sortColumn, setSortColumn] = useState("EMV");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [loadError, setLoadError] = useState("");
  const [chartInsight, setChartInsight] = useState("");
  const [isMounted, setIsMounted] = useState(false);

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
    setIsMounted(true);
    void loadData();
  }, []);

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
  const kpis = useMemo(() => getKpis(filteredRows), [filteredRows]);
  const rankingRows = useMemo(() => getRankingRows(filteredRows), [filteredRows]);
  const tierCpeRows = useMemo(() => getTierCpeRows(filteredRows), [filteredRows]);
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      const aNumber = Number(aValue);
      const bNumber = Number(bValue);
      const direction = sortDirection === "asc" ? 1 : -1;

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return (aNumber - bNumber) * direction;
      }

      return String(aValue ?? "").localeCompare(String(bValue ?? "")) * direction;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  function toggleTier(tier: string) {
    setSelectedTiers((currentTiers) =>
      currentTiers.includes(tier)
        ? currentTiers.filter((currentTier) => currentTier !== tier)
        : [...currentTiers, tier],
    );
  }

  function updateSort(column: string) {
    if (column === sortColumn) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("desc");
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="ROI ANALYZER"
          subtitle="Creator investment intelligence · campaign performance"
          badge="Strategy Engine"
        />
        <span
          className={[
            "rounded-full border px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
            isCustom
              ? "border-green-dim bg-green-ghost text-green-primary"
              : "border-border-subtle bg-bg-card text-grey-500",
          ].join(" ")}
        >
          {isCustom ? "Custom upload" : "Mock dataset"}
        </span>
      </div>

      {loadError ? (
        <ErrorCard
          message={loadError}
          onRetry={() => {
            setLoadError("");
            void loadData();
          }}
        />
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-border-subtle bg-bg-card p-5 lg:grid-cols-3">
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

        <div className="space-y-2">
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
            Tiers
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <label
                key={tier}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-300"
              >
                <input
                  type="checkbox"
                  checked={selectedTiers.includes(tier)}
                  onChange={() => toggleTier(tier)}
                  className="accent-green-primary"
                />
                {tier}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-2xl border border-border-subtle bg-bg-card p-4"
          >
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              {kpi.label}
            </p>
            <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-green-primary">
              {kpi.value}
            </p>
            <p
              className={[
                "mt-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em]",
                kpi.delta.positive ? "text-green-primary" : "text-red-flag",
              ].join(" ")}
            >
              {kpi.delta.value >= 0 ? "+" : ""}
              {kpi.delta.value.toFixed(1)}% vs prev
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
        <div className="mb-5 flex flex-wrap gap-2">
          {chartTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setChartInsight("");
              }}
              className={[
                "rounded-md px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] transition-colors",
                activeTab === tab.id
                  ? "bg-green-ghost text-green-primary"
                  : "text-grey-500 hover:bg-green-ghost hover:text-green-primary",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className={
            activeTab === "engagement" || activeTab === "sentiment"
              ? "h-[400px]"
              : "h-[300px]"
          }
        >
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%">
            {activeTab === "engagement" ? (
              <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="#242424" />
                <XAxis
                  type="number"
                  dataKey="eng_rate"
                  name="Eng Rate"
                  stroke="#555555"
                  tick={{ fill: "#555555" }}
                  label={{ value: "Eng Rate", position: "bottom", fill: "#555555" }}
                />
                <YAxis
                  type="number"
                  dataKey="EMV"
                  name="EMV"
                  stroke="#555555"
                  tick={{ fill: "#555555" }}
                  tickFormatter={(value) => `$${formatCompact(Number(value))}`}
                />
                <Tooltip cursor={{ stroke: "#1aff66" }} content={<ChartTooltip />} />
                <Scatter
                  data={filteredRows}
                  onClick={(point) => setChartInsight(getRoiInsight("engagement", point))}
                >
                  {filteredRows.map((row, index) => (
                    <Cell
                      key={`${row.creator_handle}-${index}`}
                      fill={tierColors[String(row.tier)] ?? "#1aff66"}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            ) : activeTab === "cpe" ? (
              <BarChart data={tierCpeRows} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="#242424" vertical={false} />
                <XAxis dataKey="tier" stroke="#555555" tick={{ fill: "#555555" }} />
                <YAxis stroke="#555555" tick={{ fill: "#555555" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="current"
                  fill="#1aff66"
                  radius={[8, 8, 0, 0]}
                  onClick={(point) => setChartInsight(getRoiInsight("cpe", point))}
                />
                <Bar
                  dataKey="previous"
                  fill="#242424"
                  radius={[8, 8, 0, 0]}
                  onClick={(point) => setChartInsight(getRoiInsight("cpe", point))}
                />
              </BarChart>
            ) : activeTab === "sentiment" ? (
              <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="#242424" />
                <XAxis
                  type="number"
                  dataKey="sentiment_score"
                  name="Sentiment"
                  domain={[0.65, 1]}
                  stroke="#555555"
                  tick={{ fill: "#555555" }}
                />
                <YAxis
                  type="number"
                  dataKey="eng_rate"
                  name="Eng Rate"
                  stroke="#555555"
                  tick={{ fill: "#555555" }}
                />
                <ReferenceLine x={0.85} stroke="#1aff66" strokeDasharray="4 4" />
                <Tooltip cursor={{ stroke: "#1aff66" }} content={<ChartTooltip />} />
                <Scatter
                  data={filteredRows}
                  onClick={(point) => setChartInsight(getRoiInsight("sentiment", point))}
                >
                  {filteredRows.map((row, index) => (
                    <Cell
                      key={`${row.creator_handle}-${index}`}
                      fill={getSentimentColor(toNumber(row.sentiment_score))}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            ) : (
              <BarChart
                data={rankingRows}
                layout="vertical"
                margin={{ top: 16, right: 24, bottom: 8, left: 80 }}
              >
                <CartesianGrid stroke="#242424" horizontal={false} />
                <XAxis type="number" stroke="#555555" tick={{ fill: "#555555" }} />
                <YAxis
                  type="category"
                  dataKey="creator"
                  width={120}
                  stroke="#555555"
                  tick={{ fill: "#555555", fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="score"
                  radius={[0, 8, 8, 0]}
                  onClick={(point) => setChartInsight(getRoiInsight("ranking", point))}
                >
                  {rankingRows.map((row, index) => (
                    <Cell
                      key={row.creator}
                      fill={index < 3 ? "#1aff66" : "#0dcc4e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-border-subtle bg-bg-card font-mono text-xs uppercase tracking-[0.16em] text-grey-500">
              Loading chart matrix...
            </div>
          )}
        </div>
        {chartInsight ? (
          <div className="mt-4 rounded-xl border border-green-dim bg-green-ghost p-4 text-sm leading-6 text-grey-100">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
              Chart Readout
            </p>
            <p className="mt-2">{chartInsight}</p>
          </div>
        ) : (
          <p className="mt-4 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500">
            Click any dot or bar to see what it means.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-green-dim bg-[radial-gradient(circle_at_top_left,rgba(26,255,102,0.14),transparent_35%),#161616] p-6 shadow-[0_0_28px_rgba(26,255,102,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-green-primary">
              Creator investment agents
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-grey-100">
              Ready to pick who to invest in?
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-grey-300">
              Open the dedicated Creator Picks desk to launch Scout, Risk, and
              Strategist as a vertical agent workflow with formatted outputs.
            </p>
          </div>
          <Link
            href="/roi-analyzer/agents"
            className="inline-flex items-center gap-3 rounded-md border border-green-dim bg-green-ghost px-5 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-primary transition-colors hover:bg-green-primary hover:text-bg-base"
          >
            ⬡ OPEN CREATOR PICKS
          </Link>
        </div>
      </section>

      <details className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <summary className="cursor-pointer font-mono text-xs font-semibold uppercase tracking-[0.18em] text-green-primary">
          Raw Creator Data
        </summary>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                {REQUIRED_COLS.map((column) => (
                  <th key={column} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => updateSort(column)}
                      className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary"
                    >
                      {column}
                      {sortColumn === column
                        ? sortDirection === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIndex) => (
                <tr
                  key={`${row.creator_handle ?? "row"}-${rowIndex}`}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  {REQUIRED_COLS.map((column) => (
                    <td
                      key={column}
                      className="whitespace-nowrap px-4 py-3 text-grey-100"
                    >
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
