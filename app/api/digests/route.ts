import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { weeklyDigestStore } from "@/lib/digestStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const brand =
    session?.user.role === "client" && session.user.brand
      ? session.user.brand
      : searchParams.get("brand");
  const digests = brand ? weeklyDigestStore.getByBrand(brand) : weeklyDigestStore.getAll();

  return NextResponse.json({ digests });
}
