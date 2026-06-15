"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalysisCard } from "@/components/ui/AnalysisCard";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { REQUIRED_COLS, type CreatorRow } from "@/lib/dataStore";
import { type MeetingNote } from "@/lib/meetingStore";

type DataResponse = {
  rows: CreatorRow[];
  isCustom: boolean;
};

type MeetingsResponse = {
  notes: MeetingNote[];
};

type BriefResponse =
  | {
      brief: string;
      deltaRows: DeltaRow[];
      notesCount: number;
    }
  | {
      error: string;
    };

type DeltaRow = CreatorRow & {
  eng_delta: number;
  EMV_delta: number;
  CPE_delta: number;
  sentiment_delta: number;
};

type DeltaTab = "engagement" | "emv" | "table";

const deltaColumns = [
  ...REQUIRED_COLS,
  "eng_delta",
  "EMV_delta",
  "CPE_delta",
  "sentiment_delta",
];

const tabs: { id: DeltaTab; label: string }[] = [
  { id: "engagement", label: "Engagement Shift" },
  { id: "emv", label: "EMV Shift" },
  { id: "table", label: "Full Delta Table" },
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

function getBrands(rows: CreatorRow[], notes: MeetingNote[]) {
  return Array.from(
    new Set([
      ...rows
        .map((row) => row.brand)
        .filter((brand): brand is string => typeof brand === "string" && brand.length > 0),
      ...notes.map((note) => note.brand),
    ]),
  ).sort();
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

function getDeltaKpis(rows: DeltaRow[]) {
  const avgEngDelta = average(rows.map((row) => row.eng_delta));
  const totalEmvDelta = rows.reduce((sum, row) => sum + row.EMV_delta, 0);
  const avgCpeDelta = average(rows.map((row) => row.CPE_delta));
  const avgSentimentDelta = average(rows.map((row) => row.sentiment_delta));

  return [
    {
      label: "Avg Eng Δ",
      value: `${avgEngDelta >= 0 ? "+" : ""}${avgEngDelta.toFixed(2)} pts`,
      positive: avgEngDelta >= 0,
    },
    {
      label: "Total EMV Δ",
      value: `${totalEmvDelta >= 0 ? "+" : "-"}$${formatCompact(
        Math.abs(totalEmvDelta),
      )}`,
      positive: totalEmvDelta >= 0,
    },
    {
      label: "Avg CPE Δ",
      value: `${avgCpeDelta >= 0 ? "+" : "-"}$${Math.abs(avgCpeDelta).toFixed(3)}`,
      positive: avgCpeDelta <= 0,
    },
    {
      label: "Sentiment Δ",
      value: `${avgSentimentDelta >= 0 ? "+" : ""}${avgSentimentDelta.toFixed(3)}`,
      positive: avgSentimentDelta >= 0,
    },
  ];
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
    return `${numberValue >= 0 ? "+" : "-"}$${formatCompact(Math.abs(numberValue))}`;
  }

  if (key?.toLowerCase().includes("eng")) {
    return `${numberValue >= 0 ? "+" : ""}${numberValue.toFixed(2)} pts`;
  }

  return String(value ?? "");
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const source = payload[0]?.payload as Record<string, unknown> | undefined;
  const title = source?.creator_handle ?? label ?? "Selection";

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

function getDeltaInsight(tab: DeltaTab, point: unknown) {
  const row = getPayload<DeltaRow>(point);
  const creator = String(row.creator_handle ?? "This creator");

  if (tab === "emv") {
    const direction = row.EMV_delta >= 0 ? "gained" : "lost";

    return `${creator} ${direction} $${formatCompact(
      Math.abs(row.EMV_delta),
    )} in EMV versus the previous campaign. Positive bars mean the creator is producing more estimated value; negative bars need a budget or content review.`;
  }

  const direction = row.eng_delta >= 0 ? "improved" : "declined";

  return `${creator} ${direction} by ${Math.abs(row.eng_delta).toFixed(
    2,
  )} engagement points. Positive bars signal stronger audience response since the last period; negative bars are a follow-up risk for the meeting.`;
}

export default function PreMeetingBriefPage() {
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [activeTab, setActiveTab] = useState<DeltaTab>("engagement");
  const [sortColumn, setSortColumn] = useState("EMV_delta");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [brief, setBrief] = useState("");
  const [briefError, setBriefError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [chartInsight, setChartInsight] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  async function loadContext() {
    try {
      const [dataResponse, meetingsResponse] = await Promise.all([
        fetch("/api/data"),
        fetch("/api/meetings"),
      ]);

      if (!dataResponse.ok || !meetingsResponse.ok) {
        setLoadError("Failed to load pre-meeting context.");
        return;
      }

      const dataPayload = (await dataResponse.json()) as DataResponse;
      const meetingsPayload = (await meetingsResponse.json()) as MeetingsResponse;
      const availableBrands = getBrands(dataPayload.rows, meetingsPayload.notes);

      setRows(dataPayload.rows);
      setNotes(meetingsPayload.notes);
      setSelectedBrand((currentBrand) => currentBrand || availableBrands[0] || "");
      setLoadError("");
    } catch {
      setLoadError("Failed to load pre-meeting context.");
    }
  }

  useEffect(() => {
    setIsMounted(true);
    void loadContext();
  }, []);

  const brands = useMemo(() => getBrands(rows, notes), [notes, rows]);
  const brandRows = useMemo(
    () => rows.filter((row) => row.brand === selectedBrand),
    [rows, selectedBrand],
  );
  const brandNotes = useMemo(
    () => notes.filter((note) => note.brand === selectedBrand),
    [notes, selectedBrand],
  );
  const deltaRows = useMemo(() => getDeltaRows(brandRows), [brandRows]);
  const deltaKpis = useMemo(() => getDeltaKpis(deltaRows), [deltaRows]);
  const flagCount = useMemo(
    () => brandRows.filter((row) => toBoolean(row.fake_follower_flag)).length,
    [brandRows],
  );
  const sortedDeltaRows = useMemo(() => {
    return [...deltaRows].sort((a, b) => {
      const aValue = a[sortColumn as keyof DeltaRow];
      const bValue = b[sortColumn as keyof DeltaRow];
      const aNumber = Number(aValue);
      const bNumber = Number(bValue);
      const direction = sortDirection === "asc" ? 1 : -1;

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return (aNumber - bNumber) * direction;
      }

      return String(aValue ?? "").localeCompare(String(bValue ?? "")) * direction;
    });
  }, [deltaRows, sortColumn, sortDirection]);

  function updateSort(column: string) {
    if (column === sortColumn) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("desc");
  }

  async function generateBrief() {
    setIsGenerating(true);
    setBrief("");
    setBriefError("");

    try {
      const response = await fetch("/api/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ brand: selectedBrand }),
      });
      const payload = (await response.json()) as BriefResponse;

      if (!response.ok || "error" in payload) {
        setBriefError("error" in payload ? payload.error : "Brief generation failed.");
        return;
      }

      setBrief(payload.brief);
    } catch {
      setBriefError("Brief generation failed. Check the API route and try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="PRE-MEETING BRIEF"
        subtitle="Real-time debrief · creator performance delta · meeting prep"
      />

      {loadError ? (
        <ErrorCard
          message={loadError}
          onRetry={() => {
            setLoadError("");
            void loadContext();
          }}
        />
      ) : null}

      <section className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <label className="block max-w-md space-y-2">
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
            Brand
          </span>
          <select
            value={selectedBrand}
            onChange={(event) => {
              setSelectedBrand(event.target.value);
              setBrief("");
              setBriefError("");
            }}
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors focus:border-green-primary"
          >
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <span className="rounded-full border border-green-dim bg-green-ghost px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary">
            {brandNotes.length} meeting(s) logged
          </span>
          <span className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500">
            {brandRows.length} creators tracked
          </span>
          <span className="rounded-full border border-amber-warn/70 bg-amber-warn/10 px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-amber-warn">
            {flagCount} flag(s)
          </span>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
            Creator Performance Since Last Meeting
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-grey-100">
            Delta view
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {deltaKpis.map((kpi) => (
            <article
              key={kpi.label}
              className="rounded-2xl border border-border-subtle bg-bg-card p-4"
            >
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
                {kpi.label}
              </p>
              <p
                className={[
                  "mt-3 text-3xl font-bold tracking-[-0.04em]",
                  kpi.positive ? "text-green-primary" : "text-red-flag",
                ].join(" ")}
              >
                {kpi.value}
              </p>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
          <div className="mb-5 flex flex-wrap gap-2">
            {tabs.map((tab) => (
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

          {activeTab === "table" ? (
            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-card">
              <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    {deltaColumns.map((column) => (
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
                  {sortedDeltaRows.map((row, rowIndex) => (
                    <tr
                      key={`${row.creator_handle ?? "row"}-${rowIndex}`}
                      className="border-b border-border-subtle last:border-b-0"
                    >
                      {deltaColumns.map((column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap px-4 py-3 text-grey-100"
                        >
                          {String(row[column as keyof DeltaRow] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[300px]">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deltaRows}
                    layout="vertical"
                    margin={{ top: 16, right: 24, bottom: 8, left: 96 }}
                  >
                    <CartesianGrid stroke="#242424" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#555555"
                      tick={{ fill: "#555555" }}
                      tickFormatter={(value) =>
                        activeTab === "emv"
                          ? `$${formatCompact(Number(value))}`
                          : String(value)
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="creator_handle"
                      width={130}
                      stroke="#555555"
                      tick={{ fill: "#555555", fontSize: 12 }}
                    />
                    <ReferenceLine x={0} stroke="#555555" strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey={activeTab === "emv" ? "EMV_delta" : "eng_delta"}
                      radius={[0, 8, 8, 0]}
                      onClick={(point) => setChartInsight(getDeltaInsight(activeTab, point))}
                    >
                      {deltaRows.map((row, index) => {
                        const value =
                          activeTab === "emv" ? row.EMV_delta : row.eng_delta;

                        return (
                          <Cell
                            key={`${row.creator_handle}-${index}`}
                            fill={value >= 0 ? "#1aff66" : "#ff4444"}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-border-subtle bg-bg-card font-mono text-xs uppercase tracking-[0.16em] text-grey-500">
                  Loading delta chart...
                </div>
              )}
            </div>
          )}
          {activeTab !== "table" ? (
            chartInsight ? (
              <div className="mt-4 rounded-xl border border-green-dim bg-green-ghost p-4 text-sm leading-6 text-grey-100">
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
                  Delta Readout
                </p>
                <p className="mt-2">{chartInsight}</p>
              </div>
            ) : (
              <p className="mt-4 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500">
                Click any bar to see what changed and why it matters.
              </p>
            )
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
              AI Meeting Brief
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-grey-100">
              Meeting-ready strategy
            </h2>
          </div>
          <button
            type="button"
            disabled={!selectedBrand || isGenerating}
            onClick={generateBrief}
            className="inline-flex items-center gap-3 rounded-md border border-green-dim bg-green-ghost px-5 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-primary transition-colors hover:bg-green-primary hover:text-bg-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-primary border-t-transparent" />
            ) : null}
            ⚡ GENERATE BRIEF
          </button>
        </div>

        {briefError ? (
          <div className="mt-5">
            <ErrorCard
              message={briefError}
              onRetry={() => {
                setBriefError("");
                void generateBrief();
              }}
            />
          </div>
        ) : null}

        {brief || isGenerating ? (
          <>
            <AnalysisCard
              content={brief}
              loadingText="Generating pre-meeting brief..."
            />
            <p className="mt-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500">
              Tip: copy this brief before your meeting call
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
