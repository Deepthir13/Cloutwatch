import { NextResponse } from "next/server";
import { dataStore, REQUIRED_COLS, type CreatorRow } from "@/lib/dataStore";

type UploadBody = {
  rows?: CreatorRow[];
};

function getMissingColumns(row: CreatorRow) {
  const rowKeys = new Set(Object.keys(row));

  return REQUIRED_COLS.filter((column) => !rowKeys.has(column));
}

function getBrands(rows: CreatorRow[]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.brand)
        .filter((brand): brand is string => typeof brand === "string" && brand.length > 0),
    ),
  ).sort();
}

export async function POST(request: Request) {
  let body: UploadBody;

  try {
    body = (await request.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "Request body must include rows as a non-empty array." },
      { status: 400 },
    );
  }

  const missingColumns = getMissingColumns(body.rows[0]);

  if (missingColumns.length > 0) {
    return NextResponse.json(
      { error: `Missing required columns: ${missingColumns.join(", ")}` },
      { status: 400 },
    );
  }

  dataStore.set(body.rows);

  return NextResponse.json({
    success: true,
    rowCount: body.rows.length,
    brands: getBrands(body.rows),
  });
}

export async function DELETE() {
  dataStore.clear();

  return NextResponse.json({ success: true });
}
