import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const machines = await prisma.$queryRaw`
      SELECT "id", "name", "code", "description", "createdAt", "updatedAt"
      FROM "Machine"
      ORDER BY "name" ASC
    `;
    return NextResponse.json(machines);
  } catch (error) {
    console.error("Get machines failed:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();

    const [machine] = await prisma.$queryRaw`
      INSERT INTO "Machine" ("id", "name", "code", "description", "createdAt", "updatedAt")
      VALUES (
        ${id},
        ${body.name},
        ${body.code || body.name.replace(/\s+/g, '-').toLowerCase() + '-' + id.slice(0, 6)},
        ${body.description || null},
        ${now},
        ${now}
      )
      RETURNING "id", "name", "code", "description", "createdAt", "updatedAt"
    `;

    return NextResponse.json(machine, { status: 201 });
  } catch (error) {
    console.error("Create machine failed:", error);
    if (error?.code === "P2002" || error?.meta?.code === "23505") {
      return NextResponse.json({ message: "รหัสเครื่องนี้มีอยู่ในระบบแล้ว" }, { status: 409 });
    }
    return NextResponse.json({ message: "เพิ่มเครื่องจักรไม่สำเร็จ" }, { status: 500 });
  }
}