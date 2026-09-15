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
      description: body.description || "",
      supplier: body.supplier || null,
      invoiceNo: body.invoiceNo || null,
      productCode: body.productCode || null,
      weight: body.weight ? Number(body.weight) : null,
      width: body.width ? Number(body.width) : null,
      height: body.height ? Number(body.height) : null,
      thickness: body.thickness ? Number(body.thickness) : null,
      lotNumber: body.lotNumber || null,
      receivingDate: body.receivingDate ? new Date(body.receivingDate) : null,
    },
    include: { receivingLots: { orderBy: { receivingDate: "desc" } } }
  });
  return NextResponse.json(material);
}

export async function DELETE(request, { params }) {
  await prisma.material.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
