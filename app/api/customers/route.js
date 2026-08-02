import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  const customers = await prisma.$queryRaw`
    SELECT "id", "name", "email", "role", "phone", "address", "image", "createdAt", "updatedAt"
    FROM "Customer"
    ORDER BY "updatedAt" DESC
  `;
  return NextResponse.json(customers);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();
    const [customer] = await prisma.$queryRaw`
      INSERT INTO "Customer" ("id", "name", "email", "role", "phone", "address", "image", "createdAt", "updatedAt")
      VALUES (
        ${id},
        ${body.name},
        ${body.email},
        ${body.role || "EMPLOYEE"},
        ${body.phone || null},
        ${body.address || null},
        ${body.image || null},
        ${now},
        ${now}
      )
      RETURNING "id", "name", "email", "role", "phone", "address", "image", "createdAt", "updatedAt"
    `;
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Create customer failed:", error);
    if (error?.code === "P2002" || error?.meta?.code === "23505") {
      return NextResponse.json({ message: "อีเมลนี้มีอยู่ในระบบแล้ว" }, { status: 409 });
    }
    return NextResponse.json({ message: "เพิ่มสมาชิกไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
