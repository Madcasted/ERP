import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");

    if (!machineId) {
      return NextResponse.json({ message: "กรุณาระบุ machineId" }, { status: 400 });
    }

    const logs = await prisma.$queryRaw`
      SELECT * FROM "MachineLog"
      WHERE "machineId" = ${machineId}
      ORDER BY "createdAt" DESC
    `;

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Get machine logs failed:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();

    const [log] = await prisma.$queryRaw`
      INSERT INTO "MachineLog" (
        "id", "machineId",
        "productName", "matCode", "company",
        "rollNo", "matWeight",
        "timeOpen", "timeClose",
        "goodPcs", "defectPcs",
        "operator1", "operator2",
        "returnedBy", "returnedQty",
        "timerPrintDown", "timerPrintUp", "timerPrintTop",
        "timerOpenVac1", "timerCloseVac1",
        "timerOpenVac2", "timerCloseVac2",
        "timerOpenFan", "timerCloseFan",
        "timerOpenBlow", "timerCloseBlow",
        "timerOpenHeat", "timerHeat", "timerOpenShield",
        "unrollSpeed", "runSpeed", "runLength", "programNo",
        "heat", "recordedBy", "recordedAt",
        "logDate", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${body.machineId},
        ${body.productName || ""},
        ${body.matCode || null},
        ${body.company || null},
        ${body.rollNo || 0},
        ${body.matWeight || null},
        ${body.timeOpen || null},
        ${body.timeClose || null},
        ${body.goodPcs || 0},
        ${body.defectPcs || 0},
        ${body.operator1 || null},
        ${body.operator2 || null},
        ${body.returnedBy || null},
        ${body.returnedQty || null},
        ${body.timerPrintDown || null},
        ${body.timerPrintUp || null},
        ${body.timerPrintTop || null},
        ${body.timerOpenVac1 || null},
        ${body.timerCloseVac1 || null},
        ${body.timerOpenVac2 || null},
        ${body.timerCloseVac2 || null},
        ${body.timerOpenFan || null},
        ${body.timerCloseFan || null},
        ${body.timerOpenBlow || null},
        ${body.timerCloseBlow || null},
        ${body.timerOpenHeat || null},
        ${body.timerHeat || null},
        ${body.timerOpenShield || null},
        ${body.unrollSpeed || null},
        ${body.runSpeed || null},
        ${body.runLength || null},
        ${body.programNo || null},
        ${body.heat ? JSON.stringify(body.heat) : null},
        ${body.recordedBy || null},
        ${body.recordedAt ? new Date(body.recordedAt) : null},
        ${body.logDate ? new Date(body.logDate) : now},
        ${now},
        ${now}
      )
      RETURNING "id"
    `;

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Create machine log failed:", error);
    return NextResponse.json({ message: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}