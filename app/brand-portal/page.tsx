"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { type CreatorRow } from "@/lib/dataStore";
import { type WeeklyDigest } from "@/lib/digestStore";
import { type MeetingNote } from "@/lib/meetingStore";

type DataResponse = {
  rows: CreatorRow[];
};

type MeetingsResponse = {
  notes: MeetingNote[];
};

type DigestsResponse = {
  digests: WeeklyDigest[];
};

type ChartTab = "engagement" | "cpe" | "sentiment" | "ranking";

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
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
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

function getSentimentColor(sentiment: number) {
  if (sentiment >= 0.85) {
    return "#1aff66";
  }

  if (sentiment >= 0.78) {
    return "#ffaa00";
  }

  return "#ff4444";
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

  return typeof value === "number" ? value.toFixed(1) : String(value ?? "");
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

function htmlToPreviewLines(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|h2|li|section|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export default function BrandPortalPage() {
  const { data: session } = useSession();
  const brand = session?.user.brand ?? "Your Brand";
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [digests, setDigests] = useState<WeeklyDigest[]>([]);
  const [activeTab, setActiveTab] = useState<ChartTab>("engagement");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!session?.user.brand) {
      return;
    }

    async function loadPortalData() {
      const [dataResponse, meetingsResponse, digestsResponse] = await Promise.all([
        fetch("/api/data"),
        fetch(`/api/meetings?brand=${encodeURIComponent(brand)}`),
        fetch(`/api/digests?brand=${encodeURIComponent(brand)}`),
      ]);

      if (dataResponse.ok) {
        const payload = (await dataResponse.json()) as DataResponse;
        setRows(payload.rows);
      }

      if (meetingsResponse.ok) {
        const payload = (await meetingsResponse.json()) as MeetingsResponse;
        setMeetingNotes(payload.notes);
      }

      if (digestsResponse.ok) {
        const payload = (await digestsResponse.json()) as DigestsResponse;
        setDigests(payload.digests);
      }
    }

    void loadPortalData();
  }, [brand, session?.user.brand]);

  const kpis = useMemo(() => getKpis(rows), [rows]);
  const rankingRows = useMemo(() => getRankingRows(rows), [rows]);
  const tierCpeRows = useMemo(() => getTierCpeRows(rows), [rows]);
  const latestMeeting = useMemo(() => {
    return [...meetingNotes].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
  }, [meetingNotes]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title={`${brand} Performance Dashboard`}
        subtitle={getTodayLabel()}
        badge="Client View"
      />

      <section className="space-y-5">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
            Creator Performance
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-grey-100">
            {brand} creator performance
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
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
        </div>

        <div className="rounded-2xl border border-border-subtle bg-bg-surface p-5">
          <div className="mb-5 flex flex-wrap gap-2">
            {chartTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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
                    <Scatter data={rows}>
                      {rows.map((row, index) => (
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
                    <Bar dataKey="current" fill="#1aff66" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="previous" fill="#242424" radius={[8, 8, 0, 0]} />
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
                    <Scatter data={rows}>
                      {rows.map((row, index) => (
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
                    <Bar dataKey="score" radius={[0, 8, 8, 0]}>
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
                Loading brand charts...
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        {latestMeeting ? (
          <>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-green-primary">
              Last Meeting — {latestMeeting.date}
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div>
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
                  Decisions Made
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-grey-100">
                  {latestMeeting.decisions_made.map((decision) => (
                    <li key={decision} className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
                      <span className="mr-2 font-mono text-green-primary">⬡</span>
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
                  Action Items
                </p>
                <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
                  <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        {["Owner", "Task", "Due"].map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {latestMeeting.action_items.map((item, index) => (
                        <tr
                          key={`${item.task}-${index}`}
                          className="border-b border-border-subtle last:border-b-0"
                        >
                          <td className="px-4 py-3 text-grey-100">{item.owner}</td>
                          <td className="px-4 py-3 text-grey-100">{item.task}</td>
                          <td className="px-4 py-3 text-grey-300">{item.due}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {latestMeeting.key_themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full border border-green-dim bg-green-ghost px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary"
                >
                  {theme}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-sm text-grey-500">
            No meetings logged yet
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-green-primary">
          Weekly Updates Feed
        </p>
        <div className="mt-5 space-y-4">
          {digests.length > 0 ? (
            digests.map((digest) => (
              <article
                key={digest.id}
                className="rounded-2xl border border-border-subtle bg-bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
                      {new Date(digest.createdAt).toLocaleDateString()}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-grey-100">
                      {digest.subject}
                    </h3>
                  </div>
                  <span className="rounded-full border border-green-dim bg-green-ghost px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-green-primary">
                    Sent to Gmail ✓
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-6 text-grey-300">
                  {htmlToPreviewLines(digest.content).map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-sm text-grey-500">
              Weekly updates will appear here
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
