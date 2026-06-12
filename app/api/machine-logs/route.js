import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Parse heat if it's a string
    let heatData = body.heat;
    if (typeof heatData === 'string') {
      try { heatData = JSON.parse(heatData); } catch(e) { heatData = null; }
    }

    const log = await prisma.machineLog.create({
      data: {
        machineId: body.machineId,
        productName: body.productName || "",
        matCode: body.matCode || null,
        company: body.company || null,
        rollNo: body.rollNo || 0,
        matWeight: body.matWeight || null,
        timeOpen: body.timeOpen || null,
        timeClose: body.timeClose || null,
        goodPcs: body.goodPcs || 0,
        defectPcs: body.defectPcs || 0,
        operator1: body.operator1 || null,
        operator2: body.operator2 || null,
        returnedBy: body.returnedBy || null,
        returnedQty: body.returnedQty || null,
        timerPrintDown: body.timerPrintDown || null,
        timerPrintUp: body.timerPrintUp || null,
        timerPrintTop: body.timerPrintTop || null,
        timerOpenVac1: body.timerOpenVac1 || null,
        timerCloseVac1: body.timerCloseVac1 || null,
        timerOpenVac2: body.timerOpenVac2 || null,
        timerCloseVac2: body.timerCloseVac2 || null,
        timerOpenFan: body.timerOpenFan || null,
        timerCloseFan: body.timerCloseFan || null,
        timerOpenBlow: body.timerOpenBlow || null,
        timerCloseBlow: body.timerCloseBlow || null,
        timerOpenHeat: body.timerOpenHeat || null,
        timerHeat: body.timerHeat || null,
        timerOpenShield: body.timerOpenShield || null,
        unrollSpeed: body.unrollSpeed || null,
        runSpeed: body.runSpeed || null,
        runLength: body.runLength || null,
        programNo: body.programNo || null,
        heat: heatData,
        recordedBy: body.recordedBy || null,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : null,
        logDate: body.logDate ? new Date(body.logDate) : new Date(),
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Create machine log failed:", error);
    return NextResponse.json({ message: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}