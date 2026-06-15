import { notificationStore } from "@/lib/notificationStore";

function digestHtml({
  brand,
  topPerformer,
  emv,
  highlight,
  actionItem,
}: {
  brand: string;
  topPerformer: string;
  emv: string;
  highlight: string;
  actionItem: string;
}) {
  return `
  <div style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#151515;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dce5df;border-radius:18px;overflow:hidden;">
      <div style="padding:28px;background:#0a0a0a;color:#f0f0f0;">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#1aff66;font-weight:700;">Creator IQ Weekly</div>
        <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;color:#1aff66;">${brand} creator update</h1>
        <p style="margin:8px 0 0;color:#a0a0a0;">June 14, 2026</p>
      </div>
      <div style="padding:26px;">
        <section style="margin-bottom:22px;">
          <h2 style="margin:0 0 8px;color:#1aff66;font-size:16px;">Top performer this week</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">${topPerformer}</p>
        </section>
        <section style="margin-bottom:22px;padding:18px;background:#f7faf8;border-left:4px solid #1aff66;border-radius:12px;">
          <h2 style="margin:0 0 8px;color:#111111;font-size:16px;">EMV update</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">${emv}</p>
        </section>
        <section style="margin-bottom:22px;">
          <h2 style="margin:0 0 8px;color:#1aff66;font-size:16px;">Roster note</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">${highlight}</p>
        </section>
        <section>
          <h2 style="margin:0 0 8px;color:#1aff66;font-size:16px;">Open action item</h2>
          <p style="margin:0;font-size:15px;line-height:1.6;">${actionItem}</p>
        </section>
      </div>
      <div style="padding:18px 26px;background:#f4f7f5;color:#555555;font-size:12px;">
        Powered by Creator IQ
      </div>
    </div>
  </div>`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

function digestText({
  brand,
  topPerformer,
  emv,
  highlight,
  actionItem,
}: {
  brand: string;
  topPerformer: string;
  emv: string;
  highlight: string;
  actionItem: string;
}) {
  return [
    `Hi ${brand} team,`,
    "Here is this week's creator performance update:",
    `- Top performer: ${stripHtml(topPerformer)}`,
    `- EMV update: ${stripHtml(emv)}`,
    `- Roster note: ${stripHtml(highlight)}`,
    `- Next step: ${stripHtml(actionItem)}`,
    "Best,",
    "Creator IQ Team",
  ].join("\n\n");
}

export function seedNotifications() {
  if (notificationStore.getPendingCount() !== 0) {
    return;
  }

  const createdAt = new Date().toISOString();

  const lorealDigest = {
    brand: "L'Oreal",
    topPerformer:
      "<strong>@glossy.glow</strong> led the roster with engagement rate up <strong>+1.1%</strong> this week and EMV at <strong>$12,400</strong>.",
    emv: "Total EMV this week is <strong>$478,200</strong>, up <strong>+8.3%</strong> vs last week.",
    highlight:
      "<strong>@nanoglow.nina</strong> is the sentiment highlight at <strong>0.93</strong>, highest in the roster.",
    actionItem:
      "Deepthi to deliver micro/nano creator shortlist — <strong>due this Friday</strong>.",
  };
  const nikeDigest = {
    brand: "Nike",
    topPerformer:
      "<strong>@dailydribble</strong> is the top performer at <strong>7.4%</strong> engagement, up <strong>+0.5%</strong> this week.",
    emv: "Total EMV this week is <strong>$737,400</strong>, up <strong>+5.1%</strong> vs last week.",
    highlight:
      "<strong>Concern:</strong> @eliteathletemax was flagged for fake followers; budget is being reallocated to the micro tier.",
    actionItem:
      "Platform breakdown TikTok vs Instagram still pending — <strong>no decision yet</strong>.",
  };
  const glossierDigest = {
    brand: "Glossier",
    topPerformer:
      "<strong>@grwm.grace</strong> is the top performer at <strong>11.2%</strong> engagement, highest nano on the roster.",
    emv: "Total EMV this week is <strong>$71,100</strong>, up <strong>+12.4%</strong> vs last week.",
    highlight:
      "The entire Glossier roster is above <strong>0.87</strong> sentiment, the cleanest sentiment profile across all brands.",
    actionItem:
      "Awaiting Glossier Q3 budget approval from Camille — <strong>expected end of next week</strong>.",
  };

  notificationStore.add({
    id: crypto.randomUUID(),
    brand: "L'Oreal",
    toEmail: "loreal.team@gmail.com",
    subject: "📊 Weekly Creator Update — L'Oreal — June 14, 2026",
    bodyHtml: digestHtml(lorealDigest),
    bodyText: digestText(lorealDigest),
    status: "pending",
    createdAt,
    sentAt: null,
  });

  notificationStore.add({
    id: crypto.randomUUID(),
    brand: "Nike",
    toEmail: "nike.partnerships@gmail.com",
    subject: "📊 Weekly Creator Update — Nike — June 14, 2026",
    bodyHtml: digestHtml(nikeDigest),
    bodyText: digestText(nikeDigest),
    status: "pending",
    createdAt,
    sentAt: null,
  });

  notificationStore.add({
    id: crypto.randomUUID(),
    brand: "Glossier",
    toEmail: "glossier.collab@gmail.com",
    subject: "📊 Weekly Creator Update — Glossier — June 14, 2026",
    bodyHtml: digestHtml(glossierDigest),
    bodyText: digestText(glossierDigest),
    status: "pending",
    createdAt,
    sentAt: null,
  });
}
