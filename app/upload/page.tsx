"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { REQUIRED_COLS, type CreatorRow } from "@/lib/dataStore";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";

type UploadResponse =
  | {
      success: true;
      rowCount: number;
      brands: string[];
    }
  | {
      error: string;
    };

type DataResponse = {
  rows: CreatorRow[];
  isCustom: boolean;
};

const columnDetails: Record<
  string,
  {
    type: string;
    description: string;
  }
> = {
  creator_handle: {
    type: "string",
    description: "Creator username or handle, including platform prefix if used.",
  },
  tier: {
    type: "string",
    description: "Audience tier such as nano, micro, macro, or mega.",
  },
  platform: {
    type: "string",
    description: "Primary campaign platform.",
  },
  followers: {
    type: "number",
    description: "Total follower count at campaign time.",
  },
  avg_views: {
    type: "number",
    description: "Average views per sponsored post or video.",
  },
  eng_rate: {
    type: "number",
    description: "Current campaign engagement rate percentage.",
  },
  CPE: {
    type: "number",
    description: "Cost per engagement for the current campaign.",
  },
  EMV: {
    type: "number",
    description: "Estimated media value for the creator campaign.",
  },
  past_brand_fit_score: {
    type: "number",
    description: "Historical brand alignment score from 0 to 10.",
  },
  niche: {
    type: "string",
    description: "Creator content category or audience niche.",
  },
  sentiment_score: {
    type: "number",
    description: "Current audience sentiment score from 0 to 1.",
  },
  fake_follower_flag: {
    type: "boolean",
    description: "Whether the creator has a suspicious follower quality flag.",
  },
  brand: {
    type: "string",
    description: "Brand associated with the campaign row.",
  },
  prev_eng_rate: {
    type: "number",
    description: "Previous campaign engagement rate percentage.",
  },
  prev_CPE: {
    type: "number",
    description: "Previous campaign cost per engagement.",
  },
  prev_EMV: {
    type: "number",
    description: "Previous campaign estimated media value.",
  },
  prev_sentiment_score: {
    type: "number",
    description: "Previous campaign audience sentiment score from 0 to 1.",
  },
  last_campaign_date: {
    type: "date",
    description: "Most recent comparable campaign date in YYYY-MM-DD format.",
  },
};

function normalizeRow(row: Record<string, unknown>): CreatorRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), value]),
  ) as CreatorRow;
}

function getMissingColumns(row: CreatorRow | undefined) {
  if (!row) {
    return REQUIRED_COLS;
  }

  const keys = new Set(Object.keys(row));

  return REQUIRED_COLS.filter((column) => !keys.has(column));
}

function formatBrands(brands: string[]) {
  return brands.length > 0 ? brands.join(", ") : "No brands found";
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [success, setSuccess] = useState<{
    rowCount: number;
    brands: string[];
  } | null>(null);
  const [apiError, setApiError] = useState("");

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);
  const previewColumns = useMemo(
    () => REQUIRED_COLS.filter((column) => rows[0] && column in rows[0]),
    [rows],
  );

  async function loadStoredData() {
    try {
      const response = await fetch("/api/data");

      if (!response.ok) {
        setApiError("Failed to load current data source.");
        return;
      }

      const payload = (await response.json()) as DataResponse;

      if (!payload.isCustom || payload.rows.length === 0) {
        return;
      }

      const brands = Array.from(
        new Set(
          payload.rows
            .map((row) => row.brand)
            .filter(
              (brand): brand is string =>
                typeof brand === "string" && brand.length > 0,
            ),
        ),
      ).sort();

      setRows(payload.rows);
      setSuccess({
        rowCount: payload.rows.length,
        brands,
      });
      setApiError("");
    } catch {
      setApiError("Failed to load current data source.");
    }
  }

  useEffect(() => {
    void loadStoredData();
  }, []);

  function resetUploadState() {
    setRows([]);
    setErrors([]);
    setSuccess(null);
    setApiError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function parseFile(file: File) {
    setSuccess(null);
    setErrors([]);
    setApiError("");

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRows([]);
      setErrors(["Please upload a .csv file."]);
      return;
    }

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (result) => {
        const parsedRows = result.data.map(normalizeRow);
        const parseErrors = result.errors.map((error) => error.message);
        const missingColumns = getMissingColumns(parsedRows[0]);

        if (parseErrors.length > 0) {
          setRows([]);
          setErrors(parseErrors);
          return;
        }

        if (missingColumns.length > 0) {
          setRows(parsedRows);
          setErrors([
            `Missing required columns: ${missingColumns.join(", ")}`,
          ]);
          return;
        }

        setRows(parsedRows);
      },
      error: (error) => {
        setRows([]);
        setErrors([error.message]);
      },
    });
  }

  async function confirmUpload() {
    if (rows.length === 0 || errors.length > 0) {
      return;
    }

    setIsConfirming(true);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }),
      });
      const payload = (await response.json()) as UploadResponse;

      if (!response.ok || "error" in payload) {
        setSuccess(null);
        setApiError("error" in payload ? payload.error : "Upload failed.");
        return;
      }

      setSuccess({
        rowCount: payload.rowCount,
        brands: payload.brands,
      });
      setErrors([]);
      setApiError("");
    } catch {
      setApiError("Upload failed. Check the API route and try again.");
    } finally {
      setIsConfirming(false);
    }
  }

  async function clearUpload() {
    try {
      const response = await fetch("/api/upload", {
        method: "DELETE",
      });

      if (!response.ok) {
        setApiError("Failed to clear uploaded data.");
        return;
      }

      resetUploadState();
    } catch {
      setApiError("Failed to clear uploaded data.");
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        title="UPLOAD DATA"
        subtitle="CSV upload · validation · preview"
        badge="Data Intake"
      />

      {apiError ? (
        <ErrorCard
          message={apiError}
          onRetry={() => {
            setApiError("");
            void loadStoredData();
          }}
        />
      ) : null}

      <div
        className={[
          "rounded-xl border px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.14em]",
          success
            ? "border-green-dim bg-green-ghost text-green-primary"
            : "border-border-subtle bg-bg-card text-grey-500",
        ].join(" ")}
      >
        {success
          ? `✓ Custom data loaded — ${success.rowCount} rows · ${formatBrands(
              success.brands,
            )}`
          : "Using mock dataset"}
      </div>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const [file] = Array.from(event.dataTransfer.files);

          if (file) {
            parseFile(file);
          }
        }}
        className={[
          "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-bg-card p-10 text-center transition-all",
          isDragging
            ? "border-green-primary shadow-[0_0_28px_rgba(26,255,102,0.24)]"
            : "border-green-dim hover:border-green-primary",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              parseFile(file);
            }
          }}
        />
        <p className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-green-primary">
          Drop CSV Here
        </p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-grey-300">
          Drag a campaign export into this zone, or click to select a CSV file
          from your machine. The first row must include every required column.
        </p>
        <a
          href="/mock_campaigns.csv"
          download
          className="mt-6 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-green-primary underline-offset-4 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          ⬇ DOWNLOAD TEMPLATE CSV
        </a>
      </section>

      {errors.length > 0 ? (
        <div className="rounded-xl border border-red-flag/60 bg-red-flag/10 p-4 text-sm text-red-flag">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {previewRows.length > 0 ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
              Previewing first {previewRows.length} of {rows.length} rows
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={clearUpload}
                className="rounded-md border border-border-subtle px-4 py-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-grey-500 transition-colors hover:border-red-flag hover:text-red-flag"
              >
                Clear upload
              </button>
              <button
                type="button"
                disabled={errors.length > 0 || isConfirming}
                onClick={confirmUpload}
                className="rounded-md border border-green-dim bg-green-ghost px-4 py-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-primary transition-colors hover:bg-green-primary hover:text-bg-base disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirming ? "Loading..." : "⬡ USE THIS DATA"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-card">
            <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  {previewColumns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr
                    key={`${row.creator_handle ?? "row"}-${rowIndex}`}
                    className="border-b border-border-subtle last:border-b-0"
                  >
                    {previewColumns.map((column) => (
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
        </section>
      ) : null}

      <details className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <summary className="cursor-pointer font-mono text-xs font-semibold uppercase tracking-[0.18em] text-green-primary">
          Required column format
        </summary>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary">
                  Column
                </th>
                <th className="px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary">
                  Type
                </th>
                <th className="px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {REQUIRED_COLS.map((column) => (
                <tr
                  key={column}
                  className="border-b border-border-subtle last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-grey-100">
                    {column}
                  </td>
                  <td className="px-4 py-3 text-grey-300">
                    {columnDetails[column].type}
                  </td>
                  <td className="px-4 py-3 text-grey-300">
                    {columnDetails[column].description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
