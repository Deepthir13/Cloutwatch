"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  type RedFlagAlert,
  type WeeklyDigestNotification,
} from "@/lib/notificationStore";
import { EmailChipSelector } from "@/components/ui/EmailChipSelector";
import { type EmailBookEntry } from "@/lib/emailBook";

const employeeNavItems = [
  { href: "/upload", label: "Upload" },
  { href: "/roi-analyzer", label: "ROI Analyzer" },
  { href: "/roi-analyzer/agents", label: "Creator Picks", nested: true },
  { href: "/meeting-notes", label: "Meeting Notes" },
  { href: "/pre-meeting-brief", label: "Pre-Meeting Brief" },
];

type NotificationsResponse = {
  pendingDigests: WeeklyDigestNotification[];
  pendingCount: number;
  redFlags: RedFlagAlert[];
  unseenCount: number;
};

type Drawer = "notifications" | "redflags" | null;

type EmailBookResponse = {
  entries: EmailBookEntry[];
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [pendingDigests, setPendingDigests] = useState<WeeklyDigestNotification[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagAlert[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [expandedDigestId, setExpandedDigestId] = useState<string | null>(null);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [editedDigestTexts, setEditedDigestTexts] = useState<Record<string, string>>({});
  const [selectedEmails, setSelectedEmails] = useState<Record<string, string>>({});
  const [sendStatus, setSendStatus] = useState<Record<string, string>>({});
  const [savePromptDigestId, setSavePromptDigestId] = useState<string | null>(null);
  const navItems = !session
    ? []
    : session.user.role === "client"
      ? [
          {
            href: "/brand-portal",
            label: "Brand Portal",
          },
        ]
      : employeeNavItems;
  const isEmployee = Boolean(session && session.user.role !== "client");
  const isClient = Boolean(session && session.user.role === "client");

  useEffect(() => {
    if (!isEmployee) {
      setPendingDigests([]);
      setRedFlags([]);
      setPendingCount(0);
      setUnseenCount(0);
      return;
    }

    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications");

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as NotificationsResponse;

        setPendingDigests(payload.pendingDigests);
        setRedFlags(payload.redFlags);
        setPendingCount(payload.pendingCount);
        setUnseenCount(payload.unseenCount);
      } catch {
        // Keep the last known notification state if polling fails.
      }
    }

    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isEmployee]);

  async function refreshNotifications() {
    const response = await fetch("/api/notifications");

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as NotificationsResponse;

    setPendingDigests(payload.pendingDigests);
    setRedFlags(payload.redFlags);
    setPendingCount(payload.pendingCount);
    setUnseenCount(payload.unseenCount);
  }

  function decodeHtmlEntities(text: string) {
    return text
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'");
  }

  function htmlToPlainText(bodyHtml: string) {
    return decodeHtmlEntities(
      bodyHtml
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|h[1-6]|li)>/gi, "\n")
        .replace(/<li[^>]*>/gi, "- ")
        .replace(/<[^>]+>/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n"),
    );
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function digestTextToHtml(subject: string, bodyText: string) {
    const paragraphs = bodyText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => {
        const lines = paragraph.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => line.startsWith("- "));

        if (isList) {
          return `<ul style="margin:0 0 18px;padding-left:20px;">${lines
            .map((line) => `<li style="margin-bottom:8px;">${escapeHtml(line.slice(2))}</li>`)
            .join("")}</ul>`;
        }

        return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;">${escapeHtml(
          paragraph,
        ).replace(/\n/g, "<br/>")}</p>`;
      })
      .join("");

    return `<div style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#151515;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dce5df;border-radius:18px;overflow:hidden;">
        <div style="padding:24px;background:#0a0a0a;color:#f0f0f0;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1aff66;font-weight:700;">Cloutwatch Weekly</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:#1aff66;">${escapeHtml(
            subject,
          )}</h1>
        </div>
        <div style="padding:26px;">${paragraphs}</div>
      </div>
    </div>`;
  }

  function limitWords(text: string, maxWords: number) {
    const words = text.trim().split(/\s+/);

    return words.length > maxWords ? words.slice(0, maxWords).join(" ") : text.trim();
  }

  function makeClientEmailDraft(brand: string, rawText: string) {
    if (/^hi\s+/i.test(rawText) && rawText.includes("\n- ")) {
      return rawText;
    }

    const lines = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (line) =>
          !/^creator iq weekly$/i.test(line) &&
          !/^[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}$/.test(line) &&
          !new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} creator update$`, "i").test(line),
      );
    const points: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const nextLine = lines[index + 1];

      if (/top performer/i.test(line) && nextLine) {
        points.push(`Top performer: ${nextLine}`);
        index += 1;
        continue;
      }

      if (/emv/i.test(line) && nextLine) {
        points.push(`EMV update: ${nextLine}`);
        index += 1;
        continue;
      }

      if (/sentiment|roster|highlight|concern/i.test(line) && nextLine) {
        points.push(`Roster note: ${line.includes(":") ? line : nextLine}`);
        if (!line.includes(":")) {
          index += 1;
        }
        continue;
      }

      if (/action item|open action/i.test(line) && nextLine) {
        points.push(`Next step: ${nextLine.replace(/^- /, "")}`);
        index += 1;
        continue;
      }

      if (/^(top performer|emv|sentiment|open action|roster note|next step):/i.test(line)) {
        points.push(line.replace(/^- /, ""));
      }
    }

    const uniquePoints = Array.from(new Set(points)).slice(0, 5);
    const finalPoints =
      uniquePoints.length > 0
        ? uniquePoints
        : lines.filter((line) => !/^[-•]?$/.test(line)).slice(0, 4);

    return [
      `Hi ${brand} team,`,
      "Here is this week's creator performance update:",
      finalPoints.map((point) => `- ${point}`).join("\n"),
      "Best,",
      "Cloutwatch Team",
    ].join("\n\n");
  }

  function getDigestText(digest: WeeklyDigestNotification) {
    if (editedDigestTexts[digest.id] !== undefined) {
      return editedDigestTexts[digest.id];
    }

    const bodyText = digest.bodyText ?? htmlToPlainText(digest.bodyHtml);

    return makeClientEmailDraft(digest.brand, bodyText);
  }

  function getMitigationPoints(mitigation: string) {
    const cleaned = mitigation
      .replace(/^#+\s*.*$/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const points = cleaned
      .split(/\s*(?:\d+\.\s+|[-•]\s+)/)
      .map((point) => point.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((point) => {
        const sentence = point
          .split(/\s+[—-]\s+|(?<=[.!?])\s+/)[0]
          ?.replace(/\.$/, "") ?? point;

        return limitWords(sentence, 14);
      });

    return points.length > 0
      ? points
      : [
          "Review creator risk evidence.",
          "Pause commitment.",
          "Confirm mitigation before outreach.",
        ];
  }

  async function updateDigestBody(
    id: string,
    subject: string,
    bodyText: string,
  ) {
    const bodyHtml = digestTextToHtml(subject, bodyText);

    setEditedDigestTexts((current) => ({ ...current, [id]: bodyText }));

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, bodyHtml, bodyText }),
    });
  }

  async function saveEmailAddress(email: string, label: string, brand: string | null) {
    await fetch("/api/emailbook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        label,
        brand,
      }),
    });
  }

  async function emailExists(email: string) {
    const response = await fetch("/api/emailbook");

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as EmailBookResponse;
    const normalizedEmail = email.trim().toLowerCase();

    return payload.entries.some(
      (entry) => entry.email.trim().toLowerCase() === normalizedEmail,
    );
  }

  async function incrementEmailUsage(email: string) {
    await fetch("/api/emailbook", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
  }

  async function sendDigest(
    digest: WeeklyDigestNotification,
    saveUnknown = false,
    skipSavePrompt = false,
  ) {
    setSendStatus((current) => ({ ...current, [digest.id]: "Sending..." }));

    try {
      const bodyText = getDigestText(digest);
      const shouldUsePlainTextBody = Boolean(editedDigestTexts[digest.id] || digest.bodyText);
      const bodyHtml = shouldUsePlainTextBody
        ? digestTextToHtml(digest.subject, bodyText)
        : digest.bodyHtml;
      const toEmail = selectedEmails[digest.id]?.trim() || digest.toEmail;

      if (!saveUnknown && !skipSavePrompt && !(await emailExists(toEmail))) {
        setSavePromptDigestId(digest.id);
        setSendStatus((current) => ({ ...current, [digest.id]: "" }));
        return;
      }

      if (saveUnknown) {
        await saveEmailAddress(toEmail, digest.brand, digest.brand);
      }

      const response = await fetch("/api/email/weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brand: digest.brand,
          toEmail,
          digestId: digest.id,
          bodyHtml,
          bodyText,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSendStatus((current) => ({
          ...current,
          [digest.id]: payload?.error ?? "Error sending",
        }));
        return;
      }

      await incrementEmailUsage(toEmail);

      setSendStatus((current) => ({
        ...current,
        [digest.id]: `Sent ✓ to ${toEmail}`,
      }));
      setSavePromptDigestId(null);
      await refreshNotifications();
    } catch {
      setSendStatus((current) => ({ ...current, [digest.id]: "Error sending" }));
    }
  }

  async function markAlertSeen(id: string) {
    setRedFlags((current) => current.filter((alert) => alert.id !== id));
    setUnseenCount((current) => Math.max(0, current - 1));
    setExpandedAlertId((current) => (current === id ? null : current));

    await fetch(`/api/notifications?id=${encodeURIComponent(id)}&type=redflag`, {
      method: "DELETE",
    });
  }

  function getPreview(bodyText: string) {
    const text = bodyText.split("\n").filter(Boolean).slice(0, 3).join(" · ");

    return `${text.slice(0, 220)}${text.length > 220 ? "..." : ""}`;
  }

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-[220px] flex-col overflow-y-auto border-r border-border-subtle bg-bg-surface px-4 py-6">
      {isClient ? (
        <div className="mb-10">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-grey-500">
            Client Portal
          </p>
          <h2 className="mt-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-green-primary">
            {session?.user.brand ?? "Brand"}
          </h2>
        </div>
      ) : (
        <Link
          href="/"
          className="mb-10 font-mono text-sm font-bold tracking-[0.18em] text-green-primary"
        >
          ⬡ CLOUTWATCH
        </Link>
      )}

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "rounded-md px-3 py-2 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors",
                item.nested ? "ml-3 border-l border-border-subtle pl-4 text-[0.66rem]" : "",
                isActive
                  ? "bg-green-ghost text-green-primary"
                  : "text-grey-500 hover:bg-green-ghost hover:text-green-primary",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isEmployee ? (
        <section className="mt-8 space-y-4 border-t border-border-subtle pt-5">
          <button
            type="button"
            onClick={() => setDrawer("notifications")}
            className="flex w-full items-center justify-between gap-2 text-left font-mono text-[0.64rem] font-bold uppercase tracking-[0.16em] text-grey-500 transition-colors hover:text-green-primary"
          >
            <span>Notifications</span>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-green-primary px-2 py-0.5 text-[0.62rem] text-white">
                {pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setDrawer("redflags")}
            className="flex w-full items-center justify-between gap-2 text-left font-mono text-[0.64rem] font-bold uppercase tracking-[0.16em] text-grey-500 transition-colors hover:text-red-flag"
          >
            <span>Red Flags</span>
            {unseenCount > 0 ? (
              <span className="animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-red-flag px-2 py-0.5 text-[0.62rem] text-white shadow-[0_0_8px_#ff4444,0_0_16px_#ff444466]">
                {unseenCount}
              </span>
            ) : null}
          </button>
        </section>
      ) : null}

      {isEmployee ? (
        <>
          <div
            className={[
              "fixed bottom-0 right-0 top-0 z-50 w-[480px] overflow-y-auto border-l border-border-subtle bg-bg-surface p-6 shadow-[-24px_0_48px_rgba(0,0,0,0.35)] transition-transform duration-300",
              drawer === "notifications" ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <h2 className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-green-primary">
                Pending Digests
              </h2>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="font-mono text-xs font-bold text-grey-500 hover:text-grey-100"
              >
                X
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {[...pendingDigests]
                .sort((a, b) => Number(a.status === "sent") - Number(b.status === "sent"))
                .map((digest) => {
                  const isSent = digest.status === "sent";
                  const bodyText = getDigestText(digest);
                  const toEmail = selectedEmails[digest.id] ?? digest.toEmail;

                  return (
                    <article
                      key={digest.id}
                      className={[
                        "relative rounded-2xl border border-border-subtle bg-bg-card p-4",
                        isSent ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      {isSent ? (
                        <span className="absolute right-4 top-4 rotate-6 rounded border border-grey-500 px-2 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-grey-500">
                          Sent ✓
                        </span>
                      ) : null}
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-green-primary">
                        {digest.brand}
                      </p>
                      <div className="mt-3">
                        <p className="mb-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-grey-500">
                          To:
                        </p>
                        <EmailChipSelector
                          brand={digest.brand}
                          value={toEmail}
                          onChange={(email) =>
                            setSelectedEmails((current) => ({
                              ...current,
                              [digest.id]: email,
                            }))
                          }
                          onSave={(email, label) =>
                            saveEmailAddress(email, label, digest.brand)
                          }
                        />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-grey-100">
                        {digest.subject}
                      </p>
                      <p className="mt-3 text-xs leading-5 text-grey-300">
                        {getPreview(bodyText)}
                      </p>
                      {expandedDigestId === digest.id ? (
                        <textarea
                          value={bodyText}
                          onChange={(event) =>
                            void updateDigestBody(
                              digest.id,
                              digest.subject,
                              event.target.value,
                            )
                          }
                          className="mt-4 h-80 w-full rounded-xl border border-border-subtle bg-bg-surface p-4 text-sm leading-7 text-grey-100 outline-none focus:border-green-primary"
                        />
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDigestId((current) =>
                              current === digest.id ? null : digest.id,
                            )
                          }
                          className="rounded-md border border-border-subtle px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-grey-300 hover:text-green-primary"
                        >
                          View & Edit
                        </button>
                        <button
                          type="button"
                          disabled={isSent}
                          onClick={() => void sendDigest(digest)}
                          className="rounded-md border border-green-dim bg-green-ghost px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-green-primary hover:bg-green-primary hover:text-bg-base disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Send ✉
                        </button>
                      </div>
                      {savePromptDigestId === digest.id ? (
                        <div className="mt-3 rounded-xl border border-border-subtle bg-bg-surface p-3">
                          <p className="text-xs text-grey-300">
                            Save this address for future use?
                          </p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void sendDigest(digest, true)}
                              className="rounded-md border border-green-dim bg-green-ghost px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-green-primary"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSavePromptDigestId(null);
                                void sendDigest(digest, false, true);
                              }}
                              className="rounded-md border border-border-subtle px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-grey-300"
                            >
                              No
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {sendStatus[digest.id] ? (
                        <p className="mt-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-green-primary">
                          {sendStatus[digest.id]}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              {pendingDigests.length === 0 ? (
                <p className="rounded-2xl border border-border-subtle bg-bg-card p-4 text-sm text-grey-500">
                  No pending digests yet.
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={[
              "fixed bottom-0 right-0 top-0 z-50 w-[480px] overflow-y-auto border-l border-border-subtle bg-bg-surface p-6 shadow-[-24px_0_48px_rgba(0,0,0,0.35)] transition-transform duration-300",
              drawer === "redflags" ? "translate-x-0" : "translate-x-full",
            ].join(" ")}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <h2 className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-red-flag">
                Red Flag Alerts
              </h2>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="font-mono text-xs font-bold text-grey-500 hover:text-grey-100"
              >
                X
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {redFlags.map((alert) => (
                <article
                  key={alert.id}
                  className={[
                    "rounded-2xl border border-border-subtle border-l-[3px] border-l-red-flag bg-bg-card p-4",
                    alert.status === "seen" ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-red-flag">{alert.creator}</p>
                      <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-grey-500">
                        {alert.brand}
                      </p>
                    </div>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em]",
                        alert.severity === "CRITICAL"
                          ? "bg-red-flag text-white"
                          : "bg-amber-warn text-bg-base",
                      ].join(" ")}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-grey-100">{alert.reason}</p>
                  <p className="mt-3 font-mono text-[0.66rem] text-grey-500">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedAlertId((current) =>
                        current === alert.id ? null : alert.id,
                      )
                    }
                    className="mt-4 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-green-primary"
                  >
                    Mitigation Steps
                  </button>
                  {expandedAlertId === alert.id ? (
                    <div className="mt-3 rounded-xl border border-border-subtle bg-bg-surface p-3">
                      <ul className="space-y-2">
                        {getMitigationPoints(alert.mitigation).map((point, index) => (
                          <li key={`${point}-${index}`} className="flex gap-2 text-sm leading-6 text-grey-100">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-flag" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void markAlertSeen(alert.id)}
                    className="mt-4 rounded-md border border-red-flag/70 bg-red-flag/10 px-3 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-red-flag hover:bg-red-flag hover:text-white"
                  >
                    Mark as Seen ✓
                  </button>
                </article>
              ))}
              <p className="text-[0.72rem] leading-5 text-grey-500">
                Alerts fire automatically when Risk Agent detects severity RED
              </p>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}
