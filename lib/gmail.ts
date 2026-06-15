import { google } from "googleapis";
import { type CreatorRow } from "@/lib/dataStore";
import { meetingStore, type MeetingNote } from "@/lib/meetingStore";

type WeeklyDigestData = {
  creators?: CreatorRow[];
  meetingNotes?: MeetingNote[];
  bodyHtml?: string;
};

function toNumber(value: CreatorRow[string]) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSigned(value: number, suffix = "") {
  const prefix = value >= 0 ? "+" : "";

  return `${prefix}${value.toFixed(2)}${suffix}`;
}

function getDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function getTimestampLabel() {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
}

function getCreators(data: object) {
  const digestData = data as WeeklyDigestData;

  return Array.isArray(digestData.creators) ? digestData.creators : [];
}

function getMeetingNotes(brand: string, data: object) {
  const digestData = data as WeeklyDigestData;

  if (Array.isArray(digestData.meetingNotes)) {
    return digestData.meetingNotes;
  }

  return meetingStore.getByBrand(brand);
}

function getTopEngagementMover(creators: CreatorRow[]) {
  return [...creators].sort((a, b) => {
    const aDelta = toNumber(a.eng_rate) - toNumber(a.prev_eng_rate);
    const bDelta = toNumber(b.eng_rate) - toNumber(b.prev_eng_rate);

    return bDelta - aDelta;
  })[0];
}

function getPositiveSentimentCreators(creators: CreatorRow[]) {
  return creators
    .map((creator) => ({
      handle: String(creator.creator_handle ?? "Unknown"),
      delta: toNumber(creator.sentiment_score) - toNumber(creator.prev_sentiment_score),
    }))
    .filter((creator) => creator.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
}

function getLatestMeeting(notes: MeetingNote[]) {
  return [...notes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];
}

function encodeEmail(rawEmail: string) {
  return Buffer.from(rawEmail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawEmail({
  toEmail,
  subject,
  html,
  priority,
}: {
  toEmail: string;
  subject: string;
  html: string;
  priority?: boolean;
}) {
  const headers = [
    `To: ${toEmail}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    ...(priority ? ["X-Priority: 1", "Importance: high"] : []),
  ];

  return encodeEmail(`${headers.join("\r\n")}\r\n\r\n${html}`);
}

async function sendGmail({
  toEmail,
  subject,
  html,
  accessToken,
  priority,
}: {
  toEmail: string;
  subject: string;
  html: string;
  accessToken: string;
  priority?: boolean;
}) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: buildRawEmail({
        toEmail,
        subject,
        html,
        priority,
      }),
    },
  });
}

export function getGmailErrorMessage(error: unknown) {
  const maybeError = error as {
    message?: string;
    code?: number;
    response?: {
      status?: number;
      data?: {
        error?: {
          message?: string;
        };
      };
    };
  };
  const message = maybeError.response?.data?.error?.message ?? maybeError.message;

  if (
    maybeError.code === 401 ||
    maybeError.response?.status === 401 ||
    /invalid authentication credentials|expected oauth 2 access token|login cookie/i.test(
      message ?? "",
    )
  ) {
    return "Google Gmail access expired or was revoked. Sign out, sign in with Google again, then retry Send.";
  }

  if (maybeError.code === 403 || maybeError.response?.status === 403) {
    return message?.includes("Gmail API has not been used")
      ? "Gmail API is disabled for this Google project. Enable Gmail API in Google Cloud, then try sending again."
      : message ?? "Gmail rejected the send request with a permissions error.";
  }

  return message ?? "Failed to send email.";
}

export function getWeeklyDigestSubject(brand: string) {
  return `📊 Weekly Creator Update — ${brand} — ${getDateLabel()}`;
}

export function buildWeeklyDigestText(brand: string, data: object) {
  const creators = getCreators(data).filter((creator) => creator.brand === brand);
  const meetingNotes = getMeetingNotes(brand, data);
  const latestMeeting = getLatestMeeting(meetingNotes);
  const topCreator = getTopEngagementMover(creators);
  const topDelta = topCreator
    ? toNumber(topCreator.eng_rate) - toNumber(topCreator.prev_eng_rate)
    : 0;
  const totalEmv = creators.reduce((sum, creator) => sum + toNumber(creator.EMV), 0);
  const previousTotalEmv = creators.reduce(
    (sum, creator) => sum + toNumber(creator.prev_EMV),
    0,
  );
  const emvDelta = totalEmv - previousTotalEmv;
  const sentimentMovers = getPositiveSentimentCreators(creators);
  const actionItems = latestMeeting?.action_items ?? [];

  return [
    `Hi ${brand} team,`,
    "Here is this week's creator performance update:",
    `- Top performer: ${
      topCreator
        ? `${String(topCreator.creator_handle ?? "Unknown")} (${String(
            topCreator.tier ?? "unknown tier",
          )}) with engagement delta ${formatSigned(topDelta, " pts")}.`
        : "No creator data available."
    }`,
    `- EMV update: this week ${formatCurrency(totalEmv)}, last period ${formatCurrency(
      previousTotalEmv,
    )}, delta ${emvDelta >= 0 ? "+" : ""}${formatCurrency(emvDelta)}.`,
    sentimentMovers.length > 0
      ? sentimentMovers
          .map((creator) => `- Sentiment shift: ${creator.handle} ${formatSigned(creator.delta)}.`)
          .join("\n")
      : "- Sentiment shifts: no positive shifts detected this week.",
    actionItems.length > 0
      ? actionItems
          .map(
            (item) =>
              `- Next step: ${item.task} — ${item.owner || "Unassigned"} (${item.due || "no due date"}).`,
          )
          .join("\n")
      : "- Next step: no open action items found.",
    "Best,",
    "Cloutwatch Team",
  ].join("\n\n");
}

export function buildWeeklyDigestHtml(brand: string, data: object) {
  const creators = getCreators(data).filter((creator) => creator.brand === brand);
  const meetingNotes = getMeetingNotes(brand, data);
  const latestMeeting = getLatestMeeting(meetingNotes);
  const topCreator = getTopEngagementMover(creators);
  const topDelta = topCreator
    ? toNumber(topCreator.eng_rate) - toNumber(topCreator.prev_eng_rate)
    : 0;
  const totalEmv = creators.reduce((sum, creator) => sum + toNumber(creator.EMV), 0);
  const previousTotalEmv = creators.reduce(
    (sum, creator) => sum + toNumber(creator.prev_EMV),
    0,
  );
  const emvDelta = totalEmv - previousTotalEmv;
  const sentimentMovers = getPositiveSentimentCreators(creators);
  const actionItems = latestMeeting?.action_items ?? [];

  return `
  <div style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#151515;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dce5df;border-radius:18px;overflow:hidden;">
      <div style="padding:28px;background:#0a0a0a;color:#f0f0f0;">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1aff66;font-weight:700;">Cloutwatch Weekly</div>
        <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#1aff66;">${escapeHtml(
          brand,
        )} creator update</h1>
        <p style="margin:8px 0 0;color:#a0a0a0;">${escapeHtml(getDateLabel())}</p>
      </div>
      <div style="padding:26px;">
        <section style="margin-bottom:22px;">
          <h2 style="margin:0 0 8px;color:#1aff66;font-size:16px;">Top performer this week</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">${
            topCreator
              ? `<strong>${escapeHtml(String(topCreator.creator_handle ?? "Unknown"))}</strong> · ${escapeHtml(
                  String(topCreator.tier ?? "unknown tier"),
                )} · engagement delta <strong>${escapeHtml(formatSigned(topDelta, " pts"))}</strong>`
              : "No creator data available."
          }</p>
        </section>
        <section style="margin-bottom:22px;padding:18px;background:#f7faf8;border-left:4px solid #1aff66;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#111111;font-size:16px;">EMV delta</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">This week: <strong>${escapeHtml(
            formatCurrency(totalEmv),
          )}</strong><br/>Last period: ${escapeHtml(
            formatCurrency(previousTotalEmv),
          )}<br/>Delta: <strong>${emvDelta >= 0 ? "+" : ""}${escapeHtml(
            formatCurrency(emvDelta),
          )}</strong></p>
        </section>
        <section style="margin-bottom:22px;">
          <h2 style="margin:0 0 8px;color:#1aff66;font-size:16px;">Sentiment shifts</h2>
          ${
            sentimentMovers.length > 0
              ? `<ul style="margin:0;padding-left:18px;">${sentimentMovers
                  .map(
                    (creator) =>
                      `<li style="margin-bottom:6px;"><strong>${escapeHtml(
                        creator.handle,
                      )}</strong> ${escapeHtml(formatSigned(creator.delta))}</li>`,
                  )
                  .join("")}</ul>`
              : '<p style="margin:0;color:#555555;">No positive shifts detected this week.</p>'
          }
        </section>
        <section style="margin-bottom:22px;">
          <h2 style="margin:0 0 8px;color:#1aff66;font-size:16px;">Open action items</h2>
          ${
            actionItems.length > 0
              ? `<ul style="margin:0;padding-left:18px;">${actionItems
                  .map(
                    (item) =>
                      `<li style="margin-bottom:6px;">${escapeHtml(
                        item.task,
                      )} — ${escapeHtml(item.owner || "Unassigned")} (${escapeHtml(
                        item.due || "no due date",
                      )})</li>`,
                  )
                  .join("")}</ul>`
              : '<p style="margin:0;color:#555555;">No open action items found.</p>'
          }
        </section>
      </div>
      <div style="padding:18px 26px;background:#f4f7f5;color:#555555;font-size:12px;">
        Powered by Cloutwatch · Automated weekly update
      </div>
    </div>
  </div>`;
}

export function buildRedFlagAlertHtml(
  brand: string,
  creator: string,
  reason: string,
  severity: string,
) {
  const normalizedSeverity = severity.toUpperCase() === "CRITICAL" ? "CRITICAL" : "HIGH";
  const badgeColor = normalizedSeverity === "CRITICAL" ? "#ff4444" : "#ffaa00";

  return `
  <div style="margin:0;padding:24px;background:#fff5f5;font-family:Arial,Helvetica,sans-serif;color:#151515;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:2px solid #ff4444;border-radius:18px;overflow:hidden;">
      <div style="padding:28px;background:#220909;color:#ffffff;">
        <h1 style="margin:0;color:#ff4444;font-size:28px;line-height:1.2;">🚨 URGENT Red Flag Alert</h1>
        <p style="margin:10px 0 0;color:#ffd6d6;">Immediate analyst review required</p>
      </div>
      <div style="padding:26px;">
        <p style="margin:0 0 12px;font-size:16px;"><strong>Creator:</strong> <span style="font-weight:700;color:#ff4444;">${escapeHtml(
          creator,
        )}</span></p>
        <p style="margin:0 0 12px;font-size:16px;"><strong>Brand:</strong> ${escapeHtml(
          brand,
        )}</p>
        <p style="margin:0 0 18px;"><span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${badgeColor};color:#ffffff;font-weight:700;font-size:12px;letter-spacing:1px;">${normalizedSeverity}</span></p>
        <div style="margin-bottom:18px;padding:18px;background:#fff7f7;border-left:4px solid #ff4444;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#ff4444;font-size:16px;">Reason</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">${escapeHtml(reason)}</p>
        </div>
        <div style="margin-bottom:18px;padding:18px;background:#f7faf8;border-left:4px solid #1aff66;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#111111;font-size:16px;">Recommended action</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">Pause creator commitment, review the risk evidence, and confirm mitigation steps before presenting this shortlist to the client.</p>
        </div>
        <p style="margin:0;color:#555555;font-size:12px;">Timestamp: ${escapeHtml(
          getTimestampLabel(),
        )}</p>
      </div>
    </div>
  </div>`;
}

export async function sendWeeklyDigest(
  brand: string,
  toEmail: string,
  data: object,
  accessToken: string,
) {
  const digestData = data as WeeklyDigestData;
  const subject = getWeeklyDigestSubject(brand);
  const html = digestData.bodyHtml ?? buildWeeklyDigestHtml(brand, data);

  await sendGmail({
    toEmail,
    subject,
    html,
    accessToken,
  });

  return {
    subject,
    bodyHtml: html,
  };
}

export async function sendRedFlagAlert(
  brand: string,
  toEmail: string,
  creator: string,
  reason: string,
  severity: string,
  accessToken: string,
) {
  const subject = `🚨 URGENT — Red Flag Alert: ${creator} — ${brand}`;
  const html = buildRedFlagAlertHtml(brand, creator, reason, severity);

  await sendGmail({
    toEmail,
    subject,
    html,
    accessToken,
    priority: true,
  });
}
