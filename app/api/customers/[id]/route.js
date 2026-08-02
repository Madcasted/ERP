import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
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
    if (!customer) {
      return NextResponse.json({ message: "ไม่พบสมาชิกที่ต้องการแก้ไข" }, { status: 404 });
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
