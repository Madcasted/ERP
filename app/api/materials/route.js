import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const materials = await prisma.material.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(materials);
}

export async function POST(request) {
  const body = await request.json();
  const material = await prisma.material.create({
    data: {
      name: body.name,
      unit: body.unit || null,
      unitPrice: Number(body.unitPrice) || 0,
      description: body.description || "",
    },
  });
  return NextResponse.json(material, { status: 201 });
}
