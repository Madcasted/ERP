import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readSessionValue, SESSION_COOKIE } from "@/lib/auth";

async function currentUser(request: NextRequest) {
  const session = readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, role: true, image: true } });
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ user });
}

export async function PUT(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.name?.trim() || !body.email?.trim()) return NextResponse.json({ error: "กรุณากรอกชื่อและอีเมล" }, { status: 400 });
  if (body.password && body.password.length < 6) return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        image: body.image || null,
        ...(body.password ? { password: await hash(body.password, 10) } : {}),
      },
      select: { id: true, name: true, email: true, role: true, image: true },
    });
    return NextResponse.json({ user: updated });
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้งานแล้ว" }, { status: 409 });
    return NextResponse.json({ error: "ไม่สามารถแก้ไขข้อมูลได้" }, { status: 500 });
  }
}