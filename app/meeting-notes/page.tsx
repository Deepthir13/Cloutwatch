"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { type MeetingNote } from "@/lib/meetingStore";

type MeetingsResponse = {
  notes: MeetingNote[];
};

type MeetingPostResponse =
  | {
      note: MeetingNote;
    }
  | {
      error: string;
    };

const brandOptions = ["L'Oreal", "Nike", "Glossier", "Other"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueBrands(notes: MeetingNote[]) {
  return Array.from(new Set(notes.map((note) => note.brand))).sort();
}

function NoteStructure({ note }: { note: MeetingNote }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5">
        <section>
          <h4 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
            Decisions Made
          </h4>
          {note.decisions_made.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-grey-100">
              {note.decisions_made.map((decision) => (
                <li key={decision}>{decision}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-grey-500">No decisions captured.</p>
          )}
        </section>

        <section>
          <h4 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
            Open Questions
          </h4>
          {note.open_questions.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-grey-100">
              {note.open_questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-grey-500">No open questions.</p>
          )}
        </section>
      </div>

      <div className="space-y-5">
        <section>
          <h4 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
            Action Items
          </h4>
          {note.action_items.length > 0 ? (
            <div className="mt-3 space-y-3">
              {note.action_items.map((item, index) => (
                <article
                  key={`${item.owner}-${item.task}-${index}`}
                  className="rounded-xl border border-border-subtle bg-bg-surface p-3 text-sm leading-6 text-grey-100"
                >
                  <p>
                    <strong className="text-green-primary">{item.owner}</strong>{" "}
                    {item.task}
                  </p>
                  {item.due ? (
                    <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-grey-500">
                      Due: {item.due}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-grey-500">No action items.</p>
          )}
        </section>

        <section>
          <h4 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
            Key Themes
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {note.key_themes.length > 0 ? (
              note.key_themes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-full border border-green-dim bg-green-ghost px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-green-primary"
                >
                  {theme}
                </span>
              ))
            ) : (
              <p className="text-sm text-grey-500">No key themes captured.</p>
            )}
          </div>
        </section>

        {note.next_meeting ? (
          <section className="rounded-xl border border-green-dim bg-green-ghost p-3">
            <h4 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-primary">
              Next Meeting
            </h4>
            <p className="mt-2 text-sm text-grey-100">{note.next_meeting}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function MeetingNotesPage() {
  const [brandChoice, setBrandChoice] = useState(brandOptions[0]);
  const [customBrand, setCustomBrand] = useState("");
  const [date, setDate] = useState(today);
  const [rawNotes, setRawNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState<MeetingNote[]>([]);
  const [latestNote, setLatestNote] = useState<MeetingNote | null>(null);
  const [brandFilter, setBrandFilter] = useState("All");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedBrand =
    brandChoice === "Other" ? customBrand.trim() : brandChoice;
  const savedBrands = useMemo(() => uniqueBrands(savedNotes), [savedNotes]);
  const filteredSavedNotes = useMemo(() => {
    if (brandFilter === "All") {
      return savedNotes;
    }

    return savedNotes.filter((note) => note.brand === brandFilter);
  }, [brandFilter, savedNotes]);

  async function loadMeetings() {
    try {
      const response = await fetch("/api/meetings");

      if (!response.ok) {
        setErrorMessage("Failed to load saved meeting notes.");
        return;
      }

      const payload = (await response.json()) as MeetingsResponse;

      setSavedNotes(payload.notes);
      setErrorMessage("");
    } catch {
      setErrorMessage("Failed to load saved meeting notes.");
    }
  }

  useEffect(() => {
    void loadMeetings();
  }, []);

  async function submitMeeting() {
    setSuccessMessage("");
    setErrorMessage("");

    if (!selectedBrand || !date || !rawNotes.trim()) {
      setErrorMessage("Brand, date, and raw notes are required.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brand: selectedBrand,
          date,
          raw_notes: rawNotes,
        }),
      });
      const payload = (await response.json()) as MeetingPostResponse;

      if (!response.ok || "error" in payload) {
        setErrorMessage(
          "error" in payload ? payload.error : "Failed to save meeting notes.",
        );
        return;
      }

      setLatestNote(payload.note);
      setSavedNotes((notes) => [payload.note, ...notes]);
      setSuccessMessage("Meeting notes extracted and saved.");
      setRawNotes("");
      setErrorMessage("");
    } catch {
      setErrorMessage("Failed to save meeting notes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader title="MEETING NOTES" subtitle="Log · Extract · Track" />

      {errorMessage ? (
        <ErrorCard
          message={errorMessage}
          onRetry={() => {
            setErrorMessage("");
            if (rawNotes.trim()) {
              void submitMeeting();
              return;
            }

            void loadMeetings();
          }}
        />
      ) : null}

      <section className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <div className="mb-5">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
            Section 1
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-grey-100">
            Log New Meeting
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Brand
            </span>
            <select
              value={brandChoice}
              onChange={(event) => setBrandChoice(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors focus:border-green-primary"
            >
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors focus:border-green-primary"
            />
          </label>
        </div>

        {brandChoice === "Other" ? (
          <label className="mt-4 block space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Custom Brand
            </span>
            <input
              type="text"
              value={customBrand}
              onChange={(event) => setCustomBrand(event.target.value)}
              placeholder="Enter brand name"
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none placeholder:text-grey-500 focus:border-green-primary"
            />
          </label>
        ) : null}

        <label className="mt-4 block space-y-2">
          <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
            Raw Notes
          </span>
          <textarea
            value={rawNotes}
            onChange={(event) => setRawNotes(event.target.value)}
            placeholder="Paste your raw meeting notes"
            className="min-h-56 w-full rounded-xl border border-border-subtle bg-bg-surface px-4 py-4 text-grey-100 outline-none placeholder:text-grey-500 focus:border-green-primary"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={submitMeeting}
            className="inline-flex items-center gap-3 rounded-md border border-green-dim bg-green-ghost px-5 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-green-primary transition-colors hover:bg-green-primary hover:text-bg-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-primary border-t-transparent" />
            ) : null}
            ⬡ EXTRACT & SAVE NOTES
          </button>
        </div>

        {successMessage ? (
          <div className="mt-5 rounded-xl border border-green-dim bg-green-ghost px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-green-primary">
            ✓ {successMessage}
          </div>
        ) : null}

        {latestNote ? (
          <div className="mt-5 rounded-2xl border border-border-subtle bg-bg-elevated p-5">
            <NoteStructure note={latestNote} />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-bg-card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-grey-500">
              Section 2
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-grey-100">
              Saved Notes Log
            </h2>
          </div>

          <label className="min-w-56 space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
              Brand Filter
            </span>
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-3 text-grey-100 outline-none transition-colors focus:border-green-primary"
            >
              <option value="All">All Brands</option>
              {savedBrands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredSavedNotes.length === 0 ? (
          <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center text-sm text-grey-500">
            No notes saved yet. Extract a meeting to start the log.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSavedNotes.map((note) => (
              <details
                key={note.id}
                className="rounded-2xl border border-border-subtle bg-bg-surface p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
                        {note.date}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-grey-100">
                        {note.brand}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {note.key_themes.map((theme) => (
                        <span
                          key={theme}
                          className="rounded-full border border-border-subtle bg-bg-card px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                </summary>
                <div className="mt-5 border-t border-border-subtle pt-5">
                  <NoteStructure note={note} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
