import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request, { params }) {
  const { id } = params;
  const body = await request.json();
  
  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: {
      name: body.name || undefined,
      location: body.location || undefined,
      image: body.image !== undefined ? body.image : undefined,
    },
  });
  
  return NextResponse.json(warehouse);
}

export async function DELETE(request, { params }) {
  const { id } = params;
  
  await prisma.warehouse.delete({
    where: { id },
  });
  
  return NextResponse.json({ success: true });
}
