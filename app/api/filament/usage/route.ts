import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSessionValue, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const spoolId = typeof body.spoolId === "string" ? body.spoolId : "";
  const printJob = typeof body.printJob === "string" ? body.printJob.trim() : "";
  const amountGrams = Number(body.amountGrams);
  const usedAt = body.usedAt ? new Date(`${body.usedAt}T12:00:00`) : new Date();

  if (!spoolId || !printJob || !Number.isFinite(amountGrams) || amountGrams <= 0) {
    return NextResponse.json({ error: "กรุณาเลือกม้วน ระบุงานที่พิมพ์ และน้ำหนักที่ใช้ให้ถูกต้อง" }, { status: 400 });
  }
  if (Number.isNaN(usedAt.getTime())) {
    return NextResponse.json({ error: "วันที่ใช้งานไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const usage = await prisma.$transaction(async (transaction) => {
      const result = await transaction.filamentSpool.updateMany({
        where: { id: spoolId, remainingWeightGrams: { gte: amountGrams } },
        data: { remainingWeightGrams: { decrement: amountGrams } },
      });
      if (result.count === 0) {
        const spoolExists = await transaction.filamentSpool.findUnique({ where: { id: spoolId }, select: { id: true } });
        throw new Error(spoolExists ? "INSUFFICIENT_WEIGHT" : "SPOOL_NOT_FOUND");
      }

      return transaction.filamentUsage.create({
        data: { spoolId, printJob, amountGrams, usedBy: user.name, userId: user.id, usedAt },
      });
    });
    return NextResponse.json(usage, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_WEIGHT") {
      return NextResponse.json({ error: "น้ำหนักคงเหลือในม้วนไม่เพียงพอ" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SPOOL_NOT_FOUND") {
      return NextResponse.json({ error: "ไม่พบม้วน Filament นี้" }, { status: 404 });
    }
    console.error("Create filament usage failed:", error);
    return NextResponse.json({ error: "บันทึกการใช้ไม่สำเร็จ" }, { status: 500 });
  }
}
