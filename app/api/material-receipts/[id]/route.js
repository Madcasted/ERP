import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function mapRoll(roll, index) {
  return {
    rollNo: Number.isFinite(Number(roll.rollNo)) && roll.rollNo !== "" ? Number(roll.rollNo) : index + 1,
    weightKg: Number(roll.weightKg) || 0,
    issueDate: roll.issueDate || null,
    issuer: roll.issuer || null,
    productCode: roll.productCode || null,
    lotNo: roll.lotNo || null,
    goodQty: roll.goodQty || null,
    defectQty: roll.defectQty || null,
    diecutQty: roll.diecutQty || null,
    diecutReceiveDate: roll.diecutReceiveDate || null,
    packQty: roll.packQty || null,
  };
}

export async function PUT(request, { params }) {
  const body = await request.json();
  const rolls = Array.isArray(body.rolls) ? body.rolls : [];
  const receipt = await prisma.$transaction(async (tx) => {
    await tx.materialRoll.deleteMany({ where: { receiptId: params.id } });
    return tx.materialReceipt.update({
      where: { id: params.id },
      data: {
        materialId: body.materialId || null,   // ← เพิ่มบรรทัดนี้
        materialName: body.materialName || "",
        receivedDate: body.receivedDate || null,
        supplier: body.supplier || null,
        supplierNote: body.supplierNote || null,
        invoiceNo: body.invoiceNo || null,
        unitPrice: Number(body.unitPrice) || 0,
        width: body.width ? Number(body.width) : null,
        height: body.height ? Number(body.height) : null,
        thickness: body.thickness ? Number(body.thickness) : null,
        rolls: { create: rolls.map(mapRoll) },
      },
      include: {
        rolls: { orderBy: { rollNo: "asc" } },
        material: { select: { id: true, name: true, unit: true, unitPrice: true } }, // ← เพิ่มด้วย
      },
    });
  });
  return NextResponse.json(receipt);
}

export async function GET(request, { params }) {
  const receipt = await prisma.materialReceipt.findUnique({
    where: { id: params.id },
    include: {
      rolls: { orderBy: { rollNo: "asc" } },
      material: { select: { id: true, name: true, unit: true, unitPrice: true } }, // ← เพิ่มด้วยเช่นกัน
    },
  });
  if (!receipt) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(receipt);
}
export async function DELETE(request, { params }) {
  await prisma.materialReceipt.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
