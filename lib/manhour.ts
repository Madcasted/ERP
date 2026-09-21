// ─── Man Hour domain ─────────────────────────────────────────────────────────
// ใช้ร่วมกันระหว่างหน้าบันทึกเวลา (CustomerView) และหน้ารายงาน (ManHourReport)
// ข้อมูลเก็บฝั่ง client ใน localStorage (ยังไม่มีตารางใน DB)

export type ManHourMaterialLine = {
  id: string;
  name: string;
  unit: string;        // หน่วยซื้อ เช่น ม้วน / แผ่น / เส้น / กก.
  unitPrice: number;   // ราคาต่อ 1 หน่วยซื้อ
  convertQty: number;  // 1 หน่วยซื้อ = convertQty หน่วยย่อย (0 หรือ 1 = ไม่แปลงหน่วย)
  convertUnit: string; // หน่วยย่อย เช่น กรัม / เส้น / ชิ้น
  usedQty: number;     // ปริมาณที่ใช้ไป (นับในหน่วยย่อย ถ้ามีตัวแปลง)
  wastedQty: number;   // ปริมาณที่เสียไป / สูญเสีย (นับในหน่วยเดียวกับ usedQty)
  note: string;
};

export type ManHourJob = {
  id: string;
  name: string;
  orderNumber: string;
  ownerRole: string;
  targetHours: number;
  status: "active" | "done";
  createdAt: string;
  materials?: ManHourMaterialLine[];
};

export type ManHourLog = {
  id: string;
  customerId: string;
  jobId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  regularHours: number;
  overtimeHours: number;
  note: string;
  createdAt: string;
};

export type MaterialOption = {
  id: string;
  name: string;
  unit?: string | null;
  unitPrice: number;
};

export const MANHOUR_JOBS_KEY = "customer_manhour_jobs";
export const MANHOUR_LOGS_KEY = "customer_manhour_logs";

export const materialUnitOptions = ["ม้วน", "แผ่น", "เส้น", "กก.", "กรัม", "ชิ้น", "เมตร", "ลิตร"];

export function createMaterialLine(): ManHourMaterialLine {
  return {
    id: `MHM${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
    name: "",
    unit: "ม้วน",
    unitPrice: 0,
    convertQty: 1000,
    convertUnit: "กรัม",
    usedQty: 0,
    wastedQty: 0,
    note: "",
  };
}

export function materialLineFactor(line: ManHourMaterialLine) {
  const factor = Number(line.convertQty) || 0;
  return factor > 0 ? factor : 1;
}

// ปริมาณที่ใช้ แปลงกลับเป็นหน่วยซื้อ เช่น ใช้ 0.5 กรัม และ 1 ม้วน = 1000 กรัม → 0.0005 ม้วน
export function calcMaterialLineQtyInUnits(line: ManHourMaterialLine) {
  return (Number(line.usedQty) || 0) / materialLineFactor(line);
}

// ค่าวัสดุ 1 บรรทัด = ราคาต่อหน่วยซื้อ × (ปริมาณที่ใช้ ÷ ตัวแปลงหน่วย)
export function calcMaterialLineCost(line: ManHourMaterialLine) {
  return (Number(line.unitPrice) || 0) * calcMaterialLineQtyInUnits(line);
}

// มูลค่าของที่เสียไป/สูญเสีย = ราคาต่อหน่วยซื้อ × (ปริมาณที่เสีย ÷ ตัวแปลงหน่วย)
export function calcMaterialLineWasteCost(line: ManHourMaterialLine) {
  return (Number(line.unitPrice) || 0) * ((Number(line.wastedQty) || 0) / materialLineFactor(line));
}

export function calcJobMaterialCost(job: ManHourJob) {
  return (job.materials ?? []).reduce((sum, line) => sum + calcMaterialLineCost(line), 0);
}

export function calcJobMaterialWasteCost(job: ManHourJob) {
  return (job.materials ?? []).reduce((sum, line) => sum + calcMaterialLineWasteCost(line), 0);
}

export function describeMaterialLineUsage(line: ManHourMaterialLine) {
  const factor = materialLineFactor(line);
  const used = Number(line.usedQty) || 0;
  if (factor === 1) {
    return `${used.toLocaleString("th-TH")} ${line.unit || "หน่วย"}`;
  }
  const converted = calcMaterialLineQtyInUnits(line).toLocaleString("th-TH", { maximumFractionDigits: 6 });
  return `${used.toLocaleString("th-TH")} ${line.convertUnit || "หน่วยย่อย"} (= ${converted} ${line.unit || "หน่วย"})`;
}

export function describeMaterialLineWaste(line: ManHourMaterialLine) {
  const factor = materialLineFactor(line);
  const wasted = Number(line.wastedQty) || 0;
  if (!wasted) return "-";
  if (factor === 1) return `${wasted.toLocaleString("th-TH")} ${line.unit || "หน่วย"}`;
  const converted = (wasted / factor).toLocaleString("th-TH", { maximumFractionDigits: 6 });
  return `${wasted.toLocaleString("th-TH")} ${line.convertUnit || "หน่วยย่อย"} (= ${converted} ${line.unit || "หน่วย"})`;
}

export function describeMaterialLine(line: ManHourMaterialLine) {
  const factor = materialLineFactor(line);
  const parts = [`${(Number(line.unitPrice) || 0).toLocaleString("th-TH")} บาท/${line.unit || "หน่วย"}`];
  if (factor !== 1) {
    parts.push(`1 ${line.unit || "หน่วย"} = ${factor.toLocaleString("th-TH")} ${line.convertUnit || "หน่วยย่อย"}`);
  }
  parts.push(`ใช้ไป ${describeMaterialLineUsage(line)}`);
  parts.push(`→ ${formatBaht(calcMaterialLineCost(line))}`);
  if (Number(line.wastedQty) > 0) {
    parts.push(`เสียไป ${describeMaterialLineWaste(line)} (${formatBaht(calcMaterialLineWasteCost(line))})`);
  }
  return parts.join(" · ");
}

export function formatBaht(value: number) {
  // ค่าวัสดุต่อชิ้นอาจน้อยกว่า 1 บาท → แสดงทศนิยมเพิ่มเพื่อไม่ให้ปัดจนดูเป็น 0
  const isTiny = Math.abs(value) > 0 && Math.abs(value) < 1;
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: isTiny ? 3 : 2,
    maximumFractionDigits: isTiny ? 4 : 2,
  });
}

export function formatNumber(value: number, digits = 2) {
  return (Number(value) || 0).toLocaleString("th-TH", { maximumFractionDigits: digits });
}

export function formatThaiDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function readLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function readManHourJobs(): ManHourJob[] {
  return readLocal<ManHourJob>(MANHOUR_JOBS_KEY);
}

export function readManHourLogs(): ManHourLog[] {
  return readLocal<ManHourLog>(MANHOUR_LOGS_KEY);
}

export function isWithinRange(value: string | undefined, from: string, to: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (date.getTime() < start.getTime()) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (date.getTime() > end.getTime()) return false;
  }
  return true;
}

export function logTotalHours(log: ManHourLog) {
  return (Number(log.regularHours) || 0) + (Number(log.overtimeHours) || 0);
}

