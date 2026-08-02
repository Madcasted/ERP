import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const materials = await prisma.material.findMany({ 
    include: { receivingLots: { orderBy: { receivingDate: "desc" } } },
    orderBy: { updatedAt: "desc" } 
  });
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
    include: { receivingLots: true }
  });
  return NextResponse.json(material, { status: 201 });
}
