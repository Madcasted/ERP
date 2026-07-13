import { prisma } from "@/lib/prisma";
import DashboardShell from "./components/DashboardShell";

async function getDashboardData() {
  const [productCount, lowStockCount, customerCount, materialCount, machineCount, orderCount, pendingOrders, confirmedOrders, deliveredOrders, revenue, recentProducts, recentOrders, recentMaterials, lowStockProducts, recentMachines] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { stock: { lte: 5 } } }),
    prisma.customer.count(),
    prisma.material.count(),
    prisma.machine.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "CONFIRMED" } }),
    prisma.order.count({ where: { status: "DELIVERED" } }),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.order.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { customer: true, items: { include: { product: true } } } }),
    prisma.materialReceiving.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { material: true } }),
    prisma.product.findMany({ where: { stock: { lte: 5 } }, orderBy: { stock: "asc" }, take: 5, include: { warehouse: true } }),
    prisma.machine.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  const totals = {
    products: productCount,
    lowStock: lowStockCount,
    pendingOrders,
    confirmedOrders,
    deliveredOrders,
    customers: customerCount,
    materials: materialCount,
    machines: machineCount,
    orders: orderCount,
    totalRevenue: revenue._sum.total ?? 0,
  };

  return {
    products: recentProducts,
    orders: recentOrders,
    totals,
    recentMaterials,
    lowStockProducts,
    recentMachines,
  };
}

export default async function HomePage() {
  const { products, orders, totals, recentMaterials, lowStockProducts, recentMachines } = await getDashboardData();

  return (
    <DashboardShell
      products={products}
      orders={orders}
      totals={totals}
      recentMaterials={recentMaterials}
      lowStockProducts={lowStockProducts}
      recentMachines={recentMachines}
    />
  );
}
