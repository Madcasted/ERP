import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function GET() {
  const users = await prisma.user.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, email: true, role: true, image: true, createdAt: true, updatedAt: true } });
  return NextResponse.json(users);
}

export async function POST(request) {
  const body = await request.json();
  if (!body.name?.trim() || !body.email?.trim() || !body.password || body.password.length < 6) {
    return NextResponse.json({ error: "กรุณากรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }
  try {
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        password: await hash(body.password, 10),
        role: body.role || "EMPLOYEE",
        image: body.image || null,
      },
      select: { id: true, name: true, email: true, role: true, image: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" }, { status: 409 });
    return NextResponse.json({ error: "ไม่สามารถเพิ่มผู้ใช้งานได้" }, { status: 500 });
  }
}
