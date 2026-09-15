import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

function intervalToTrunc(unit) {
  switch (unit) {
    case "daily":     return "day";
    case "weekly":    return "week";
    case "monthly":   return "month";
    case "quarterly": return "quarter";
    case "yearly":    return "year";
    default:          return "day";
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const report = url.searchParams.get("report");
    const interval = url.searchParams.get("interval") || "daily";

    if (report === "created") {
      const trunc = intervalToTrunc(interval);
      const rangeMap = { day: 30, week: 84, month: 365, quarter: 1460, year: 3650 };
      const days = rangeMap[trunc] ?? 30;

      const rows = await prisma.$queryRaw`
        SELECT date_trunc(${trunc}, "createdAt") AS period, count(*)::int
        FROM "Product"
        WHERE "createdAt" >= now() - (${days}::text || ' days')::interval
        GROUP BY period
        ORDER BY period;
      `;

      return NextResponse.json(
        rows.map((r) => ({ period: r.period, count: Number(r.count) }))
      );
    }

    const products = await prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: { materials: { include: { material: true } }, warehouse: true },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

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
        qrColor: body.qrColor || "#000000",
        image: body.image || null,
        labelCompany: body.labelCompany || "T SIAMPACK CO., LTD.",
        labelSize: body.labelSize || "",
        labelLot: body.labelLot || "",
        labelDate: body.labelDate || "",
        labelQty: body.labelQty !== undefined ? Number(body.labelQty) || 0 : Number(body.stock) || 0,
        labelPcs: body.labelPcs || "PCS.",
        labelInspector: body.labelInspector || "",
        labelQc1: body.labelQc1 || "",
        labelQc1Mode: body.labelQc1Mode || "text",
        labelQc1Image: body.labelQc1Image || null,
        labelQc2: body.labelQc2 || "",
        labelQc2Mode: body.labelQc2Mode || "text",
        labelQc2Image: body.labelQc2Image || null,
        labelWarning: body.labelWarning || "",
        labelLots: Array.isArray(body.labelLots) ? body.labelLots : [],
        printCount: Number(body.printCount) || 1,
        type: body.type || "SINGLE",
        price: Number(body.price) || 0,
        stock: Number(body.stock) || 0,
        description: body.description || "",
        details: body.details || "",
        warehouseId: body.warehouseId || null,
      },
      include: { materials: { include: { material: true } } },
    });

    if (body.type === "COMPOSITE" && body.materials?.length > 0) {
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

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { materials: { include: { material: true } }, warehouse: true },
    });

    return NextResponse.json(updatedProduct, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
