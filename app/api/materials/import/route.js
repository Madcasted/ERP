import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();
    const { materialId, receivingData } = body;

    // receivingData is an array of receiving records
    if (!Array.isArray(receivingData) || receivingData.length === 0) {
      return NextResponse.json({ error: "No receiving data provided" }, { status: 400 });
    }

    const created = await Promise.all(
      receivingData.map((item) =>
        prisma.materialReceiving.create({
          data: {
            materialId,
            supplier: item.supplier || "",
            invoiceNo: item.invoiceNo || "",
            lotNumber: item.lotNumber || "",
            productCode: item.productCode || "",
            weight: item.weight ? Number(item.weight) : 0,
            quantity: item.quantity ? Number(item.quantity) : 0,
            unit: item.unit || "",
            receivingDate: item.receivingDate ? new Date(item.receivingDate) : new Date(),
            qcStatus: item.qcStatus || "pending",
            notes: item.notes || "",
          },
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
