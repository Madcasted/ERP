import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    console.log("Login Request:", { email, password });

    const user = await prisma.user.findUnique({
      where: { email },
    });

    console.log("User:", user);

    if (!user) {
      return NextResponse.json(
        { message: "ไม่พบผู้ใช้" },
        { status: 401 }
      );
    }

    const validPassword = await compare(password, user.password);

    console.log("Password Match:", validPassword);

    if (!validPassword) {
      return NextResponse.json(
        { message: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { message: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}