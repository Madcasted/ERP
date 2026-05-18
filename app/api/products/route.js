import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function intervalToTrunc(unit) {
  switch (unit) {
    case "daily":
      return "day";
    case "weekly":
      return "week";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    case "yearly":
      return "year";
    default:
      return "day";
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const report = url.searchParams.get("report");
  const interval = url.searchParams.get("interval") || "daily";

  if (report === "created") {
    const trunc = intervalToTrunc(interval);

    let range = "30 days";
    if (trunc === "week") range = "84 days";
    if (trunc === "month") range = "365 days";
    if (trunc === "quarter") range = "1460 days";
    if (trunc === "year") range = "3650 days";

    const rows = await prisma.$queryRaw`
      SELECT date_trunc(${trunc}::text, "createdAt") AS period, count(*)::int
      FROM "Product"
      WHERE "createdAt" >= now() - interval ${range}
      GROUP BY period
      ORDER BY period;
    `;

    return NextResponse.json(rows.map((r) => ({ period: r.period, count: Number(r.count) })));
  }

  const products = await prisma.product.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(products);
}
