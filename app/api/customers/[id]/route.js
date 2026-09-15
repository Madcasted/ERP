import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const existing = await prisma.customer.findUnique({ where: { id: params.id }, select: { email: true } });
    if (!existing) return NextResponse.json({ message: "ไม่พบสมาชิกที่ต้องการแก้ไข" }, { status: 404 });
    const [customer] = await prisma.$queryRaw`
      UPDATE "Customer"
      SET
        "name" = ${body.name},
        "email" = ${body.email},
        "role" = ${body.role || "EMPLOYEE"},
        "phone" = ${body.phone || null},
        "address" = ${body.address || null},
        "image" = ${body.image || null},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${params.id}
      RETURNING "id", "name", "email", "role", "phone", "address", "image", "createdAt", "updatedAt"
    `;
    const user = await prisma.user.findFirst({ where: { email: { equals: existing.email, mode: "insensitive" } } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { name: body.name, email: body.email.trim().toLowerCase(), image: body.image || null, role: ["ADMIN", "MANAGER"].includes(body.role) ? body.role : "EMPLOYEE", ...(body.password ? { password: await hash(body.password, 10) } : {}) } });
    } else if (body.password) {
      if (body.password.length < 6) return NextResponse.json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
      await prisma.user.create({ data: { name: body.name, email: body.email.trim().toLowerCase(), password: await hash(body.password, 10), role: ["ADMIN", "MANAGER"].includes(body.role) ? body.role : "EMPLOYEE", image: body.image || null } });
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error("Update customer failed:", error);
    if (error?.code === "P2002" || error?.meta?.code === "23505") {
      return NextResponse.json({ message: "อีเมลนี้มีอยู่ในระบบแล้ว" }, { status: 409 });
    }
    return NextResponse.json({ message: "แก้ไขสมาชิกไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  await prisma.customer.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
