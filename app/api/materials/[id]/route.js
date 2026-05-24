import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request, { params }) {
  const body = await request.json();
  const material = await prisma.material.update({
    where: { id: params.id },
    data: {
      name: body.name,
      unit: body.unit || null,
      unitPrice: Number(body.unitPrice) || 0,
    },
  });
  return NextResponse.json(material);
}

export async function DELETE(request, { params }) {
  await prisma.material.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
