import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { hash } from "bcryptjs";

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
    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ message: "กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    }
    const id = randomUUID();
    const now = new Date();
    const [customer] = await prisma.$transaction(async (tx) => {
      const created = await tx.$queryRaw`
        INSERT INTO "Customer" ("id", "name", "email", "role", "phone", "address", "image", "createdAt", "updatedAt")
        VALUES (${id}, ${body.name}, ${body.email.trim()}, ${body.role || "EMPLOYEE"}, ${body.phone || null}, ${body.address || null}, ${body.image || null}, ${now}, ${now})
        RETURNING "id", "name", "email", "role", "phone", "address", "image", "createdAt", "updatedAt"
      `;
      await tx.user.create({
        data: {
          name: body.name,
          email: body.email.trim().toLowerCase(),
          password: await hash(body.password, 10),
          role: ["ADMIN", "MANAGER"].includes(body.role) ? body.role : "EMPLOYEE",
          image: body.image || null,
        },
      });
      return created;
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Create customer failed:", error);
    if (error?.code === "P2002" || error?.meta?.code === "23505") {
      return NextResponse.json({ message: "อีเมลนี้มีอยู่ในระบบแล้ว" }, { status: 409 });
    }
    return NextResponse.json({ message: "เพิ่มสมาชิกไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
