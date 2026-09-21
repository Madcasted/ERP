// ─── Man Hour Report ─────────────────────────────────────────────────────────
// รายงานตามหลักธุรกิจ: ใครทำงานกี่ชั่วโมง / งานไหนใช้เวลา-วัสดุเท่าไหร่ / ของเสียไปเท่าไหร่
// อ่านข้อมูลจาก localStorage (customer_manhour_jobs / customer_manhour_logs) เหมือนหน้าบันทึกเวลา

import React, { useEffect, useMemo, useState } from "react";
import {
  ManHourJob,
  ManHourLog,
  calcJobMaterialCost,
  calcJobMaterialWasteCost,
  calcMaterialLineCost,
  calcMaterialLineWasteCost,
  describeMaterialLineUsage,
  describeMaterialLineWaste,
  formatBaht,
  formatNumber,
  formatThaiDate,
  isWithinRange,
  logTotalHours,
  materialLineFactor,
  readManHourJobs,
  readManHourLogs,
} from "@/lib/manhour";

type CustomerLite = { id: string; name: string; role?: string | null; email?: string | null };

export type MemberReportRow = {
  id: string;
  name: string;
  role: string;
  email: string;
  hours: number;
  regularHours: number;
  overtimeHours: number;
  jobCount: number;
  dayCount: number;
  materialCost: number;
  wasteCost: number;
};

export type JobReportRow = {
  job: ManHourJob;
  hours: number;
  targetHours: number;
  progress: number;
  materialCost: number;
  wasteCost: number;
  wasteRate: number;
  materialCount: number;
};

export type MaterialReportRow = {
  key: string;
  name: string;
  unit: string;
  usedUnits: number;
  wasteUnits: number;
  value: number;
  wasteValue: number;
  wasteRate: number;
};

export type ManHourReportModel = {
  filteredLogs: ManHourLog[];
  memberRows: MemberReportRow[];
  jobRows: JobReportRow[];
  materialRows: MaterialReportRow[];
  totals: {
    members: number;
    jobs: number;
    doneJobs: number;
    activeJobs: number;
    logs: number;
    workDays: number;
    hours: number;
    regularHours: number;
    overtimeHours: number;
    materialCost: number;
    wasteCost: number;
    wasteRate: number;
    materials: number;
    avgHoursPerDay: number;
  };
};

export function buildManHourReport(input: {
  jobs: ManHourJob[];
  logs: ManHourLog[];
  customers: CustomerLite[];
  from: string;
  to: string;
  customerId?: string;
  jobId?: string;
}): ManHourReportModel {
  const { jobs, logs, customers, from, to, customerId = "", jobId = "" } = input;

  const filteredLogs = logs.filter(
    (log) =>
      isWithinRange(log.date, from, to) &&
      (!customerId || log.customerId === customerId) &&
      (!jobId || log.jobId === jobId),
  );

  const logsByJob = new Map<string, ManHourLog[]>();
  filteredLogs.forEach((log) => {
    const list = logsByJob.get(log.jobId) ?? [];
    list.push(log);
    logsByJob.set(log.jobId, list);
  });

  const reportJobs = jobs.filter(
    (job) => (jobId ? job.id === jobId : logsByJob.has(job.id) || isWithinRange(job.createdAt, from, to)),
  );
  const jobById = new Map(reportJobs.map((job) => [job.id, job]));

  const hoursByJob = new Map<string, number>();
  logsByJob.forEach((list, id) => {
    hoursByJob.set(id, list.reduce((sum, log) => sum + logTotalHours(log), 0));
  });

  const jobRows: JobReportRow[] = reportJobs
    .map((job) => {
      const hours = hoursByJob.get(job.id) ?? 0;
      const materialCost = calcJobMaterialCost(job);
      const wasteCost = calcJobMaterialWasteCost(job);
      return {
        job,
        hours,
        targetHours: Number(job.targetHours) || 0,
        progress: job.targetHours > 0 ? hours / job.targetHours : 0,
        materialCost,
        wasteCost,
        wasteRate: materialCost > 0 ? wasteCost / materialCost : 0,
        materialCount: (job.materials ?? []).length,
      };
    })
    .sort((a, b) => b.materialCost + b.hours - (a.materialCost + a.hours));

  // ── รายคน: ชั่วโมงของตัวเอง + ค่าวัสดุเฉลี่ยตามสัดส่วนชั่วโมงที่ทำในแต่ละงาน ──
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const memberMap = new Map<string, MemberReportRow>();
  filteredLogs.forEach((log) => {
    const customer = customerById.get(log.customerId);
    const row = memberMap.get(log.customerId) ?? {
      id: log.customerId,
      name: customer?.name ?? "ไม่พบสมาชิก",
      role: customer?.role ?? "-",
      email: customer?.email ?? "",
      hours: 0,
      regularHours: 0,
      overtimeHours: 0,
      jobCount: 0,
      dayCount: 0,
      materialCost: 0,
      wasteCost: 0,
    };
    row.hours += logTotalHours(log);
    row.regularHours += Number(log.regularHours) || 0;
    row.overtimeHours += Number(log.overtimeHours) || 0;
    memberMap.set(log.customerId, row);
  });

  memberMap.forEach((row, memberId) => {
    const memberLogs = filteredLogs.filter((log) => log.customerId === memberId);
    row.jobCount = new Set(memberLogs.map((log) => log.jobId)).size;
    row.dayCount = new Set(memberLogs.map((log) => log.date)).size;
    const hoursByMemberJob = new Map<string, number>();
    memberLogs.forEach((log) => {
      hoursByMemberJob.set(log.jobId, (hoursByMemberJob.get(log.jobId) ?? 0) + logTotalHours(log));
    });
    hoursByMemberJob.forEach((hours, id) => {
      const totalHours = hoursByJob.get(id) ?? 0;
      const job = jobById.get(id);
      if (!totalHours || !job) return;
      const share = hours / totalHours;
      row.materialCost += calcJobMaterialCost(job) * share;
      row.wasteCost += calcJobMaterialWasteCost(job) * share;
    });
  });

  const memberRows = [...memberMap.values()].sort((a, b) => b.hours - a.hours);

  // ── สรุปการใช้วัสดุ (รวมทุกงานในช่วงที่กรอง) ──
  const materialMap = new Map<string, MaterialReportRow>();
  reportJobs.forEach((job) => {
    (job.materials ?? []).forEach((line) => {
      const factor = materialLineFactor(line);
      const name = line.name.trim() || "(ไม่ระบุชื่อวัสดุ)";
      const key = `${name}||${line.unit || "หน่วย"}`;
      const row = materialMap.get(key) ?? {
        key,
        name,
        unit: line.unit || "หน่วย",
        usedUnits: 0,
        wasteUnits: 0,
        value: 0,
        wasteValue: 0,
        wasteRate: 0,
      };
      row.usedUnits += (Number(line.usedQty) || 0) / factor;
      row.wasteUnits += (Number(line.wastedQty) || 0) / factor;
      row.value += calcMaterialLineCost(line);
      row.wasteValue += calcMaterialLineWasteCost(line);
      materialMap.set(key, row);
    });
  });
  const materialRows = [...materialMap.values()]
    .map((row) => ({ ...row, wasteRate: row.value > 0 ? row.wasteValue / row.value : 0 }))
    .sort((a, b) => b.value - a.value);

  const hours = filteredLogs.reduce((sum, log) => sum + logTotalHours(log), 0);
  const workDays = new Set(filteredLogs.map((log) => log.date)).size;
  const materialCost = materialRows.reduce((sum, row) => sum + row.value, 0);
  const wasteCost = materialRows.reduce((sum, row) => sum + row.wasteValue, 0);

  return {
    filteredLogs,
    memberRows,
    jobRows,
    materialRows,
    totals: {
      members: memberRows.length,
      jobs: jobRows.length,
      doneJobs: jobRows.filter((row) => row.job.status === "done").length,
      activeJobs: jobRows.filter((row) => row.job.status === "active").length,
      logs: filteredLogs.length,
      workDays,
      hours,
      regularHours: filteredLogs.reduce((sum, log) => sum + (Number(log.regularHours) || 0), 0),
      overtimeHours: filteredLogs.reduce((sum, log) => sum + (Number(log.overtimeHours) || 0), 0),
      materialCost,
      wasteCost,
      wasteRate: materialCost > 0 ? wasteCost / materialCost : 0,
      materials: materialRows.length,
      avgHoursPerDay: workDays > 0 ? hours / workDays : 0,
    },
  };
}


// ─── UI helpers ───────────────────────────────────────────────────────────────

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  return `${todayISO().slice(0, 7)}-01`;
}

function shiftDaysISO(days: number) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

type Tone = { bg: string; fg: string };

function KpiCard({ icon, tone, label, value, sub }: { icon: string; tone: Tone; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%)",
      border: "1px solid #e4efe8", borderRadius: 20, padding: 18,
      display: "flex", gap: 14, alignItems: "center", minWidth: 0,
      boxShadow: "0 2px 10px rgba(15, 40, 25, 0.04)",
    }}>
      <span style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, background: tone.bg, color: tone.fg,
      }}>
        <i className={`bx ${icon}`} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="sub-text">{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2e1c", lineHeight: 1.28, wordBreak: "break-word" }}>{value}</div>
        {sub && <div className="sub-text" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ background: "#fff", marginBottom: 18 }}>
      <div className="section-header" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="sub-text" style={{ marginTop: 4 }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, value, max, right, color, height = 10 }: { label: string; value: number; max: number; right: string; color: string; height?: number }) {
  const width = max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span className="sub-text" style={{ flexShrink: 0 }}>{right}</span>
      </div>
      <div style={{ height, borderRadius: 999, background: "#eef3ef", overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", borderRadius: 999, background: color, transition: "width .25s ease" }} />
      </div>
    </div>
  );
}

function RateBadge({ rate, label = "ของเสีย" }: { rate: number; label?: string }) {
  const percent = rate * 100;
  const tone = percent >= 10
    ? { bg: "#FEE2E2", fg: "#B91C1C" }
    : percent >= 5
      ? { bg: "#FEF3C7", fg: "#B45309" }
      : { bg: "#DCFCE7", fg: "#15803D" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: tone.bg, color: tone.fg }}>
      {label} {formatNumber(percent, 1)}%
    </span>
  );
}

const roleLabels: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  MANAGER: "ผู้จัดการ",
  EXECUTIVE: "ผู้บริหาร",
  EMPLOYEE: "พนักงาน",
};

function roleLabel(role?: string | null) {
  if (!role) return "-";
  return roleLabels[role] ?? role;
}

export default function ManHourReport() {
  const [jobs, setJobs] = useState<ManHourJob[]>([]);
  const [logs, setLogs] = useState<ManHourLog[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [preset, setPreset] = useState<"today" | "week" | "month" | "all" | "custom">("month");
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [customerId, setCustomerId] = useState("");
  const [jobId, setJobId] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = () => {
      setJobs(readManHourJobs());
      setLogs(readManHourLogs());
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/customers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (active) setCustomers(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function applyPreset(next: "today" | "week" | "month" | "all") {
    setPreset(next);
    if (next === "today") { setFrom(todayISO()); setTo(todayISO()); }
    else if (next === "week") { setFrom(shiftDaysISO(-6)); setTo(todayISO()); }
    else if (next === "month") { setFrom(firstDayOfMonthISO()); setTo(todayISO()); }
    else { setFrom(""); setTo(""); }
  }

  const model = useMemo(
    () => buildManHourReport({ jobs, logs, customers, from, to, customerId, jobId }),
    [jobs, logs, customers, from, to, customerId, jobId],
  );
  const { totals, memberRows, jobRows, materialRows, filteredLogs } = model;
  const rangeLabel = `${from ? formatThaiDate(from) : "เริ่มบันทึก"} – ${to ? formatThaiDate(to) : formatThaiDate(new Date())}`;
  const maxMemberHours = memberRows.reduce((max, row) => Math.max(max, row.hours), 0);
  const maxJobCost = jobRows.reduce((max, row) => Math.max(max, row.materialCost + row.wasteCost), 0);
  const topMembers = memberRows.slice(0, 6);
  const topJobs = jobRows.slice(0, 6);
  const jobOptions = useMemo(() => [...jobs].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")), [jobs]);
  const nameByCustomerId = new Map(customers.map((customer) => [customer.id, customer.name]));
  const nameByJobId = new Map(jobs.map((job) => [job.id, job.name]));
  const hasData = jobs.length > 0 || logs.length > 0;

  async function exportExcel() {
    setExporting(true);
    const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const summary: (string | number)[][] = [
        ["รายงาน Man Hour"],
        ["ช่วงวันที่", rangeLabel],
        ["วันที่ออกรายงาน", new Date().toLocaleString("th-TH")],
        [],
        ["สมาชิกที่ทำงาน (คน)", totals.members],
        ["งานทั้งหมด (งาน)", totals.jobs],
        ["งานเสร็จแล้ว (งาน)", totals.doneJobs],
        ["งานกำลังทำ (งาน)", totals.activeJobs],
        ["บันทึกเวลา (รายการ)", totals.logs],
        ["วันทำงาน (วัน)", totals.workDays],
        ["ชั่วโมงรวม (ชม.)", round2(totals.hours)],
        ["ชั่วโมงปกติ (ชม.)", round2(totals.regularHours)],
        ["OT (ชม.)", round2(totals.overtimeHours)],
        ["ชั่วโมงเฉลี่ยต่อวัน (ชม.)", round2(totals.avgHoursPerDay)],
        ["ค่าวัสดุที่ใช้ (บาท)", round2(totals.materialCost)],
        ["มูลค่าของเสีย (บาท)", round2(totals.wasteCost)],
        ["% ของเสีย", round2(totals.wasteRate * 100)],
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), "สรุป");

      const memberSheet: (string | number)[][] = [
        ["สมาชิก", "บทบาท", "อีเมล", "ชั่วโมงรวม", "ชั่วโมงปกติ", "OT", "งานที่ทำ", "วันทำงาน", "ค่าวัสดุ (บาท)", "ของเสีย (บาท)"],
        ...memberRows.map((row) => [
          row.name, row.role, row.email, round2(row.hours), round2(row.regularHours),
          round2(row.overtimeHours), row.jobCount, row.dayCount, round2(row.materialCost), round2(row.wasteCost),
        ]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(memberSheet), "รายคน");

      const jobSheet: (string | number)[][] = [
        ["งาน", "เลขออเดอร์", "สถานะ", "เป้าหมาย (ชม.)", "ชั่วโมงที่ใช้", "% เทียบเป้า", "ค่าวัสดุ (บาท)", "ของเสีย (บาท)", "% ของเสีย", "จำนวนวัสดุ"],
        ...jobRows.map((row) => [
          row.job.name, row.job.orderNumber || "-", row.job.status === "done" ? "เสร็จแล้ว" : "กำลังทำ",
          row.targetHours, round2(row.hours), round2(row.progress * 100), round2(row.materialCost),
          round2(row.wasteCost), round2(row.wasteRate * 100), row.materialCount,
        ]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(jobSheet), "รายงาน(Job)");

      const materialSheet: (string | number)[][] = [
        ["วัสดุ", "หน่วยซื้อ", "ใช้ไป (หน่วยซื้อ)", "มูลค่า (บาท)", "เสียไป (หน่วยซื้อ)", "มูลค่าของเสีย (บาท)", "% ของเสีย"],
        ...materialRows.map((row) => [
          row.name, row.unit, round2(row.usedUnits), round2(row.value),
          round2(row.wasteUnits), round2(row.wasteValue), round2(row.wasteRate * 100),
        ]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(materialSheet), "สรุปวัสดุ");

      const logSheet: (string | number)[][] = [
        ["วันที่", "สมาชิก", "งาน", "เวลาเข้า", "เวลาออก", "ชั่วโมงปกติ", "OT", "ชั่วโมงรวม", "หมายเหตุ"],
        ...filteredLogs
          .slice()
          .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
          .map((log) => [
            log.date,
            nameByCustomerId.get(log.customerId) ?? log.customerId,
            nameByJobId.get(log.jobId) ?? log.jobId,
            log.checkIn, log.checkOut, round2(log.regularHours), round2(log.overtimeHours),
            round2(logTotalHours(log)), log.note || "",
          ]),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(logSheet), "บันทึกเวลา");

      XLSX.writeFile(workbook, `manhour_report_${todayISO()}.xlsx`);
    } finally {
      setExporting(false);
    }
  }


  return (
    <div className="print-area" style={{ display: "flex", flexDirection: "column" }}>
      {/* ── หัวรายงาน (ติดไปตอนพิมพ์ด้วย) ── */}
      <div style={{ background: "linear-gradient(135deg, #1f6f4a 0%, #2c9e6e 100%)", borderRadius: 22, padding: "22px 24px", color: "#fff", display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 800 }}>
            <i className="bx bxs-report" style={{ fontSize: 26 }} />
            รายงาน Man Hour
          </div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>ช่วงข้อมูล: {rangeLabel}</div>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.82 }}>ออกรายงานเมื่อ {new Date().toLocaleString("th-TH")}</div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn" style={{ background: "#fff", color: "#1f6f4a", fontWeight: 700 }} onClick={() => window.print()}>
            🖨️ พิมพ์รายงาน
          </button>
          <button
            type="button"
            className="btn"
            style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.45)" }}
            onClick={exportExcel}
            disabled={exporting}
          >
            {exporting ? "กำลังสร้างไฟล์..." : "⬇️ ส่งออก Excel"}
          </button>
        </div>
      </div>

      {/* ── ตัวกรองรายงาน ── */}
      <div className="no-print" style={{ background: "#fff", borderRadius: 20, border: "1px solid #e4efe8", padding: 16, marginBottom: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div className="field-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label>จากวันที่</label>
          <input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} />
        </div>
        <div className="field-group" style={{ marginBottom: 0, minWidth: 150 }}>
          <label>ถึงวันที่</label>
          <input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([["today", "วันนี้"], ["week", "7 วัน"], ["month", "เดือนนี้"], ["all", "ทั้งหมด"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`tab${preset === value ? " active" : ""}`}
              style={{ padding: "8px 14px" }}
              onClick={() => applyPreset(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="field-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>สมาชิก</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">ทุกคน</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </div>
        <div className="field-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label>งาน</label>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">ทุกงาน</option>
            {jobOptions.map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => { setCustomerId(""); setJobId(""); applyPreset("month"); }}>
          ล้างตัวกรอง
        </button>
      </div>

      {!hasData ? (
        <div className="card" style={{ background: "#fff", textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 44 }}>📋</div>
          <h3 style={{ margin: "12px 0 6px" }}>ยังไม่มีข้อมูลสำหรับออกรายงาน</h3>
          <p className="sub-text">ไปที่เมนู “สมาชิก → Man Hour” เพื่อสร้างงาน บันทึกเวลา และระบุวัสดุที่ใช้ก่อนครับ</p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 18 }}>
            <KpiCard icon="bxs-user-check" tone={{ bg: "#DCFCE7", fg: "#15803D" }} label="สมาชิกที่ทำงาน" value={`${totals.members} คน`} sub={`บันทึกเวลา ${totals.logs} รายการ`} />
            <KpiCard icon="bxs-time-five" tone={{ bg: "#DBEAFE", fg: "#1D4ED8" }} label="ชั่วโมงรวม" value={`${formatNumber(totals.hours, 1)} ชม.`} sub={`ปกติ ${formatNumber(totals.regularHours, 1)} · OT ${formatNumber(totals.overtimeHours, 1)} ชม.`} />
            <KpiCard icon="bxs-briefcase" tone={{ bg: "#FEF3C7", fg: "#B45309" }} label="งานในช่วงที่เลือก" value={`${totals.jobs} งาน`} sub={`เสร็จ ${totals.doneJobs} · กำลังทำ ${totals.activeJobs}`} />
            <KpiCard icon="bxs-calendar-check" tone={{ bg: "#EDE9FE", fg: "#6D28D9" }} label="วันทำงาน" value={`${totals.workDays} วัน`} sub={`เฉลี่ย ${formatNumber(totals.avgHoursPerDay, 1)} ชม./วัน`} />
            <KpiCard icon="bxs-flask" tone={{ bg: "#CCFBF1", fg: "#0F766E" }} label="ค่าวัสดุที่ใช้" value={formatBaht(totals.materialCost)} sub={`วัสดุ ${totals.materials} รายการ`} />
            <KpiCard icon="bxs-trash" tone={{ bg: "#FEE2E2", fg: "#B91C1C" }} label="ของเสีย / สูญเสีย" value={formatBaht(totals.wasteCost)} sub={`${formatNumber(totals.wasteRate * 100, 1)}% ของค่าวัสดุที่ใช้`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <SectionCard title="⏱️ ชั่วโมงทำงานรายคน" subtitle="เทียบชั่วโมงรวมของแต่ละคน (ปกติ + OT)">
              {topMembers.length === 0 ? (
                <div className="sub-text" style={{ padding: 8 }}>ไม่มีข้อมูลชั่วโมงในช่วงนี้</div>
              ) : topMembers.map((row) => (
                <BarRow
                  key={row.id}
                  label={`${row.name}${row.overtimeHours > 0 ? ` · OT ${formatNumber(row.overtimeHours, 1)}` : ""}`}
                  value={row.hours}
                  max={maxMemberHours}
                  right={`${formatNumber(row.hours, 1)} ชม.`}
                  color="linear-gradient(90deg, #2c9e6e, #7dd3a8)"
                />
              ))}
            </SectionCard>

            <SectionCard title="🧾 ค่าวัสดุและของเสียรายงาน" subtitle="เขียว = วัสดุที่ใช้ · แดง = มูลค่าที่เสียไป/สูญเสีย">
              {topJobs.length === 0 ? (
                <div className="sub-text" style={{ padding: 8 }}>ยังไม่มีงานที่บันทึกวัสดุในช่วงนี้</div>
              ) : topJobs.map((row) => {
                const total = row.materialCost + row.wasteCost;
                const width = maxJobCost > 0 ? Math.max(total > 0 ? 4 : 0, (total / maxJobCost) * 100) : 0;
                const wasteShare = total > 0 ? (row.wasteCost / total) * 100 : 0;
                return (
                  <div key={row.job.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.job.name}</span>
                      <span className="sub-text" style={{ flexShrink: 0 }}>
                        {formatBaht(total)} · เสีย {formatNumber(row.wasteRate * 100, 1)}%
                      </span>
                    </div>
                    <div style={{ height: 12, borderRadius: 999, background: "#eef3ef", overflow: "hidden", width: `${width}%` }}>
                      <div style={{ display: "flex", height: "100%", width: "100%" }}>
                        <div style={{ width: `${100 - wasteShare}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
                        <div style={{ width: `${wasteShare}%`, background: "linear-gradient(90deg, #f87171, #ef4444)" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </SectionCard>
          </div>

          <SectionCard
            title="👥 รายงานรายบุคคล"
            subtitle="ชั่วโมงทำงานของแต่ละคน + ค่าวัสดุเฉลี่ยตามสัดส่วนชั่วโมงที่ทำในแต่ละงาน"
            action={<span className="sub-text">รวม {formatNumber(totals.hours, 1)} ชม. · OT {formatNumber(totals.overtimeHours, 1)} ชม.</span>}
          >
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>สมาชิก</th><th>บทบาท</th><th>งานที่ทำ</th><th>วันทำงาน</th>
                    <th>ชั่วโมงรวม</th><th>ปกติ</th><th>OT</th>
                    <th>ค่าวัสดุ (ตามสัดส่วน)</th><th>ของเสีย</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.length === 0 && <tr><td colSpan={9} className="text-center">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>}
                  {memberRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{row.name}</div>
                        <div className="sub-text">{row.email}</div>
                      </td>
                      <td>{roleLabel(row.role)}</td>
                      <td>{row.jobCount} งาน</td>
                      <td>{row.dayCount} วัน</td>
                      <td><strong>{formatNumber(row.hours, 1)}</strong> ชม.</td>
                      <td>{formatNumber(row.regularHours, 1)} ชม.</td>
                      <td><span style={{ color: row.overtimeHours > 0 ? "#B45309" : "#718096", fontWeight: 700 }}>{formatNumber(row.overtimeHours, 1)} ชม.</span></td>
                      <td>{formatBaht(row.materialCost)}</td>
                      <td>{row.wasteCost > 0 ? <span style={{ color: "#B91C1C", fontWeight: 700 }}>{formatBaht(row.wasteCost)}</span> : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* __PART6__ */}
        </>
      )}

    </div>
  );
}


