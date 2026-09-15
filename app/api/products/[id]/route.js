import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export async function GET(request, { params }) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { warehouse: true, materials: { include: { material: true } } },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const body = await request.json();

    let qrCode = body.qrCode;
    if (body.sku && (!body.qrCode || body.qrCode === body.sku)) {
      try {
        qrCode = await QRCode.toDataURL(body.sku, { width: 200 });
      } catch {
        qrCode = body.sku;
      }
    }

    const updateData = {
      name: body.name,
      sku: body.sku,
      type: body.type,
      price: Number(body.price) || 0,
      stock: Number(body.stock) || 0,
      description: body.description || "",
      details: body.details || "",
      image: body.image !== undefined ? body.image : undefined,
      qrCode: qrCode || body.sku || "",
      qrColor: body.qrColor || "#000000",
      labelCompany: body.labelCompany || "T SIAMPACK CO., LTD.",
      labelSize: body.labelSize || "",
      labelLot: body.labelLot || "",
      labelDate: body.labelDate || "",
      labelQty: body.labelQty !== undefined ? Number(body.labelQty) || 0 : Number(body.stock) || 0,
      labelPcs: body.labelPcs || "PCS.",
      labelInspector: body.labelInspector || "",
      labelQc1: body.labelQc1 || "",
      labelQc1Mode: body.labelQc1Mode || "text",
      labelQc2: body.labelQc2 || "",
      labelQc2Mode: body.labelQc2Mode || "text",
      labelWarning: body.labelWarning || "",
      labelLots: Array.isArray(body.labelLots) ? body.labelLots : [],
      printCount: Number(body.printCount) || 1,
      warehouseId: body.warehouseId || null,
    };

    // Only update QC images if they're actually provided (not null/undefined from the frontend)
    // This preserves existing images when they're not being changed
    if (body.labelQc1Image !== undefined) {
      updateData.labelQc1Image = body.labelQc1Image;
    }
    if (body.labelQc2Image !== undefined) {
      updateData.labelQc2Image = body.labelQc2Image;
    }

    await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    });

    // Sync materials
    await prisma.productMaterial.deleteMany({ where: { productId: params.id } });

    if (body.type === "COMPOSITE" && body.materials?.length > 0) {
      for (const mat of body.materials) {
        await prisma.productMaterial.create({
          data: {
            productId: params.id,
            materialId: mat.materialId,
            quantity: mat.quantity,
            unitPrice: mat.unitPrice,
          },
        });
      }
    }

    const updatedProduct = await prisma.product.findUnique({
      where: { id: params.id },
      include: { warehouse: true, materials: { include: { material: true } } },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("PUT /api/products/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await prisma.productMaterial.deleteMany({ where: { productId: params.id } });
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
