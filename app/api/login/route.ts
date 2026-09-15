import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { createSessionValue, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { message: "ไม่พบผู้ใช้" },
        { status: 401 }
      );
    }

    const validPassword = await compare(password, user.password);

    if (!validPassword) {
      return NextResponse.json(
        { message: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
      },
    });
    response.cookies.set(SESSION_COOKIE, createSessionValue(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { message: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}