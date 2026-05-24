import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

function intervalToTrunc(unit) {
  switch (unit) {
    case "daily":
      return "day";
    case "weekly":
      return "week";
    case "monthly":
      return "month";
    case "quarterly":
      return "quarter";
    case "yearly":
      return "year";
    default:
      return "day";
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const report = url.searchParams.get("report");
  const interval = url.searchParams.get("interval") || "daily";

  if (report === "created") {
    const trunc = intervalToTrunc(interval);

    let range = "30 days";
    if (trunc === "week") range = "84 days";
    if (trunc === "month") range = "365 days";
    if (trunc === "quarter") range = "1460 days";
    if (trunc === "year") range = "3650 days";

    const rows = await prisma.$queryRaw`
      SELECT date_trunc(${trunc}::text, "createdAt") AS period, count(*)::int
      FROM "Product"
      WHERE "createdAt" >= now() - interval ${range}
      GROUP BY period
      ORDER BY period;
    `;

    return NextResponse.json(rows.map((r) => ({ period: r.period, count: Number(r.count) })));
  }

  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    include: { materials: { include: { material: true } }, warehouse: true },
  });
  return NextResponse.json(products);
}

export async function POST(request) {
  const body = await request.json();

  // Generate QR code from SKU
  let qrCodeImage = null;
  if (body.sku) {
    try {
      qrCodeImage = await QRCode.toDataURL(body.sku, { width: 200 });
    } catch (err) {
      console.error("QR Code generation error:", err);
    }
  }

  const product = await prisma.product.create({
    data: {
      name: body.name,
      sku: body.sku,
      qrCode: qrCodeImage || body.sku || null,
      image: body.image || null,
      type: body.type || "SINGLE",
      price: Number(body.price) || 0,
      stock: Number(body.stock) || 0,
      description: body.description || "",
      details: body.details || "",
      warehouseId: body.warehouseId || null,
    },
    include: { materials: { include: { material: true } } },
  });

  // Add materials if composite product
  if (body.type === "COMPOSITE" && body.materials && body.materials.length > 0) {
    for (const mat of body.materials) {
      await prisma.productMaterial.create({
        data: {
          productId: product.id,
          materialId: mat.materialId,
          quantity: mat.quantity,
          unitPrice: mat.unitPrice,
        },
      });
    }
  }

  // Fetch updated product with materials
  const updatedProduct = await prisma.product.findUnique({
    where: { id: product.id },
    include: { materials: { include: { material: true } }, warehouse: true },
  });

  return NextResponse.json(updatedProduct, { status: 201 });
}
