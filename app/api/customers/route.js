import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const customers = await prisma.customer.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(customers);
}
