import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "month"; // month | quarter | year

  const now = new Date();
  let startDate;

  if (range === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "quarter") {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    startDate = new Date(now.getFullYear(), qStart, 1);
  } else {
    startDate = new Date(now.getFullYear(), 0, 1);
  }

  // ---- Revenue by period (monthly buckets within the range) ----
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate },
      status: "DELIVERED",
    },
    select: { createdAt: true, total: true },
  });

  // Products created in period
  const products = await prisma.product.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true },
  });

  // Customers created in period
  const customers = await prisma.customer.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true },
  });

  // Materials received in period
  const materialReceivings = await prisma.materialReceiving.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true, quantity: true },
  });

  // Machine logs in period
  const machineLogs = await prisma.machineLog.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true, goodPcs: true, defectPcs: true },
  });

  // Orders by status in period
  const allOrdersInPeriod = await prisma.order.findMany({
    where: { createdAt: { gte: startDate } },
    select: { status: true, total: true, createdAt: true },
  });

  // ---- Bucket helpers ----
  const periodMonths = [];
  let cursor = new Date(startDate);
  while (cursor <= now) {
    periodMonths.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      label: `${cursor.getMonth() + 1}/${cursor.getFullYear().toString().slice(-2)}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  function inBucket(date, bucket) {
    const d = new Date(date);
    return d.getFullYear() === bucket.year && d.getMonth() === bucket.month;
  }

  const revenueByMonth = periodMonths.map((b) => ({
    label: b.label,
    value: orders
      .filter((o) => inBucket(o.createdAt, b))
      .reduce((sum, o) => sum + (o.total || 0), 0),
  }));

  const productsByMonth = periodMonths.map((b) => ({
    label: b.label,
    value: products.filter((p) => inBucket(p.createdAt, b)).length,
  }));

  const customersByMonth = periodMonths.map((b) => ({
    label: b.label,
    value: customers.filter((c) => inBucket(c.createdAt, b)).length,
  }));

  const materialsByMonth = periodMonths.map((b) => ({
    label: b.label,
    value: materialReceivings.filter((m) => inBucket(m.createdAt, b)).length,
  }));

  // Order status breakdown this period
  const orderStatusCounts = {
    PENDING: allOrdersInPeriod.filter((o) => o.status === "PENDING").length,
    CONFIRMED: allOrdersInPeriod.filter((o) => o.status === "CONFIRMED").length,
    DELIVERED: allOrdersInPeriod.filter((o) => o.status === "DELIVERED").length,
    CANCELLED: allOrdersInPeriod.filter((o) => o.status === "CANCELLED").length,
  };

  const orderStatusRevenue = {
    PENDING: allOrdersInPeriod
      .filter((o) => o.status === "PENDING")
      .reduce((s, o) => s + (o.total || 0), 0),
    CONFIRMED: allOrdersInPeriod
      .filter((o) => o.status === "CONFIRMED")
      .reduce((s, o) => s + (o.total || 0), 0),
    DELIVERED: allOrdersInPeriod
      .filter((o) => o.status === "DELIVERED")
      .reduce((s, o) => s + (o.total || 0), 0),
    CANCELLED: allOrdersInPeriod
      .filter((o) => o.status === "CANCELLED")
      .reduce((s, o) => s + (o.total || 0), 0),
  };

  // Production stats from machine logs
  const totalGoodPcs = machineLogs.reduce((s, l) => s + (l.goodPcs || 0), 0);
  const totalDefectPcs = machineLogs.reduce((s, l) => s + (l.defectPcs || 0), 0);

  // Summary for numbers view
  const summary = {
    totalRevenue: orders.reduce((s, o) => s + (o.total || 0), 0),
    totalProducts: products.length,
    totalCustomers: customers.length,
    totalMaterials: materialReceivings.length,
    totalOrders: allOrdersInPeriod.length,
    pendingOrders: orderStatusCounts.PENDING,
    confirmedOrders: orderStatusCounts.CONFIRMED,
    deliveredOrders: orderStatusCounts.DELIVERED,
    cancelledOrders: orderStatusCounts.CANCELLED,
    totalGoodPcs,
    totalDefectPcs,
  };

  return NextResponse.json({
    range,
    revenueByMonth,
    productsByMonth,
    customersByMonth,
    materialsByMonth,
    orderStatusCounts,
    orderStatusRevenue,
    summary,
    period: {
      start: startDate.toISOString(),
      end: now.toISOString(),
      months: periodMonths.length,
    },
  });
}