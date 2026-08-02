import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "month"; // month | quarter | year

  const now = new Date();

  // ── สร้างช่วง bucket ──
  // month   -> รายวัน ของเดือนนี้ (วันที่ 1 ถึงวันนี้)
  // quarter -> รายเดือน ของไตรมาสนี้
  // year    -> รายเดือน ของปีนี้ (ม.ค. ถึงเดือนปัจจุบัน)
  const MONTH_LABELS_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  let buckets = [];
  let startDate;

  if (range === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysSoFar = now.getDate();
    for (let day = 1; day <= daysSoFar; day++) {
      buckets.push({
        label: `${day}`,
        start: new Date(now.getFullYear(), now.getMonth(), day),
        end: new Date(now.getFullYear(), now.getMonth(), day + 1),
      });
    }
  } else if (range === "quarter") {
    const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
    startDate = new Date(now.getFullYear(), qStartMonth, 1);
    for (let m = qStartMonth; m <= now.getMonth(); m++) {
      const s = new Date(now.getFullYear(), m, 1);
      const e = new Date(now.getFullYear(), m + 1, 1);
      buckets.push({ label: MONTH_LABELS_TH[m], start: s, end: e });
    }
  } else {
    startDate = new Date(now.getFullYear(), 0, 1);
    for (let m = 0; m <= now.getMonth(); m++) {
      const s = new Date(now.getFullYear(), m, 1);
      const e = new Date(now.getFullYear(), m + 1, 1);
      buckets.push({ label: MONTH_LABELS_TH[m], start: s, end: e });
    }
  }

  function inBucket(date, bucket) {
    const d = new Date(date);
    return d >= bucket.start && d < bucket.end;
  }

  // ── ใบรับวัสดุ (WIP) ในช่วงที่เลือก — ใช้คำนวณค่าใช้จ่ายวัสดุจริง ──
  const receipts = await prisma.materialReceipt.findMany({
    where: { createdAt: { gte: startDate } },
    include: { rolls: { select: { weightKg: true } } },
  });

  function receiptCost(receipt) {
    const weight = receipt.rolls.reduce((sum, r) => sum + (r.weightKg || 0), 0);
    return weight * (receipt.unitPrice || 0);
  }

  const materialCostByMonth = buckets.map((b) => ({
    label: b.label,
    value: Math.round(
      receipts.filter((r) => inBucket(r.createdAt, b)).reduce((sum, r) => sum + receiptCost(r), 0)
    ),
  }));

  // ── สินค้า / ลูกค้า / จำนวนใบรับวัสดุ ที่เพิ่มขึ้นในช่วงเวลา (growth) ──
  const products = await prisma.product.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true },
  });
  const customers = await prisma.customer.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true },
  });

  const productsByMonth = buckets.map((b) => ({
    label: b.label,
    value: products.filter((p) => inBucket(p.createdAt, b)).length,
  }));
  const customersByMonth = buckets.map((b) => ({
    label: b.label,
    value: customers.filter((c) => inBucket(c.createdAt, b)).length,
  }));
  const materialsByMonth = buckets.map((b) => ({
    label: b.label,
    value: receipts.filter((r) => inBucket(r.createdAt, b)).length,
  }));

  // ── คุณภาพการผลิตจากเครื่องจักร ในช่วงเวลาเดียวกัน ──
  const machineLogs = await prisma.machineLog.findMany({
    where: { createdAt: { gte: startDate } },
    select: { goodPcs: true, defectPcs: true },
  });
  const totalGoodPcs = machineLogs.reduce((s, l) => s + (l.goodPcs || 0), 0);
  const totalDefectPcs = machineLogs.reduce((s, l) => s + (l.defectPcs || 0), 0);

  // ── ยอดรวมทั้งระบบ (ไม่จำกัดช่วงเวลา) สำหรับ KPI สรุป ──
  const [totalProductsAll, totalCustomersAll, totalMachinesAll, allReceipts] = await Promise.all([
    prisma.product.count(),
    prisma.customer.count(),
    prisma.machine.count(),
    prisma.materialReceipt.findMany({ include: { rolls: { select: { weightKg: true } } } }),
  ]);
  const totalMaterialCostAll = allReceipts.reduce((s, r) => s + receiptCost(r), 0);

  const summary = {
    periodMaterialCost: materialCostByMonth.reduce((s, b) => s + b.value, 0),
    totalMaterialCostAll: Math.round(totalMaterialCostAll),
    totalProducts: totalProductsAll,
    totalCustomers: totalCustomersAll,
    totalMachines: totalMachinesAll,
    totalMaterialReceipts: allReceipts.length,
    totalGoodPcs,
    totalDefectPcs,
  };

  return NextResponse.json({
    range,
    materialCostByMonth,
    productsByMonth,
    customersByMonth,
    materialsByMonth,
    summary,
    period: { start: startDate.toISOString(), end: now.toISOString(), points: buckets.length },
  });
}