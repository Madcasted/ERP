import { prisma } from "@/lib/prisma";
import DashboardShell from "./components/DashboardShell";

function receiptCost(receipt: { unitPrice: number | null; rolls: { weightKg: number }[] }) {
  const weight = receipt.rolls.reduce((sum, r) => sum + (r.weightKg || 0), 0);
  return weight * (receipt.unitPrice || 0);
}

async function getDashboardData() {
  const [
    productCount,
    lowStockCount,
    customerCount,
    materialCount,
    machineCount,
    recentProducts,
    recentReceipts,
    lowStockProducts,
    recentMachines,
    allReceiptsForCost,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { stock: { lte: 5 } } }),
    prisma.customer.count(),
    prisma.material.count(),
    prisma.machine.count(),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.materialReceipt.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { material: true, rolls: { select: { lotNo: true } } },
    }),
    prisma.product.findMany({ where: { stock: { lte: 5 } }, orderBy: { stock: "asc" }, take: 5, include: { warehouse: true } }),
    prisma.machine.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.materialReceipt.findMany({ include: { rolls: { select: { weightKg: true } } } }),
  ]);

  const totalMaterialCost = allReceiptsForCost.reduce((sum, r) => sum + receiptCost(r), 0);

  const totals = {
    products: productCount,
    lowStock: lowStockCount,
    customers: customerCount,
    materials: materialCount,
    machines: machineCount,
    totalMaterialCost: Math.round(totalMaterialCost),
  };

  // แนบ lotNumber (จากม้วนแรกของใบรับ) ให้ตรงกับที่ DashboardShell ใช้แสดงผล
  const recentMaterials = recentReceipts.map((r) => ({
    id: r.id,
    materialName: r.materialName,
    material: r.material,
    supplier: r.supplier,
    invoiceNo: r.invoiceNo,
    lotNumber: r.rolls[0]?.lotNo ?? "-",
    createdAt: r.createdAt,
  }));

  return {
    products: recentProducts,
    totals,
    recentMaterials,
    lowStockProducts,
    recentMachines,
  };
}

export default async function HomePage() {
  const { products, totals, recentMaterials, lowStockProducts, recentMachines } = await getDashboardData();

  return (
    <DashboardShell
      products={products}
      totals={totals}
      recentMaterials={recentMaterials}
      lowStockProducts={lowStockProducts}
      recentMachines={recentMachines}
    />
  );
}