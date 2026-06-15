import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import { type CreatorRow } from "@/lib/dataStore";

export async function loadMockCampaigns() {
  const filePath = path.join(process.cwd(), "public", "mock_campaigns.csv");
  const csv = await fs.readFile(filePath, "utf8");
  const parsed = Papa.parse<CreatorRow>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join(", "));
  }

  return parsed.data;
}
