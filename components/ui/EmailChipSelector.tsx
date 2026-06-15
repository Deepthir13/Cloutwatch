"use client";

import { useEffect, useMemo, useState } from "react";
import { type EmailBookEntry } from "@/lib/emailBook";

type EmailChipSelectorProps = {
  brand?: string;
  value: string;
  onChange: (email: string) => void;
  onSave: (email: string, label: string) => void | Promise<void>;
};

type EmailBookResponse = {
  entries: EmailBookEntry[];
};

function sortByRecent(entries: EmailBookEntry[]) {
  return [...entries].sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) {
      return b.usedCount - a.usedCount;
    }

    if (!a.lastUsed) {
      return 1;
    }

    if (!b.lastUsed) {
      return -1;
    }

    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
}

export function EmailChipSelector({
  brand,
  value,
  onChange,
  onSave,
}: EmailChipSelectorProps) {
  const [entries, setEntries] = useState<EmailBookEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [label, setLabel] = useState("");

  async function loadEntries() {
    const response = await fetch("/api/emailbook");

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as EmailBookResponse;

    setEntries(payload.entries);
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  const filteredEntries = useMemo(() => {
    return sortByRecent(
      entries.filter((entry) => !brand || !entry.brand || entry.brand === brand),
    );
  }, [brand, entries]);

  async function saveEmail() {
    if (!value || !label) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(value, label);
      setLabel("");
      setShowLabelForm(false);
      await loadEntries();
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/emailbook?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await loadEntries();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter email address..."
          className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-grey-100 outline-none transition-colors placeholder:text-grey-500 focus:border-green-primary"
        />
        <button
          type="button"
          onClick={() => setShowLabelForm((current) => !current)}
          className="rounded-md border border-border-subtle px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-grey-300 hover:text-green-primary"
        >
          Save
        </button>
      </div>

      {showLabelForm ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-3">
          <label className="block space-y-2">
            <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-grey-500">
              Label
            </span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={brand ? `${brand} Brand Team` : "Brand Team"}
              className="w-full rounded-lg border border-border-subtle bg-bg-card px-3 py-2 text-sm text-grey-100 outline-none placeholder:text-grey-500 focus:border-green-primary"
            />
          </label>
          <p className="mt-2 text-[0.68rem] text-grey-500">
            Brand association: {brand ?? "None"}
          </p>
          <button
            type="button"
            disabled={isSaving || !value || !label}
            onClick={() => void saveEmail()}
            className="mt-3 rounded-md border border-green-dim bg-green-ghost px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-green-primary hover:bg-green-primary hover:text-bg-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Address
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {filteredEntries.map((entry) => {
          const isSelected = entry.email === value;

          return (
            <span
              key={entry.id}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[0.7rem] text-grey-100 transition-colors",
                isSelected
                  ? "border-green-primary bg-green-ghost"
                  : "border-border-subtle bg-bg-elevated",
              ].join(" ")}
            >
              <button type="button" onClick={() => onChange(entry.email)}>
                {entry.label}
              </button>
              <button
                type="button"
                aria-label={`Delete ${entry.label}`}
                onClick={() => void deleteEntry(entry.id)}
                className="text-grey-500 hover:text-red-flag"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
