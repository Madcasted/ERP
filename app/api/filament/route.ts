import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSessionValue, SESSION_COOKIE } from "@/lib/auth";

async function getCurrentUser(request: NextRequest) {
  const session = readSessionValue(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true },
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const spools = await prisma.filamentSpool.findMany({
    include: { usages: { orderBy: { usedAt: "desc" } } },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ spools, currentUser: user });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" ? body.color.trim() : "";
  const supplier = typeof body.supplier === "string" ? body.supplier.trim() : "";
  const initialWeightGrams = Number(body.initialWeightGrams);
  const purchaseDate = body.purchaseDate ? new Date(`${body.purchaseDate}T12:00:00`) : new Date();

  if (!name || !color || !supplier || !Number.isFinite(initialWeightGrams) || initialWeightGrams <= 0) {
    return NextResponse.json({ error: "กรุณากรอกชนิด สี ร้านที่ซื้อ และน้ำหนักม้วนให้ถูกต้อง" }, { status: 400 });
  }
  if (Number.isNaN(purchaseDate.getTime())) {
    return NextResponse.json({ error: "วันที่ซื้อไม่ถูกต้อง" }, { status: 400 });
  }

  const spool = await prisma.filamentSpool.create({
    data: {
      name,
      brand: typeof body.brand === "string" ? body.brand.trim() || null : null,
      color,
      supplier,
      initialWeightGrams,
      remainingWeightGrams: initialWeightGrams,
      purchaseDate,
    },
  });
  return NextResponse.json(spool, { status: 201 });
}
