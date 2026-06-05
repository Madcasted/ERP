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

export async function GET() {
  const receipts = await prisma.materialReceipt.findMany({
    orderBy: { updatedAt: "desc" },
    include: { rolls: { orderBy: { rollNo: "asc" } } },
  });
  return NextResponse.json(receipts);
}

export async function POST(request) {
  const body = await request.json();
  const rolls = Array.isArray(body.rolls) ? body.rolls : [];
  const receipt = await prisma.materialReceipt.create({
    data: {
      materialName: body.materialName || "",
      receivedDate: body.receivedDate || null,
      supplier: body.supplier || null,
      supplierNote: body.supplierNote || null,
      invoiceNo: body.invoiceNo || null,
      rolls: { create: rolls.map(mapRoll) },
    },
    include: { rolls: { orderBy: { rollNo: "asc" } } },
  });
  return NextResponse.json(receipt, { status: 201 });
}
