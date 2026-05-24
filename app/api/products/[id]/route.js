import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export async function GET(request, { params }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { warehouse: true, materials: { include: { material: true } } },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(request, { params }) {
  const body = await request.json();
  
  // Generate QR code if SKU has changed
  let qrCode = body.qrCode;
  if (body.sku && (!body.qrCode || body.qrCode === body.sku)) {
    try {
      qrCode = await QRCode.toDataURL(body.sku, { width: 200 });
    } catch (err) {
      console.error("QR Code generation error:", err);
      qrCode = body.sku;
    }
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      name: body.name,
      sku: body.sku,
      type: body.type,
      price: Number(body.price) || 0,
      stock: Number(body.stock) || 0,
      description: body.description || "",
      details: body.details || "",
      image: body.image !== undefined ? body.image : undefined,
      qrCode: qrCode || body.sku || "",
      warehouseId: body.warehouseId || null,
    },
    include: { warehouse: true, materials: { include: { material: true } } },
  });

  // Update materials if composite product
  if (body.type === "COMPOSITE" && body.materials) {
    // Delete existing materials
    await prisma.productMaterial.deleteMany({
      where: { productId: params.id },
    });

    // Add new materials
    if (body.materials.length > 0) {
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
  } else {
    // If not composite, delete all materials
    await prisma.productMaterial.deleteMany({
      where: { productId: params.id },
    });
  }

  // Fetch updated product
  const updatedProduct = await prisma.product.findUnique({
    where: { id: params.id },
    include: { warehouse: true, materials: { include: { material: true } } },
  });

  return NextResponse.json(updatedProduct);
}

export async function DELETE(request, { params }) {
  // Delete materials first
  await prisma.productMaterial.deleteMany({
    where: { productId: params.id },
  });
  
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
