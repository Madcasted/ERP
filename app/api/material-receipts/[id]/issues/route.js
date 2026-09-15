import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request, { params }) {
  const body = await request.json();
  const rollCount = Number(body.rollCount);

  if (!Number.isInteger(rollCount) || rollCount <= 0) {
    return NextResponse.json({ error: "rollCount must be a positive integer" }, { status: 400 });
  }
  if (!body.issuer || !body.purpose) {
    return NextResponse.json({ error: "issuer and purpose are required" }, { status: 400 });
  }

  const receipt = await prisma.materialReceipt.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      rolls: { select: { weightKg: true } },
      issues: { select: { rollCount: true, weightKg: true } },
    },
  });
  if (!receipt) return NextResponse.json({ error: "receipt not found" }, { status: 404 });

  const totalRolls = receipt.rolls.length;
  const issuedRolls = receipt.issues.reduce((sum, issue) => sum + issue.rollCount, 0);
  const totalWeight = receipt.rolls.reduce((sum, roll) => sum + (roll.weightKg || 0), 0);
  const issuedWeight = receipt.issues.reduce((sum, issue) => sum + (issue.weightKg || 0), 0);
  const weightKg = Number(body.weightKg);
  if (rollCount > totalRolls - issuedRolls) {
    return NextResponse.json({ error: `เบิกได้ไม่เกิน ${totalRolls - issuedRolls} ม้วน (คงเหลือ)` }, { status: 400 });
  }
  if (!Number.isFinite(weightKg) || (totalWeight > 0 && weightKg <= 0) || weightKg > totalWeight - issuedWeight + 0.000001) {
    return NextResponse.json({ error: `น้ำหนักที่เบิกต้องไม่เกิน ${Math.max(0, totalWeight - issuedWeight).toFixed(2)} Kg (คงเหลือ)` }, { status: 400 });
  }

  const issue = await prisma.materialIssue.create({
    data: {
      receiptId: params.id,
      issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
      issuer: String(body.issuer).trim(),
      rollCount,
      weightKg,
      purpose: String(body.purpose).trim(),
    },
  });
  return NextResponse.json(issue, { status: 201 });
}
