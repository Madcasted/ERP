import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request, { params }) {
  try {
    const [machine] = await prisma.$queryRaw`
      SELECT "id", "name", "code", "description", "createdAt", "updatedAt"
      FROM "Machine"
      WHERE "id" = ${params.id}
    `;
    if (!machine) {
      return NextResponse.json({ message: "ไม่พบเครื่องจักร" }, { status: 404 });
    }

    // Also get latest machine logs
    const logs = await prisma.$queryRaw`
      SELECT * FROM "MachineLog"
      WHERE "machineId" = ${params.id}
      ORDER BY "createdAt" DESC
    `;

    return NextResponse.json({ ...machine, logs });
  } catch (error) {
    console.error("Get machine failed:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const now = new Date();

    const [machine] = await prisma.$queryRaw`
      UPDATE "Machine"
      SET
        "name" = ${body.name},
        "code" = ${body.code || body.name.replace(/\s+/g, '-').toLowerCase() + '-' + params.id.slice(0, 6)},
        "description" = ${body.description || null},
        "updatedAt" = ${now}
      WHERE "id" = ${params.id}
      RETURNING "id", "name", "code", "description", "createdAt", "updatedAt"
    `;

    if (!machine) {
      return NextResponse.json({ message: "ไม่พบเครื่องจักรที่ต้องการแก้ไข" }, { status: 404 });
    }
    return NextResponse.json(machine);
  } catch (error) {
    console.error("Update machine failed:", error);
    if (error?.code === "P2002" || error?.meta?.code === "23505") {
      return NextResponse.json({ message: "รหัสเครื่องนี้มีอยู่ในระบบแล้ว" }, { status: 409 });
    }
    return NextResponse.json({ message: "แก้ไขเครื่องจักรไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.machineLog.deleteMany({ where: { machineId: params.id } });
    await prisma.machine.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete machine failed:", error);
    return NextResponse.json({ message: "ลบเครื่องจักรไม่สำเร็จ" }, { status: 500 });
  }
}