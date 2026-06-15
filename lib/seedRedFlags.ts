import { redFlagStore } from "@/lib/notificationStore";

export function seedRedFlags() {
  if (redFlagStore.getAll().length !== 0) {
    return;
  }

  const createdAt = new Date().toISOString();

  redFlagStore.add({
    id: crypto.randomUUID(),
    brand: "Nike",
    creator: "@eliteathletemax",
    reason:
      "Fake follower flag triggered. Audience quality tool detected 28% inauthentic followers — well above the 5% brand threshold. Last campaign EMV inflated by estimated $140,000 due to fake engagement.",
    severity: "CRITICAL",
    mitigation:
      "1. Remove @eliteathletemax from active Nike campaign plans.\n2. Recalculate EMV impact before the next client update.\n3. Reallocate budget to clean-audience backup creators.",
    status: "unseen",
    createdAt,
  });

  redFlagStore.add({
    id: crypto.randomUUID(),
    brand: "L'Oreal",
    creator: "@thebeautylab",
    reason:
      "Sentiment score dropped from 0.81 to 0.64 in the last 7 days following a controversial brand partnership post unrelated to L'Oreal. Audience comments trending negative. CPE has spiked to $0.24 — 50% above the L'Oreal threshold of $0.16.",
    severity: "HIGH",
    mitigation:
      "1. Pause scheduled L'Oreal content for 14 days.\n2. Brief Deepthi before client messaging.\n3. Prepare @skindeep.sara as backup talent.",
    status: "unseen",
    createdAt,
  });
}
