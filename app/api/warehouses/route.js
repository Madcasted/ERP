import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(warehouses);
}

export async function POST(request) {
  const body = await request.json();
  const warehouse = await prisma.warehouse.create({
    data: {
      name: body.name,
      location: body.location || "",
      image: body.image || null,
    },
  });
  return NextResponse.json(warehouse, { status: 201 });
}
