"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  date: string | null;
  doNumber: string;
  invoice: string;
  company: string;
  received: number;
  issued: number;
  balance: number | null;
  signedBy: string;
  isOpening: boolean;
}

interface Product {
  code: string;
  name: string;
  type: string;
  packSize: string;
  unit: string;
  createdDate: string | null;
  openingBalance: number;
  transactions: Transaction[];
}

type PeriodType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
type CategoryFilter = "ทั้งหมด" | "สินค้า" | "วัสดุ" | "คลัง";

interface ReportRow {
  seq: number;
  productCode: string;
  productName: string;
  productType: string;
  unit: string;
  packSize: string;
  openingBalance: number;
  totalReceived: number;
  totalIssued: number;
  closingBalance: number;
}

interface ReportData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  rows: ReportRow[];
  generatedAt: string;
}

interface Props {
  products?: Product[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const THAI_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const CATEGORY_FILTERS: CategoryFilter[] = ["ทั้งหมด", "สินค้า", "วัสดุ", "คลัง"];

const CATEGORY_META: Record<CategoryFilter, { icon: string; color: string; activeColor: string; activeBg: string }> = {
  ทั้งหมด: { icon: "⊞", color: "#64748b", activeColor: "#ffffff", activeBg: "#2c3e6b" },
  สินค้า:  { icon: "📦", color: "#64748b", activeColor: "#ffffff", activeBg: "#2563eb" },
  วัสดุ:   { icon: "🔧", color: "#64748b", activeColor: "#ffffff", activeBg: "#d97706" },
  คลัง:    { icon: "🏭", color: "#64748b", activeColor: "#ffffff", activeBg: "#16a34a" },
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function buddhaYear(y: number): number {
  return y + 543;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function formatDisplayDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${buddhaYear(d.getFullYear())}`;
}

function formatThai(d: Date): string {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${buddhaYear(d.getFullYear())}`;
}

// ─── Number Format ────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n === 0) return "0.00";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtOpening(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ─── Period Helpers ───────────────────────────────────────────────────────────

function getPeriodRange(type: PeriodType, ref: Date): { start: Date; end: Date } {
  const t = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  if (type === "daily") {
    return { start: new Date(t), end: new Date(t) };
  }
  if (type === "weekly") {
    const day = t.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(t.getFullYear(), t.getMonth(), t.getDate() + diff);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start, end };
  }
  if (type === "monthly") {
    return {
      start: new Date(t.getFullYear(), t.getMonth(), 1),
      end: new Date(t.getFullYear(), t.getMonth() + 1, 0),
    };
  }
  if (type === "quarterly") {
    const q = Math.floor(t.getMonth() / 3);
    return {
      start: new Date(t.getFullYear(), q * 3, 1),
      end: new Date(t.getFullYear(), q * 3 + 3, 0),
    };
  }
  return {
    start: new Date(t.getFullYear(), 0, 1),
    end: new Date(t.getFullYear(), 11, 31),
  };
}

function getThaiPeriodLabel(type: PeriodType, start: Date, end: Date): string {
  const by = buddhaYear(start.getFullYear());
  switch (type) {
    case "daily":
      return `วันที่ ${formatThai(start)}`;
    case "weekly":
      if (start.getMonth() === end.getMonth()) {
        return `สัปดาห์ที่ ${start.getDate()}–${end.getDate()} ${THAI_MONTHS[start.getMonth()]} ${by}`;
      }
      return `${formatThai(start)} – ${formatThai(end)}`;
    case "monthly":
      return `เดือน ${THAI_MONTHS[start.getMonth()]} ${by}`;
    case "quarterly": {
      const q = Math.floor(start.getMonth() / 3) + 1;
      return `ไตรมาส ${q} ปี ${by} (${THAI_MONTHS[start.getMonth()]}–${THAI_MONTHS[end.getMonth()]})`;
    }
    case "yearly":
      return `ประจำปี ${by}`;
  }
}

// ─── Read Excel Stock Sheet ───────────────────────────────────────────────────

function parseTransactionDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) return toDateStr(val);
  if (typeof val === "number" && val > 1) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : toDateStr(d);
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m1) {
      let d = parseInt(m1[1]),
        mo = parseInt(m1[2]),
        y = parseInt(m1[3]);
      if (mo > 12 && d <= 12) [d, mo] = [mo, d];
      if (y < 100) y += 2000;
      if (y > 2500) y -= 543;
      const dt = new Date(y, mo - 1, d);
      if (!isNaN(dt.getTime())) return toDateStr(dt);
    }
    const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      let y = parseInt(m2[1]),
        mo = parseInt(m2[2]),
        d = parseInt(m2[3]);
      if (y > 2500) y -= 543;
      const dt = new Date(y, mo - 1, d);
      if (!isNaN(dt.getTime())) return toDateStr(dt);
    }
  }
  return null;
}

function readStockSheet(ws: XLSX.WorkSheet, sheetName: string): Product {
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const result: Product = {
    code: sheetName,
    name: "",
    type: "",
    packSize: "",
    unit: "",
    createdDate: null,
    openingBalance: 0,
    transactions: [],
  };
  if (!data || data.length < 4) return result;

  const row1 = (data[1] as unknown[]) || [];
  const row2 = (data[2] as unknown[]) || [];

  result.name = row1[1] ? String(row1[1]).trim() : sheetName;
  result.packSize = row1[5] ? String(row1[5]).trim() : "-";
  result.type = row2[1] ? String(row2[1]).trim() : "";
  result.unit = row2[5] ? String(row2[5]).trim() : "";

  for (let i = 4; i < data.length; i++) {
    const row = (data[i] as unknown[]) || [];
    if (row.length < 6) continue;

    const dateStr = parseTransactionDate(row[0]);
    const doNumber = row[1] ? String(row[1]).trim() : "";
    const invoice = row[2] ? String(row[2]).trim() : "";
    const company = row[3] ? String(row[3]).trim() : "";
    const received = parseFloat(String(row[4])) || 0;
    const issued = parseFloat(String(row[5])) || 0;
    const balanceRaw = row[6] != null ? parseFloat(String(row[6])) : null;
    const balance = balanceRaw != null && !isNaN(balanceRaw) ? balanceRaw : null;
    const signedBy = row[7] ? String(row[7]).trim() : "";

    const isOpening =
      invoice.includes("ยอดยกมา") ||
      doNumber.includes("ยอดยกมา") ||
      company.includes("ยอดยกมา");

    if (!dateStr && !isOpening) continue;

    result.transactions.push({
      date: dateStr,
      doNumber,
      invoice,
      company,
      received,
      issued,
      balance,
      signedBy,
      isOpening,
    });
  }

  result.transactions.sort((a, b) => {
    if (a.isOpening && !b.isOpening) return -1;
    if (!a.isOpening && b.isOpening) return 1;
    return (a.date || "").localeCompare(b.date || "");
  });

  const openingTx = result.transactions.find((t) => t.isOpening);
  if (openingTx) {
    result.openingBalance = openingTx.balance ?? 0;
  }

  const firstReal = result.transactions.find((t) => !t.isOpening && t.date);
  result.createdDate = firstReal?.date ?? null;

  return result;
}

// ─── Build system product ─────────────────────────────────────────────────────

function buildSystemProduct(
  code: string,
  name: string,
  type: string,
  unit: string,
  stock: number,
  createdDate?: string
): Product {
  const cd = createdDate || toDateStr(new Date());
  return {
    code,
    name,
    type,
    packSize: "-",
    unit,
    createdDate: cd,
    openingBalance: stock,
    transactions: [
      {
        date: cd,
        doNumber: "",
        invoice: "",
        company: "",
        received: stock,
        issued: 0,
        balance: stock,
        signedBy: "",
        isOpening: false,
      },
    ],
  };
}

// ─── Filter products → ReportRow[] ───────────────────────────────────────────

function filterProducts(products: Product[], start: Date, end: Date): ReportRow[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const rows: ReportRow[] = [];

  for (const p of products) {
    let inRange = false;
    if (p.createdDate) {
      const cd = parseDateStr(p.createdDate);
      if (cd && cd.getTime() >= startMs && cd.getTime() <= endMs) inRange = true;
    }
    if (!inRange) {
      for (const tx of p.transactions) {
        if (tx.isOpening || !tx.date) continue;
        const td = parseDateStr(tx.date);
        if (td && td.getTime() >= startMs && td.getTime() <= endMs) {
          inRange = true;
          break;
        }
      }
    }
    if (!inRange) continue;

    let openingBalance = p.openingBalance;
    const txsBefore = p.transactions
      .filter((tx) => {
        if (!tx.date) return false;
        const td = parseDateStr(tx.date);
        return td && td.getTime() < startMs;
      })
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (txsBefore.length > 0) {
      const last = txsBefore[txsBefore.length - 1];
      openingBalance = last.balance ?? openingBalance;
    }

    const txsInRange = p.transactions.filter((tx) => {
      if (!tx.date) return false;
      const td = parseDateStr(tx.date);
      return td && td.getTime() >= startMs && td.getTime() <= endMs;
    });

    const totalReceived = txsInRange.reduce((s, t) => s + t.received, 0);
    const totalIssued = txsInRange.reduce((s, t) => s + t.issued, 0);
    const closingBalance =
      txsInRange.length > 0
        ? (txsInRange[txsInRange.length - 1].balance ?? openingBalance + totalReceived - totalIssued)
        : openingBalance;

    rows.push({
      seq: rows.length + 1,
      productCode: p.code,
      productName: p.name,
      productType: p.type,
      unit: p.unit,
      packSize: p.packSize || "-",
      openingBalance,
      totalReceived,
      totalIssued,
      closingBalance,
    });
  }

  return rows;
}

// ─── Apply category filter to rows ───────────────────────────────────────────

function applyCategoryFilter(rows: ReportRow[], category: CategoryFilter): ReportRow[] {
  if (category === "ทั้งหมด") return rows;
  return rows
    .filter((r) => r.productType === category)
    .map((r, i) => ({ ...r, seq: i + 1 }));
}

// ─── Export to Excel ──────────────────────────────────────────────────────────

function exportToExcel(
  rows: ReportRow[],
  periodLabel: string,
  startDate: string,
  endDate: string,
  category: CategoryFilter
) {
  const wb = XLSX.utils.book_new();
  const headers = [
    "ลำดับ", "รหัสสินค้า", "ชื่อสินค้า", "ชนิด", "หน่วย", "บรรจุ",
    "ยอดยกมา", "รับ", "จ่าย", "คงเหลือ",
  ];
  const categoryLabel = category === "ทั้งหมด" ? "" : ` (${category})`;
  const dataRows = rows.map((r) => [
    r.seq,
    r.productCode,
    r.productName,
    r.productType,
    r.unit,
    r.packSize,
    r.openingBalance === 0 ? "-" : r.openingBalance,
    r.totalReceived,
    r.totalIssued,
    r.closingBalance,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    [`รายงานสรุปสต็อก${categoryLabel} ${periodLabel}`],
    [`ข้อมูลจากระบบ | วันที่ ${startDate} ถึง ${endDate}`],
    [],
    headers,
    ...dataRows,
    [],
    [`จำนวน ${rows.length} รายการ`],
  ]);
  ws["!cols"] = [
    { wch: 6 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "รายงานสต็อก");
  XLSX.writeFile(wb, `stock_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  CATEGORY FILTER BAR COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface CategoryFilterBarProps {
  active: CategoryFilter;
  onChange: (c: CategoryFilter) => void;
  counts: Record<CategoryFilter, number>;
}

function CategoryFilterBar({ active, onChange, counts }: CategoryFilterBarProps) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", letterSpacing: "0.04em", textTransform: "uppercase", marginRight: 4 }}>
        ประเภท:
      </span>
      {CATEGORY_FILTERS.map((cat) => {
        const meta = CATEGORY_META[cat];
        const isActive = active === cat;
        const count = counts[cat];
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 20,
              border: isActive ? "none" : "1.5px solid #e2e8f0",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              fontFamily: "inherit",
              background: isActive ? meta.activeBg : "white",
              color: isActive ? meta.activeColor : meta.color,
              boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 14 }}>{meta.icon}</span>
            <span>{cat}</span>
            {count > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 20,
                  height: 18,
                  borderRadius: 9,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "0 5px",
                  background: isActive ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                  color: isActive ? "white" : "#475569",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function StockReportSystem(props: Props) {
  const products = props.products || [];

  const [activeTab, setActiveTab] = useState<"system" | "excel">("system");

  // System data
  const [sysProducts, setSysProducts] = useState<Product[]>([]);
  const [sysLoading, setSysLoading] = useState(false);

  // Excel data
  const [excelProducts, setExcelProducts] = useState<Product[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);

  // Report state
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [reportDate, setReportDate] = useState(toDateStr(new Date()));
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ทั้งหมด");

  // Messages
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function showMsg(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  }
  function showErr(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }

  // ── Compute counts per category from reportData ──
  function computeCounts(rows: ReportRow[]): Record<CategoryFilter, number> {
    const counts: Record<CategoryFilter, number> = {
      ทั้งหมด: rows.length,
      สินค้า: 0,
      วัสดุ: 0,
      คลัง: 0,
    };
    rows.forEach((r) => {
      if (r.productType === "สินค้า") counts["สินค้า"]++;
      else if (r.productType === "วัสดุ") counts["วัสดุ"]++;
      else if (r.productType === "คลัง") counts["คลัง"]++;
    });
    return counts;
  }

  // ── Filtered rows for display ──
  const displayRows = reportData
    ? applyCategoryFilter(reportData.rows, categoryFilter)
    : [];

  const categoryCounts = reportData ? computeCounts(reportData.rows) : {
    ทั้งหมด: 0, สินค้า: 0, วัสดุ: 0, คลัง: 0,
  };

  // ── Build report ──
  function buildReport(source: Product[]) {
    const ref = parseDateStr(reportDate) ?? new Date();
    const { start, end } = getPeriodRange(periodType, ref);
    const rows = filterProducts(source, start, end);
    const periodLabel = getThaiPeriodLabel(periodType, start, end);
    const now = new Date();
    const generatedAt = `${now.getDate()}/${now.getMonth() + 1}/${buddhaYear(now.getFullYear())}`;

    setCategoryFilter("ทั้งหมด"); // reset filter on new report
    setReportData({
      periodLabel,
      startDate: formatDisplayDate(start),
      endDate: formatDisplayDate(end),
      rows,
      generatedAt,
    });
  }

  // ── System tab ──
  async function loadSystemData() {
    setSysLoading(true);
    try {
      const [pRes, mRes, wRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/materials"),
        fetch("/api/warehouses"),
      ]);
      const pData = await pRes.json();
      const mData = await mRes.json();
      const wData = await wRes.json();

      const list: Product[] = [];
      if (Array.isArray(pData)) {
        pData.forEach((p: any) => {
          const cd = p.createdAt ? toDateStr(new Date(p.createdAt)) : toDateStr(new Date());
          list.push(buildSystemProduct(p.sku || p.id, p.name, "สินค้า", "ชิ้น", p.stock || 0, cd));
        });
      }
      if (Array.isArray(mData)) {
        mData.forEach((m: any) => {
          const cd = m.createdAt ? toDateStr(new Date(m.createdAt)) : toDateStr(new Date());
          list.push(buildSystemProduct(m.id.slice(0, 8), m.name, "วัสดุ", m.unit || "-", 0, cd));
        });
      }
      if (Array.isArray(wData)) {
        wData.forEach((w: any) => {
          const cd = w.createdAt ? toDateStr(new Date(w.createdAt)) : toDateStr(new Date());
          const count = Array.isArray(pData) ? pData.filter((p: any) => p.warehouseId === w.id).length : 0;
          list.push(buildSystemProduct(w.id.slice(0, 8), w.name, "คลัง", "-", count, cd));
        });
      }

      setSysProducts(list);
      showMsg(`โหลดสำเร็จ: ${list.length} รายการ`);
    } catch {
      showErr("ไม่สามารถโหลดข้อมูลจากระบบ");
    } finally {
      setSysLoading(false);
    }
  }

  // ── Excel tab ──
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setExcelFile(f);
      setExcelProducts([]);
      setReportData(null);
    }
  }

  async function handleReadFile() {
    if (!excelFile) { showErr("กรุณาเลือกไฟล์ Excel ก่อน"); return; }
    setExcelLoading(true);
    try {
      const buffer = await excelFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const all: Product[] = [];
      wb.SheetNames.forEach((name) => {
        const p = readStockSheet(wb.Sheets[name], name);
        if (p.transactions.length > 0 || p.name) all.push(p);
      });
      if (all.length === 0) { showErr("ไม่พบข้อมูลสินค้าในไฟล์"); return; }
      setExcelProducts(all);
      showMsg(`อ่านสำเร็จ: ${all.length} สินค้า`);
      const ref = parseDateStr(reportDate) ?? new Date();
      const { start, end } = getPeriodRange(periodType, ref);
      const rows = filterProducts(all, start, end);
      const periodLabel = getThaiPeriodLabel(periodType, start, end);
      const now = new Date();
      setCategoryFilter("ทั้งหมด");
      setReportData({
        periodLabel,
        startDate: formatDisplayDate(start),
        endDate: formatDisplayDate(end),
        rows,
        generatedAt: `${now.getDate()}/${now.getMonth() + 1}/${buddhaYear(now.getFullYear())}`,
      });
    } catch (e: any) {
      showErr(`อ่านไฟล์ไม่สำเร็จ: ${e.message}`);
    } finally {
      setExcelLoading(false);
    }
  }

  function handlePrint() { window.print(); }

  function handleExport() {
    if (!reportData) { showErr("กรุณาสร้างรายงานก่อน"); return; }
    exportToExcel(displayRows, reportData.periodLabel, reportData.startDate, reportData.endDate, categoryFilter);
    showMsg("ดาวน์โหลด Excel สำเร็จ");
  }

  // ── Period selector UI ──
  function renderPeriodControls() {
    const selStyle: React.CSSProperties = {
      padding: "8px 12px", borderRadius: 6,
      border: "1.5px solid #d1d5db", fontSize: 14,
      background: "white", color: "#374151",
    };
    const inpStyle: React.CSSProperties = { ...selStyle };
    const lbl: React.CSSProperties = {
      display: "block", fontWeight: 600, fontSize: 12,
      color: "#6b7280", marginBottom: 4, textTransform: "uppercase",
      letterSpacing: "0.04em",
    };

    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={lbl}>ประเภทรายงาน</label>
          <select value={periodType} onChange={(e) => setPeriodType(e.target.value as PeriodType)} style={selStyle}>
            <option value="daily">รายวัน</option>
            <option value="weekly">รายสัปดาห์</option>
            <option value="monthly">รายเดือน</option>
            <option value="quarterly">รายไตรมาส</option>
            <option value="yearly">รายปี</option>
          </select>
        </div>

        {periodType === "daily" && (
          <div>
            <label style={lbl}>เลือกวันที่</label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={inpStyle} />
          </div>
        )}

        {periodType === "weekly" && (
          <div>
            <label style={lbl}>เลือกวันในสัปดาห์</label>
            <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} style={inpStyle} />
          </div>
        )}

        {periodType === "monthly" && (
          <>
            <div>
              <label style={lbl}>เดือน</label>
              <select
                value={new Date(reportDate).getMonth()}
                onChange={(e) => {
                  const d = new Date(reportDate);
                  d.setMonth(parseInt(e.target.value));
                  setReportDate(toDateStr(d));
                }}
                style={selStyle}
              >
                {THAI_MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>ปี (พ.ศ.)</label>
              <select
                value={new Date(reportDate).getFullYear()}
                onChange={(e) => {
                  const d = new Date(reportDate);
                  d.setFullYear(parseInt(e.target.value));
                  setReportDate(toDateStr(d));
                }}
                style={selStyle}
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const y = new Date().getFullYear() - 5 + i;
                  return <option key={y} value={y}>{buddhaYear(y)}</option>;
                })}
              </select>
            </div>
          </>
        )}

        {periodType === "quarterly" && (
          <>
            <div>
              <label style={lbl}>ไตรมาส</label>
              <select
                value={Math.floor(new Date(reportDate).getMonth() / 3)}
                onChange={(e) => {
                  const d = new Date(reportDate);
                  d.setMonth(parseInt(e.target.value) * 3);
                  setReportDate(toDateStr(d));
                }}
                style={selStyle}
              >
                <option value={0}>Q1 (ม.ค.–มี.ค.)</option>
                <option value={1}>Q2 (เม.ย.–มิ.ย.)</option>
                <option value={2}>Q3 (ก.ค.–ก.ย.)</option>
                <option value={3}>Q4 (ต.ค.–ธ.ค.)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>ปี (พ.ศ.)</label>
              <select
                value={new Date(reportDate).getFullYear()}
                onChange={(e) => {
                  const d = new Date(reportDate);
                  d.setFullYear(parseInt(e.target.value));
                  setReportDate(toDateStr(d));
                }}
                style={selStyle}
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const y = new Date().getFullYear() - 5 + i;
                  return <option key={y} value={y}>{buddhaYear(y)}</option>;
                })}
              </select>
            </div>
          </>
        )}

        {periodType === "yearly" && (
          <div>
            <label style={lbl}>ปี (พ.ศ.)</label>
            <select
              value={new Date(reportDate).getFullYear()}
              onChange={(e) => {
                const d = new Date(reportDate);
                d.setFullYear(parseInt(e.target.value));
                setReportDate(toDateStr(d));
              }}
              style={selStyle}
            >
              {Array.from({ length: 10 }, (_, i) => {
                const y = new Date().getFullYear() - 5 + i;
                return <option key={y} value={y}>{buddhaYear(y)}</option>;
              })}
            </select>
          </div>
        )}
      </div>
    );
  }

  // ── Report preview (printable) ──
  function renderReport() {
    if (!reportData) return null;
    const sourceLabel = activeTab === "system" ? "ข้อมูลจากระบบ" : "ข้อมูลจากไฟล์ Excel Stock Card";
    const categoryLabel = categoryFilter === "ทั้งหมด" ? "" : ` · ${categoryFilter}`;

    return (
      <div className="report-print-area">
        {/* ── Category Filter Bar ── */}
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }} className="no-print">
          <CategoryFilterBar
            active={categoryFilter}
            onChange={setCategoryFilter}
            counts={categoryCounts}
          />
        </div>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a202c", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            รายงานสรุปสต็อก{categoryLabel} {reportData.periodLabel}
          </h1>
          <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
            {sourceLabel} | วันที่ {reportData.startDate} ถึง {reportData.endDate}
          </p>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 780 }}>
            <thead>
              <tr>
                {[
                  { label: "ลำดับ",     align: "center" as const, w: 52 },
                  { label: "รหัสสินค้า", align: "left" as const,   w: 130 },
                  { label: "ชื่อสินค้า", align: "left" as const,   w: undefined },
                  { label: "ชนิด",       align: "center" as const, w: 100 },
                  { label: "หน่วย",      align: "center" as const, w: 70 },
                  { label: "บรรจุ",      align: "center" as const, w: 90 },
                  { label: "ยอดยกมา",    align: "right" as const,  w: 90 },
                  { label: "รับ",        align: "right" as const,  w: 80 },
                  { label: "จ่าย",       align: "right" as const,  w: 80 },
                  { label: "คงเหลือ",    align: "right" as const,  w: 90 },
                ].map((h) => (
                  <th
                    key={h.label}
                    style={{
                      border: "1px solid #111827",
                      padding: "10px 12px",
                      background: "#1f2937",
                      color: "#ffffff",
                      fontWeight: 700,
                      textAlign: h.align,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      width: h.w,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: "center", padding: "32px 24px",
                      color: "#94a3b8", border: "1px solid #e2e8f0",
                      fontSize: 14,
                    }}
                  >
                    {categoryFilter === "ทั้งหมด"
                      ? "ไม่มีข้อมูลในช่วงเวลานี้"
                      : `ไม่มีข้อมูล "${categoryFilter}" ในช่วงเวลานี้`}
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => {
                  const isZero = row.closingBalance <= 0;
                  const rowBg = idx % 2 === 0 ? "#ffffff" : "#f0f4ff";
                  const cellBase: React.CSSProperties = {
                    border: "1px solid #e2e8f0",
                    padding: "8px 12px",
                    background: rowBg,
                  };
                  return (
                    <tr key={`${row.productCode}-${idx}`}>
                      <td style={{ ...cellBase, textAlign: "center", color: "#64748b" }}>
                        {row.seq}
                      </td>
                      <td style={{ ...cellBase, fontWeight: 600, color: "#1e3a5f", fontFamily: "monospace" }}>
                        {row.productCode}
                      </td>
                      <td style={{ ...cellBase }}>
                        {row.productName}
                      </td>
                      <td style={{ ...cellBase, textAlign: "center" }}>
                        {/* ── Type badge ── */}
                        {row.productType ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              background:
                                row.productType === "สินค้า" ? "#dbeafe" :
                                row.productType === "วัสดุ"  ? "#fef3c7" :
                                row.productType === "คลัง"   ? "#dcfce7" : "#f1f5f9",
                              color:
                                row.productType === "สินค้า" ? "#1d4ed8" :
                                row.productType === "วัสดุ"  ? "#92400e" :
                                row.productType === "คลัง"   ? "#166534" : "#475569",
                            }}
                          >
                            {row.productType}
                          </span>
                        ) : "-"}
                      </td>
                      <td style={{ ...cellBase, textAlign: "center" }}>
                        {row.unit || "-"}
                      </td>
                      <td style={{ ...cellBase, textAlign: "center", color: "#64748b" }}>
                        {row.packSize || "-"}
                      </td>
                      <td style={{ ...cellBase, textAlign: "right", color: "#64748b" }}>
                        {fmtOpening(row.openingBalance)}
                      </td>
                      <td style={{ ...cellBase, textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                        {fmtNum(row.totalReceived)}
                      </td>
                      <td style={{ ...cellBase, textAlign: "right", color: "#dc2626", fontWeight: 600 }}>
                        {fmtNum(row.totalIssued)}
                      </td>
                      <td
                        style={{
                          ...cellBase,
                          textAlign: "right",
                          fontWeight: 700,
                          color: isZero ? "#dc2626" : "#1a202c",
                        }}
                      >
                        {fmtNum(row.closingBalance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 11, color: "#cbd5e1" }}>รายงานนี้สร้างโดยบริษัท ทีสยามเเพ็ค</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            จำนวน {displayRows.length} รายการ{categoryFilter !== "ทั้งหมด" ? ` (${categoryFilter})` : ""} | พิมพ์เมื่อ {reportData.generatedAt}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  //  Styles
  // ══════════════════════════════════════════════

  const pageStyle: React.CSSProperties = {
    fontFamily: "'Sarabun', 'Prompt', 'Helvetica Neue', Arial, sans-serif",
    background: "#f1f5f9",
    padding: "16px 20px",
    minHeight: "100vh",
  };

  const tabBar: React.CSSProperties = { display: "flex", gap: 2, marginBottom: 0 };

  function tabBtn(active: boolean): React.CSSProperties {
    return {
      padding: "9px 22px",
      border: "none",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      borderRadius: "8px 8px 0 0",
      background: active ? "white" : "#e2e8f0",
      color: active ? "#2c3e6b" : "#64748b",
      fontFamily: "inherit",
      transition: "all 0.15s",
    };
  }

  const card: React.CSSProperties = {
    background: "white",
    borderRadius: "0 12px 12px 12px",
    padding: "20px 24px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    marginBottom: 16,
  };

  const cardFlat: React.CSSProperties = {
    background: "white",
    borderRadius: 12,
    padding: "24px 28px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    marginBottom: 16,
  };

  const btn = (bg: string, disabled = false): React.CSSProperties => ({
    padding: "8px 18px",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    background: disabled ? "#9ca3af" : bg,
    color: "white",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap" as const,
    transition: "opacity 0.15s",
  });

  function msgBox(isError: boolean): React.CSSProperties {
    return {
      padding: "10px 16px",
      borderRadius: 8,
      marginBottom: 12,
      background: isError ? "#fee2e2" : "#dcfce7",
      color: isError ? "#991b1b" : "#166534",
      border: isError ? "1px solid #fca5a5" : "1px solid #86efac",
      fontWeight: 600,
      fontSize: 13,
    };
  }

  // ══════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════

  return (
    <div style={pageStyle}>
      {statusMsg && <div style={msgBox(false)}>{statusMsg}</div>}
      {errorMsg && <div style={msgBox(true)}>{errorMsg}</div>}

      {/* Tabs */}
      <div style={tabBar}>
        <button onClick={() => { setActiveTab("system"); setReportData(null); }} style={tabBtn(activeTab === "system")}>
          ข้อมูลจากระบบ
        </button>
        <button onClick={() => { setActiveTab("excel"); setReportData(null); }} style={tabBtn(activeTab === "excel")}>
          นำเข้าไฟล์ Excel
        </button>
      </div>

      {/* ── Tab: System ── */}
      {activeTab === "system" && (
        <>
          <div style={card}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
              {renderPeriodControls()}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={loadSystemData} style={btn("#f59e0b", sysLoading)}>
                {sysLoading ? "กำลังโหลด..." : "โหลดข้อมูล"}
              </button>
              <button
                onClick={() => buildReport(sysProducts)}
                style={btn("#16a34a", sysProducts.length === 0)}
                disabled={sysProducts.length === 0}
              >
                สร้างรายงาน
              </button>
              {reportData && (
                <>
                  <button onClick={handleExport} style={btn("#7c3aed")}>ดาวน์โหลด Excel</button>
                  <button onClick={handlePrint} style={btn("#dc2626")}>พิมพ์ PDF</button>
                </>
              )}
              {sysProducts.length > 0 && (
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 4 }}>
                  {sysProducts.length} รายการ
                </span>
              )}
            </div>

            {sysLoading && (
              <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 14 }}>
                กำลังโหลดข้อมูล...
              </div>
            )}
            {!sysLoading && sysProducts.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0 8px", color: "#94a3b8", fontSize: 14 }}>
                กด "โหลดข้อมูล" เพื่อดึงข้อมูลจากระบบ
              </div>
            )}
          </div>

          {reportData && <div style={cardFlat}>{renderReport()}</div>}
        </>
      )}

      {/* ── Tab: Excel ── */}
      {activeTab === "excel" && (
        <>
          <div style={card}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                เลือกไฟล์ Excel Stock Card
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{
                    flex: 1, padding: "7px 10px", borderRadius: 6,
                    border: "1.5px solid #d1d5db", fontSize: 13, color: "#374151",
                  }}
                />
                <button
                  onClick={handleReadFile}
                  disabled={excelLoading || !excelFile}
                  style={btn("#2563eb", excelLoading || !excelFile)}
                >
                  {excelLoading ? "กำลังอ่าน..." : "อ่านไฟล์"}
                </button>
              </div>
              {excelProducts.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                  {excelFile?.name} — {excelProducts.length} สินค้า
                </div>
              )}
            </div>

            {renderPeriodControls()}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <button
                onClick={() => buildReport(excelProducts)}
                disabled={excelProducts.length === 0}
                style={btn("#16a34a", excelProducts.length === 0)}
              >
                สร้างรายงาน
              </button>
              {reportData && (
                <>
                  <button onClick={handleExport} style={btn("#7c3aed")}>ดาวน์โหลด Excel</button>
                  <button onClick={handlePrint} style={btn("#dc2626")}>พิมพ์ PDF</button>
                </>
              )}
            </div>
          </div>

          {reportData ? (
            <div style={cardFlat}>{renderReport()}</div>
          ) : !excelLoading && (
            <div style={{ ...cardFlat, textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8 }}>
                <div style={{ fontSize: 36, fontWeight: 300, color: "#cbd5e1", marginBottom: 8, letterSpacing: "0.1em" }}>
                  STOCK
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#64748b", marginBottom: 6 }}>
                  ระบบรายงานสต็อกคงเหลือ
                </div>
                อัปโหลดไฟล์ Excel Stock Card (.xlsx) เพื่อสร้างรายงานสรุปสต็อก
              </div>
            </div>
          )}
        </>
      )}

      {/* Print styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');

        .no-print { display: flex; }

        @media print {
          @page { margin: 10mm 12mm; size: A4 landscape; }
          body * { visibility: hidden !important; }
          .report-print-area,
          .report-print-area * { visibility: visible !important; }
          .report-print-area {
            position: fixed;
            left: 0; top: 0;
            width: 100%;
            padding: 0;
          }
          .no-print { display: none !important; }
          table { font-size: 9pt !important; width: 100% !important; table-layout: fixed !important; }
          th { padding: 5px 6px !important; font-size: 9pt !important; }
          td { padding: 4px 6px !important; font-size: 9pt !important; word-break: break-word !important; }
          h1 { font-size: 15pt !important; }
          p  { font-size: 10pt !important; }
          th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          tr { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}