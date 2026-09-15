import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: { updatedAt: "desc" },
    include: { customer: true, items: { include: { product: true } } },
  });
  return NextResponse.json(orders);
}
