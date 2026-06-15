import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dataStore } from "@/lib/dataStore";
import { loadMockCampaigns } from "@/lib/mockCampaigns";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isCustom = dataStore.isCustom();
  const sourceRows = isCustom ? dataStore.get() : await loadMockCampaigns();
  const rows =
    session?.user.role === "client" && session.user.brand
      ? sourceRows.filter((row) => row.brand === session.user.brand)
      : sourceRows;

  return NextResponse.json({
    rows,
    isCustom,
  });
}
