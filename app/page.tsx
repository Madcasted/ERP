import { prisma } from "@/lib/prisma";
import DashboardShell from "./components/DashboardShell";

async function getDashboardData() {
  const [products, orders] = await Promise.all([
    prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.order.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { customer: true, items: { include: { product: true } } } }),
  ]);

  const totals = {
    products: await prisma.product.count(),
    lowStock: await prisma.product.count({ where: { stock: { lte: 5 } } }),
    pendingOrders: await prisma.order.count({ where: { status: "PENDING" } }),
  };

  return { products, orders, totals };
}

export default async function HomePage() {
  const { products, orders, totals } = await getDashboardData();

  return <DashboardShell products={products} orders={orders} totals={totals} />;
}
