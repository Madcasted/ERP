"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type FilamentUsage = {
  id: string;
  printJob: string;
  amountGrams: number;
  usedBy: string;
  usedAt: string;
};

type FilamentSpool = {
  id: string;
  name: string;
  brand: string | null;
  color: string;
  supplier: string;
  initialWeightGrams: number;
  remainingWeightGrams: number;
  purchaseDate: string;
  usages: FilamentUsage[];
};

type FilamentData = {
  spools: FilamentSpool[];
  currentUser: { id: string; name: string };
};

type Panel = "spool" | "usage" | null;
type ReportType = "data" | "blank";

type BlankSpoolRow = {
  id: number;
  name: string;
  color: string;
  supplier: string;
  initialWeight: string;
  monthlyUsage: string;
  totalUsage: string;
  remainingWeight: string;
};

type BlankUsageRow = {
  id: number;
  date: string;
  spool: string;
  color: string;
  printJob: string;
  amount: string;
  usedBy: string;
};

function createBlankSpoolRow(id: number): BlankSpoolRow {
  return { id, name: "", color: "", supplier: "", initialWeight: "", monthlyUsage: "", totalUsage: "", remainingWeight: "" };
}

function createBlankUsageRow(id: number): BlankUsageRow {
  return { id, date: "", spool: "", color: "", printJob: "", amount: "", usedBy: "" };
}

function localDateValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function localMonthValue() {
  return localDateValue().slice(0, 7);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatGrams(value: number) {
  return `${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 1 })} กรัม`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonth(value: string) {
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function fetchFilamentData(): Promise<FilamentData> {
  const response = await fetch("/api/filament");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "โหลดข้อมูล Filament ไม่สำเร็จ");
  return data;
}

export function Filament3DView() {
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [currentUser, setCurrentUser] = useState<FilamentData["currentUser"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [reportType, setReportType] = useState<ReportType>("data");
  const [blankReportDate, setBlankReportDate] = useState(localDateValue);
  const [blankReportAuthor, setBlankReportAuthor] = useState("");
  const [blankSummary, setBlankSummary] = useState({ monthly: "", remaining: "", total: "" });
  const [blankSpoolRows, setBlankSpoolRows] = useState<BlankSpoolRow[]>(() => Array.from({ length: 5 }, (_, index) => createBlankSpoolRow(index + 1)));
  const [blankUsageRows, setBlankUsageRows] = useState<BlankUsageRow[]>(() => Array.from({ length: 8 }, (_, index) => createBlankUsageRow(index + 1)));
  const [selectedMonth, setSelectedMonth] = useState(localMonthValue);
  const [spoolForm, setSpoolForm] = useState({
    name: "", brand: "", color: "", supplier: "", initialWeightGrams: "1000", purchaseDate: localDateValue(),
  });
  const [usageForm, setUsageForm] = useState({
    spoolId: "", printJob: "", amountGrams: "", usedAt: localDateValue(),
  });

  async function reload() {
    try {
      const data = await fetchFilamentData();
      setSpools(data.spools);
      setCurrentUser(data.currentUser);
      setUsageForm((form) => ({ ...form, spoolId: form.spoolId || data.spools[0]?.id || "" }));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const allUsages = useMemo(
    () => spools.flatMap((spool) => spool.usages.map((usage) => ({ ...usage, spool })))
      .sort((first, second) => new Date(second.usedAt).getTime() - new Date(first.usedAt).getTime()),
    [spools],
  );
  const monthUsages = allUsages.filter((usage) => monthKey(new Date(usage.usedAt)) === selectedMonth);
  const monthlyGrams = monthUsages.reduce((total, usage) => total + usage.amountGrams, 0);
  const allTimeGrams = allUsages.reduce((total, usage) => total + usage.amountGrams, 0);
  const remainingGrams = spools.reduce((total, spool) => total + spool.remainingWeightGrams, 0);

  function handlePrintReport() {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      setError("เปิดหน้ารายงานไม่ได้ กรุณาอนุญาต popup แล้วลองอีกครั้ง");
      return;
    }

    const reportMonth = new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString("th-TH", {
      month: "long",
      year: "numeric",
    });
    const generatedAt = new Date().toLocaleString("th-TH");
    const isBlankReport = reportType === "blank";
    const spoolRows = isBlankReport
      ? blankSpoolRows.map((row) => `<tr>
        <td>${escapeHtml(row.name) || "&nbsp;"}</td>
        <td>${escapeHtml(row.color) || "&nbsp;"}</td>
        <td>${escapeHtml(row.supplier) || "&nbsp;"}</td>
        <td class="number">${escapeHtml(row.initialWeight) ? `${escapeHtml(row.initialWeight)} กรัม` : "&nbsp;"}</td>
        <td class="number">${escapeHtml(row.monthlyUsage) ? `${escapeHtml(row.monthlyUsage)} กรัม` : "&nbsp;"}</td>
        <td class="number">${escapeHtml(row.totalUsage) ? `${escapeHtml(row.totalUsage)} กรัม` : "&nbsp;"}</td>
        <td class="number">${escapeHtml(row.remainingWeight) ? `${escapeHtml(row.remainingWeight)} กรัม` : "&nbsp;"}</td>
      </tr>`).join("")
      : spools.map((spool) => {
      const monthlyUsage = spool.usages
        .filter((usage) => monthKey(new Date(usage.usedAt)) === selectedMonth)
        .reduce((total, usage) => total + usage.amountGrams, 0);
      const totalUsed = spool.initialWeightGrams - spool.remainingWeightGrams;
      return `<tr>
        <td><strong>${escapeHtml(spool.name)}</strong>${spool.brand ? `<br>${escapeHtml(spool.brand)}` : ""}</td>
        <td>${escapeHtml(spool.color)}</td>
        <td>${escapeHtml(spool.supplier)}</td>
        <td class="number">${formatGrams(spool.initialWeightGrams)}</td>
        <td class="number">${formatGrams(monthlyUsage)}</td>
        <td class="number">${formatGrams(totalUsed)}</td>
        <td class="number">${formatGrams(spool.remainingWeightGrams)}</td>
      </tr>`;
    }).join("");
    const usageRows = isBlankReport
      ? blankUsageRows.map((row) => `<tr>
        <td>${row.date ? escapeHtml(formatDate(row.date)) : "&nbsp;"}</td>
        <td>${escapeHtml(row.spool) || "&nbsp;"}</td>
        <td>${escapeHtml(row.color) || "&nbsp;"}</td>
        <td>${escapeHtml(row.printJob) || "&nbsp;"}</td>
        <td class="number">${escapeHtml(row.amount) ? `${escapeHtml(row.amount)} กรัม` : "&nbsp;"}</td>
        <td>${escapeHtml(row.usedBy) || "&nbsp;"}</td>
      </tr>`).join("")
      : monthUsages.map((usage) => `<tr>
      <td>${formatDate(usage.usedAt)}</td>
      <td>${escapeHtml(usage.spool.name)}${usage.spool.brand ? ` · ${escapeHtml(usage.spool.brand)}` : ""}</td>
      <td>${escapeHtml(usage.spool.color)}</td>
      <td>${escapeHtml(usage.printJob)}</td>
      <td class="number">${formatGrams(usage.amountGrams)}</td>
      <td>${escapeHtml(usage.usedBy)}</td>
    </tr>`).join("");

    const reportTitle = isBlankReport ? "แบบฟอร์มรายงานการใช้ Filament 3D" : "รายงานการใช้ Filament 3D";
    const reportSummary = isBlankReport
      ? `<div class="metric"><span>ใช้ในเดือนนี้</span><strong>${escapeHtml(blankSummary.monthly) ? `${escapeHtml(blankSummary.monthly)} กรัม` : "&nbsp;"}</strong></div>
         <div class="metric"><span>คงเหลือทุกม้วน</span><strong>${escapeHtml(blankSummary.remaining) ? `${escapeHtml(blankSummary.remaining)} กรัม` : "&nbsp;"}</strong></div>
         <div class="metric"><span>ใช้สะสมทั้งหมด</span><strong>${escapeHtml(blankSummary.total) ? `${escapeHtml(blankSummary.total)} กรัม` : "&nbsp;"}</strong></div>`
      : `<div class="metric"><span>ใช้ในเดือนนี้</span><strong>${formatGrams(monthlyGrams)}</strong></div>
         <div class="metric"><span>คงเหลือทุกม้วน</span><strong>${formatGrams(remainingGrams)}</strong></div>
         <div class="metric"><span>ใช้สะสมทั้งหมด</span><strong>${formatGrams(allTimeGrams)}</strong></div>`;

    printWindow.document.title = `${reportTitle} ${reportMonth}`;
    printWindow.document.write(`<!doctype html>
      <html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(printWindow.document.title)}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm 12mm; }
        * { box-sizing: border-box; }
        body { color: #263b34; font-family: Sarabun, Tahoma, sans-serif; font-size: 10pt; }
        .company { color: #a44d32; font-size: 9pt; font-weight: 700; letter-spacing: .04em; }
        h1 { margin: 3px 0 4px; font-size: 20pt; }
        .meta { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 12px; border-bottom: 2px solid #214b3f; color: #56665e; }
        .summary { display: flex; gap: 10px; margin: 16px 0 20px; }
        .metric { flex: 1; padding: 10px 12px; border: 1px solid #cfd9d2; }
        .metric span { display: block; color: #66736c; font-size: 9pt; }
        .metric strong { display: block; margin-top: 4px; color: #214b3f; font-size: 15pt; }
        h2 { margin: 17px 0 7px; font-size: 12pt; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #cfd6d1; padding: 6px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        th { background: #edf2ee; font-size: 8.5pt; }
        td { font-size: 8.5pt; }
        .number { text-align: right; white-space: nowrap; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        .empty { padding: 12px; color: #66736c; text-align: center; }
        .signatures { display: flex; justify-content: space-around; gap: 25px; margin-top: 38px; break-inside: avoid; }
        .signature { width: 40%; text-align: center; }
        .signature-line { height: 30px; border-bottom: 1px solid #526159; margin-bottom: 6px; }
        .footer { margin-top: 20px; color: #78837d; font-size: 8pt; text-align: right; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style></head><body>
        <div class="company">T SIAMPACK CO., LTD.</div>
        <h1>${escapeHtml(reportTitle)}</h1>
        <div class="meta"><span>ประจำเดือน ${escapeHtml(reportMonth)}</span><span>${isBlankReport ? `วันที่จัดทำ ${blankReportDate ? escapeHtml(formatDate(blankReportDate)) : "____________________"}` : `ออกรายงาน ${escapeHtml(generatedAt)}`}</span></div>
        <div class="summary">
          ${reportSummary}
        </div>
        <h2>สรุปยอดรายม้วน</h2>
        <table><thead><tr><th style="width:15%">ชนิด / ยี่ห้อ</th><th style="width:11%">สี</th><th style="width:14%">ซื้อจาก</th><th style="width:12%">น้ำหนักตั้งต้น</th><th style="width:12%">ใช้เดือนนี้</th><th style="width:12%">ใช้สะสม</th><th style="width:12%">คงเหลือ</th></tr></thead>
          <tbody>${spoolRows || '<tr><td colspan="7" class="empty">ไม่มีข้อมูลม้วน Filament</td></tr>'}</tbody></table>
        <h2>รายละเอียดการใช้ประจำเดือน</h2>
        <table><thead><tr><th style="width:13%">วันที่</th><th style="width:18%">ชนิด / ยี่ห้อ</th><th style="width:12%">สี</th><th style="width:27%">งานที่พิมพ์</th><th style="width:14%">น้ำหนักที่ใช้</th><th style="width:16%">ผู้ใช้ / ผู้ลงชื่อ</th></tr></thead>
          <tbody>${usageRows || '<tr><td colspan="6" class="empty">ไม่มีรายการใช้ในเดือนนี้</td></tr>'}</tbody></table>
        <div class="signatures"><div class="signature"><div class="signature-line"></div>ผู้จัดทำรายงาน</div><div class="signature"><div class="signature-line"></div>ผู้ตรวจสอบ</div></div>
        <div class="footer">${isBlankReport ? `ผู้จัดทำ ${escapeHtml(blankReportAuthor) || "______________________________"}` : `รายงานนี้สร้างจากระบบ ERP · ${escapeHtml(currentUser?.name || "")}`}</div>
      </body></html>`);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  }

  async function submitSpool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/filament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spoolForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกม้วนไม่สำเร็จ");
      await reload();
      setUsageForm((form) => ({ ...form, spoolId: data.id }));
      setSpoolForm({ name: "", brand: "", color: "", supplier: "", initialWeightGrams: "1000", purchaseDate: localDateValue() });
      setActivePanel(null);
      setNotice("เพิ่มม้วน Filament แล้ว");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกม้วนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function submitUsage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/filament/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usageForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกการใช้ไม่สำเร็จ");
      await reload();
      setUsageForm((form) => ({ ...form, printJob: "", amountGrams: "" }));
      setActivePanel(null);
      setNotice("บันทึกการใช้ Filament แล้ว");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกการใช้ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="filament-page">
      <style jsx>{`
        .filament-page { color: #263a32; --line: #dce4df; --muted: #687970; }
        .page-head { display: flex; justify-content: space-between; align-items: center; gap: 22px; margin-bottom: 20px; padding: 23px 25px; border-radius: 8px; background: #183e33; color: #fff; }
        .title-cluster { display: flex; align-items: center; gap: 15px; min-width: 0; }
        .title-mark { display: grid; width: 46px; height: 46px; flex: 0 0 46px; place-items: center; border: 1px solid rgba(255,255,255,.22); border-radius: 7px; background: rgba(255,255,255,.1); color: #d7eadf; font-size: 24px; }
        .eyebrow { color: #bdd8ca; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        h2 { margin: 3px 0 0; color: #fff; font-size: 24px; line-height: 1.25; }
        .title-divider { color: #91b5a3; font-weight: 400; }
        .subhead { margin: 5px 0 0; color: #d0e0d7; font-size: 13px; }
        .actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        button { font: inherit; cursor: pointer; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .action { min-height: 39px; border: 1px solid #dce9e1; border-radius: 5px; padding: 9px 12px; background: #dce9e1; color: #183e33; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .action:hover:not(:disabled) { background: #fff; border-color: #fff; transform: translateY(-1px); }
        .action.secondary { border-color: rgba(255,255,255,.34); background: transparent; color: #f5faf7; }
        .action.secondary:hover:not(:disabled) { background: rgba(255,255,255,.12); }
        .action:disabled { opacity: .55; cursor: wait; }
        .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 25px; }
        .metric { min-width: 0; padding: 15px 17px; border: 1px solid var(--line); border-top: 3px solid #2c8a68; border-radius: 6px; background: #fff; }
        .metric:nth-child(2) { border-top-color: #d08a43; }
        .metric:nth-child(3) { border-top-color: #627f9a; }
        .metric-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .metric-label { color: var(--muted); font-size: 12px; font-weight: 600; }
        .metric-icon { display: grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; border-radius: 5px; background: #eaf4ef; color: #2c8a68; font-size: 17px; }
        .metric:nth-child(2) .metric-icon { background: #fbf1e7; color: #b36e2c; }
        .metric:nth-child(3) .metric-icon { background: #edf2f7; color: #55728c; }
        .metric strong { display: block; margin-top: 8px; color: #203a30; font-size: 22px; line-height: 1.2; }
        .section-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 25px 0 11px; }
        .section-title { display: flex; align-items: center; gap: 9px; }
        .section-marker { width: 3px; height: 19px; border-radius: 2px; background: #2c8a68; }
        .section-head h3 { margin: 0; color: #263a32; font-size: 16px; }
        .month-control { display: flex; align-items: center; gap: 9px; color: var(--muted); font-size: 12px; font-weight: 600; }
        input, select { min-width: 0; width: 100%; padding: 10px 11px; border: 1px solid #cbd6ce; border-radius: 5px; background: #fff; color: #253b35; font: inherit; }
        input:focus, select:focus { outline: 2px solid #9ccbb8; outline-offset: 1px; }
        .month-control input { width: auto; min-height: 38px; }
        .form-panel { margin: 0 0 21px; padding: 19px; border: 1px solid var(--line); border-left: 3px solid #2c8a68; border-radius: 6px; background: #fff; box-shadow: 0 5px 18px rgba(30,55,44,.04); }
        .form-panel h3 { margin: 0 0 15px; color: #263a32; font-size: 15px; }
        .form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .field label { display: block; margin-bottom: 6px; color: #52645a; font-size: 12px; font-weight: 700; }
        .field.wide { grid-column: span 2; }
        .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #edf0ed; }
        .cancel { min-height: 38px; border: 1px solid #cbd6ce; border-radius: 5px; padding: 8px 13px; background: #fff; color: #45574e; font-weight: 600; }
        .cancel:hover { background: #f4f7f4; }
        .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
        table { width: 100%; border-collapse: collapse; min-width: 720px; text-align: left; }
        th, td { padding: 11px 13px; border-bottom: 1px solid #e8ede9; vertical-align: middle; }
        th { background: #f4f7f5; color: #5d6d64; font-size: 11px; font-weight: 700; white-space: nowrap; }
        td { color: #34473e; font-size: 12px; }
        tbody tr:last-child td { border-bottom: 0; }
        tbody tr:hover { background: #fafcfb; }
        td strong { color: #253b35; }
        .filament-name { display: flex; align-items: center; gap: 9px; }
        .swatch { width: 16px; height: 16px; flex: 0 0 16px; border: 1px solid rgba(0,0,0,.16); border-radius: 50%; box-shadow: inset 0 0 0 2px rgba(255,255,255,.28); }
        .muted { color: #748179; }
        .empty { padding: 28px 12px; color: #748179; text-align: center; }
        .notice, .error { margin: 0 0 14px; padding: 10px 12px; border-radius: 5px; font-size: 13px; }
        .notice { border: 1px solid #c8e4d3; background: #edf7f0; color: #21623e; }
        .error { border: 1px solid #efd2c5; background: #fff3ed; color: #a43d28; }
        .loading { padding: 35px 0; color: #64736c; text-align: center; }
        @media (max-width: 760px) {
          .page-head { align-items: flex-start; flex-direction: column; padding: 20px; }
          .actions { width: 100%; justify-content: flex-start; }
          .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .blank-editor-meta, .blank-editor-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .field.wide { grid-column: span 2; }
          .section-head { align-items: flex-start; flex-direction: column; }
        }
        @media (max-width: 460px) {
          h2 { font-size: 21px; }
          .title-mark { width: 40px; height: 40px; flex-basis: 40px; font-size: 21px; }
          .title-cluster { align-items: flex-start; }
          .summary { grid-template-columns: 1fr; gap: 8px; }
          .metric { padding: 12px 14px; }
          .metric strong { font-size: 20px; }
          .actions .action { flex: 1 1 calc(50% - 8px); white-space: normal; }
          .form-grid { grid-template-columns: 1fr; }
          .blank-editor-meta, .blank-editor-summary { grid-template-columns: 1fr; }
          .field.wide { grid-column: span 1; }
          .month-control { width: 100%; justify-content: space-between; }
        }
          .report-selector { margin: 0 0 20px; padding: 16px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
          .report-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--line); }
          .report-tab { min-height: 40px; padding: 9px 14px; border: 1px solid transparent; border-bottom: 3px solid transparent; background: transparent; color: #52645a; font-weight: 700; }
          .report-tab[aria-selected="true"] { border-bottom-color: #2c8a68; color: #214b3f; }
          .report-description { margin: 11px 0 0; color: var(--muted); font-size: 13px; }
          .blank-editor { margin: 0 0 22px; padding: 18px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
          .blank-editor h3 { margin: 0; color: #263a32; font-size: 16px; }
          .blank-editor-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
          .blank-editor-meta, .blank-editor-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
          .blank-editor .field label { display: block; margin-bottom: 6px; color: #52645a; font-size: 12px; font-weight: 700; }
          .blank-editor .field input { min-height: 38px; }
          .blank-table { overflow-x: auto; margin-bottom: 18px; border: 1px solid var(--line); border-radius: 6px; }
          .blank-table table { min-width: 900px; }
          .blank-table input { min-width: 90px; padding: 7px; }
          .blank-table .number-input { min-width: 80px; }
          .row-actions { width: 1%; white-space: nowrap; }
          .row-delete { border: 1px solid #e7c7c0; border-radius: 4px; padding: 6px 9px; background: #fff5f2; color: #a43d28; font-weight: 700; }
          .add-row { margin-top: 10px; border: 1px solid #cbd6ce; border-radius: 5px; padding: 8px 12px; background: #fff; color: #214b3f; font-weight: 700; }
          :global(body.dark) .filament-page { color: #e4ede7; --line: #33473d; --muted: #a5b7ad; }
          :global(body.dark) .page-head { background: #17372e; }
          :global(body.dark) .metric, :global(body.dark) .form-panel, :global(body.dark) .table-wrap { background: #14231e; border-color: #33473d; }
          :global(body.dark) .report-selector { background: #14231e; border-color: #33473d; }
          :global(body.dark) .report-tab { color: #a5b7ad; }
          :global(body.dark) .report-tab[aria-selected="true"] { color: #d6eee1; border-bottom-color: #4ca882; }
          :global(body.dark) .blank-editor, :global(body.dark) .blank-table { background: #14231e; border-color: #33473d; }
          :global(body.dark) .blank-editor h3 { color: #d6eee1; }
          :global(body.dark) .blank-editor .field label { color: #a5b7ad; }
          :global(body.dark) .row-delete { background: #422a22; border-color: #684133; color: #ffc4aa; }
          :global(body.dark) .add-row { background: #1e3028; border-color: #485e52; color: #d6eee1; }
        :global(body.dark) .metric { border-top-color: #4ca882; }
        :global(body.dark) .metric:nth-child(2) { border-top-color: #d08a43; }
        :global(body.dark) .metric:nth-child(3) { border-top-color: #7897b3; }
        :global(body.dark) .metric strong, :global(body.dark) td strong, :global(body.dark) .section-head h3, :global(body.dark) .form-panel h3 { color: #d6eee1; }
        :global(body.dark) .metric-icon { background: #1c3b30; color: #81c7a7; }
        :global(body.dark) .metric:nth-child(2) .metric-icon { background: #3c3021; color: #e6b174; }
        :global(body.dark) .metric:nth-child(3) .metric-icon { background: #253547; color: #9eb5ca; }
        :global(body.dark) .metric-label, :global(body.dark) .subhead, :global(body.dark) th, :global(body.dark) .muted { color: #a5b7ad; }
        :global(body.dark) input, :global(body.dark) select, :global(body.dark) .cancel { background: #1e3028; border-color: #485e52; color: #e4ede7; }
        :global(body.dark) th { background: #1b3027; }
        :global(body.dark) td { color: #d3e0d8; border-color: #33473d; }
        :global(body.dark) tbody tr:hover { background: #1a3027; }
        :global(body.dark) .form-actions { border-color: #33473d; }
        :global(body.dark) .notice { background: #193628; border-color: #335c45; color: #b7e2c6; }
        :global(body.dark) .error { background: #422a22; border-color: #684133; color: #ffc4aa; }
      `}</style>

      <header className="page-head">
        <div className="title-cluster">
          <div className="title-mark"><i className="bx bx-cube" aria-hidden="true" /></div>
          <div>
            <span className="eyebrow">Production material control</span>
            <h2>พิมพ์ 3D <span className="title-divider">/</span> Filament</h2>
            <p className="subhead">ควบคุมสต็อกเส้นพลาสติกและติดตามการใช้ในแต่ละงาน</p>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="action secondary" onClick={handlePrintReport} disabled={loading && reportType === "data"}><i className="bx bx-printer" aria-hidden="true" /> {reportType === "data" ? "พิมพ์รายงาน / บันทึก PDF" : "พิมพ์รายงานที่กรอก"}</button>
          <button type="button" className="action secondary" onClick={() => setActivePanel(activePanel === "spool" ? null : "spool")}>+ เพิ่มม้วน</button>
          <button type="button" className="action" onClick={() => setActivePanel(activePanel === "usage" ? null : "usage")} disabled={spools.length === 0}>บันทึกการใช้</button>
        </div>
      </header>

      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <section className="report-selector" aria-label="เลือกรูปแบบรายงาน">
        <div className="report-tabs" role="tablist" aria-label="รูปแบบรายงาน Filament 3D">
          <button
            type="button"
            role="tab"
            aria-selected={reportType === "data"}
            className="report-tab"
            onClick={() => setReportType("data")}
          >
            รายงานจากข้อมูล
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={reportType === "blank"}
            className="report-tab"
            onClick={() => setReportType("blank")}
          >
            กรอกรายงานเอง
          </button>
        </div>
        <p className="report-description" role="tabpanel">
          {reportType === "data"
            ? `พิมพ์สรุปข้อมูลม้วนและประวัติการใช้จริง ประจำเดือน ${formatMonth(selectedMonth)}`
            : `กรอกข้อมูลรายงานประจำเดือน ${formatMonth(selectedMonth)} ในตารางด้านล่าง แล้วกดพิมพ์รายงานที่กรอก`}
        </p>
      </section>

      {reportType === "blank" && (
        <section className="blank-editor" aria-label="กรอกข้อมูลรายงาน Filament 3D">
          <div className="blank-editor-head">
            <div>
              <h3>กรอกข้อมูลรายงาน</h3>
              <p className="report-description">ใส่ข้อมูลในช่องตารางโดยตรง คล้ายหน้าบันทึกข้อมูลเครื่องจักร</p>
            </div>
          </div>

          <div className="blank-editor-meta">
            <div className="field">
              <label htmlFor="blank-report-date">วันที่จัดทำ</label>
              <input id="blank-report-date" type="date" value={blankReportDate} onChange={(event) => setBlankReportDate(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="blank-report-author">ผู้จัดทำรายงาน</label>
              <input id="blank-report-author" value={blankReportAuthor} onChange={(event) => setBlankReportAuthor(event.target.value)} placeholder="ชื่อผู้จัดทำ" />
            </div>
          </div>

          <h3 style={{ marginBottom: 10 }}>สรุปยอดรวม</h3>
          <div className="blank-editor-summary">
            <div className="field">
              <label htmlFor="blank-monthly-total">ใช้ในเดือนนี้ (กรัม)</label>
              <input id="blank-monthly-total" type="number" min="0" step="0.1" value={blankSummary.monthly} onChange={(event) => setBlankSummary({ ...blankSummary, monthly: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="blank-remaining-total">คงเหลือทุกม้วน (กรัม)</label>
              <input id="blank-remaining-total" type="number" min="0" step="0.1" value={blankSummary.remaining} onChange={(event) => setBlankSummary({ ...blankSummary, remaining: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="blank-all-time-total">ใช้สะสมทั้งหมด (กรัม)</label>
              <input id="blank-all-time-total" type="number" min="0" step="0.1" value={blankSummary.total} onChange={(event) => setBlankSummary({ ...blankSummary, total: event.target.value })} />
            </div>
          </div>

          <div className="blank-editor-head">
            <h3>สรุปยอดรายม้วน</h3>
            <button type="button" className="add-row" onClick={() => setBlankSpoolRows((rows) => [...rows, createBlankSpoolRow(Math.max(0, ...rows.map((row) => row.id)) + 1)])}>+ เพิ่มแถวม้วน</button>
          </div>
          <div className="blank-table">
            <table>
              <thead><tr><th>ชนิด / ยี่ห้อ</th><th>สี</th><th>ซื้อจาก</th><th>น้ำหนักตั้งต้น (กรัม)</th><th>ใช้เดือนนี้ (กรัม)</th><th>ใช้สะสม (กรัม)</th><th>คงเหลือ (กรัม)</th><th>จัดการ</th></tr></thead>
              <tbody>
                {blankSpoolRows.map((row) => (
                  <tr key={row.id}>
                    <td><input aria-label="ชนิดหรือยี่ห้อ Filament" value={row.name} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item))} /></td>
                    <td><input aria-label="สี Filament" value={row.color} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, color: event.target.value } : item))} /></td>
                    <td><input aria-label="ร้านที่ซื้อ Filament" value={row.supplier} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, supplier: event.target.value } : item))} /></td>
                    <td><input className="number-input" aria-label="น้ำหนักตั้งต้น" type="number" min="0" step="0.1" value={row.initialWeight} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, initialWeight: event.target.value } : item))} /></td>
                    <td><input className="number-input" aria-label="ปริมาณใช้เดือนนี้" type="number" min="0" step="0.1" value={row.monthlyUsage} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, monthlyUsage: event.target.value } : item))} /></td>
                    <td><input className="number-input" aria-label="ปริมาณใช้สะสม" type="number" min="0" step="0.1" value={row.totalUsage} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, totalUsage: event.target.value } : item))} /></td>
                    <td><input className="number-input" aria-label="น้ำหนักคงเหลือ" type="number" min="0" step="0.1" value={row.remainingWeight} onChange={(event) => setBlankSpoolRows(blankSpoolRows.map((item) => item.id === row.id ? { ...item, remainingWeight: event.target.value } : item))} /></td>
                    <td className="row-actions"><button type="button" className="row-delete" aria-label="ลบแถวม้วน" onClick={() => setBlankSpoolRows(blankSpoolRows.filter((item) => item.id !== row.id))}>ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="blank-editor-head">
            <h3>รายละเอียดการใช้ประจำเดือน</h3>
            <button type="button" className="add-row" onClick={() => setBlankUsageRows((rows) => [...rows, createBlankUsageRow(Math.max(0, ...rows.map((row) => row.id)) + 1)])}>+ เพิ่มรายการใช้</button>
          </div>
          <div className="blank-table">
            <table>
              <thead><tr><th>วันที่</th><th>ม้วน / ยี่ห้อ</th><th>สี</th><th>งานที่พิมพ์</th><th>น้ำหนักที่ใช้ (กรัม)</th><th>ผู้ใช้ / ผู้ลงชื่อ</th><th>จัดการ</th></tr></thead>
              <tbody>
                {blankUsageRows.map((row) => (
                  <tr key={row.id}>
                    <td><input aria-label="วันที่ใช้" type="date" value={row.date} onChange={(event) => setBlankUsageRows(blankUsageRows.map((item) => item.id === row.id ? { ...item, date: event.target.value } : item))} /></td>
                    <td><input aria-label="ม้วน Filament ที่ใช้" value={row.spool} onChange={(event) => setBlankUsageRows(blankUsageRows.map((item) => item.id === row.id ? { ...item, spool: event.target.value } : item))} /></td>
                    <td><input aria-label="สีม้วน Filament" value={row.color} onChange={(event) => setBlankUsageRows(blankUsageRows.map((item) => item.id === row.id ? { ...item, color: event.target.value } : item))} /></td>
                    <td><input aria-label="งานที่พิมพ์" value={row.printJob} onChange={(event) => setBlankUsageRows(blankUsageRows.map((item) => item.id === row.id ? { ...item, printJob: event.target.value } : item))} /></td>
                    <td><input className="number-input" aria-label="น้ำหนัก Filament ที่ใช้" type="number" min="0" step="0.1" value={row.amount} onChange={(event) => setBlankUsageRows(blankUsageRows.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} /></td>
                    <td><input aria-label="ผู้ใช้ Filament" value={row.usedBy} onChange={(event) => setBlankUsageRows(blankUsageRows.map((item) => item.id === row.id ? { ...item, usedBy: event.target.value } : item))} /></td>
                    <td className="row-actions"><button type="button" className="row-delete" aria-label="ลบรายการใช้" onClick={() => setBlankUsageRows(blankUsageRows.filter((item) => item.id !== row.id))}>ลบ</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activePanel === "spool" && (
        <form className="form-panel" onSubmit={submitSpool}>
          <h3>เพิ่มม้วน Filament</h3>
          <div className="form-grid">
            <div className="field"><label htmlFor="filament-name">ชนิด Filament</label><input id="filament-name" value={spoolForm.name} onChange={(event) => setSpoolForm({ ...spoolForm, name: event.target.value })} placeholder="เช่น PLA, PETG" required /></div>
            <div className="field"><label htmlFor="filament-brand">ยี่ห้อ</label><input id="filament-brand" value={spoolForm.brand} onChange={(event) => setSpoolForm({ ...spoolForm, brand: event.target.value })} placeholder="ระบุยี่ห้อ" /></div>
            <div className="field"><label htmlFor="filament-color">สี</label><input id="filament-color" value={spoolForm.color} onChange={(event) => setSpoolForm({ ...spoolForm, color: event.target.value })} placeholder="เช่น ดำด้าน" required /></div>
            <div className="field"><label htmlFor="filament-supplier">ซื้อจาก</label><input id="filament-supplier" value={spoolForm.supplier} onChange={(event) => setSpoolForm({ ...spoolForm, supplier: event.target.value })} placeholder="ชื่อร้าน/ผู้ขาย" required /></div>
            <div className="field"><label htmlFor="filament-weight">น้ำหนักม้วนเริ่มต้น (กรัม)</label><input id="filament-weight" type="number" min="0.1" step="0.1" value={spoolForm.initialWeightGrams} onChange={(event) => setSpoolForm({ ...spoolForm, initialWeightGrams: event.target.value })} required /></div>
            <div className="field"><label htmlFor="filament-purchase-date">วันที่ซื้อ</label><input id="filament-purchase-date" type="date" value={spoolForm.purchaseDate} onChange={(event) => setSpoolForm({ ...spoolForm, purchaseDate: event.target.value })} required /></div>
          </div>
          <div className="form-actions"><button type="button" className="cancel" onClick={() => setActivePanel(null)}>ยกเลิก</button><button className="action" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกม้วน"}</button></div>
        </form>
      )}

      {activePanel === "usage" && (
        <form className="form-panel" onSubmit={submitUsage}>
          <h3>บันทึกการใช้ Filament</h3>
          <div className="form-grid">
            <div className="field"><label htmlFor="usage-spool">ม้วนที่ใช้</label><select id="usage-spool" value={usageForm.spoolId} onChange={(event) => setUsageForm({ ...usageForm, spoolId: event.target.value })} required><option value="">เลือกม้วน</option>{spools.map((spool) => <option key={spool.id} value={spool.id}>{spool.name}{spool.brand ? ` · ${spool.brand}` : ""} · {spool.color} (เหลือ {formatGrams(spool.remainingWeightGrams)})</option>)}</select></div>
            <div className="field wide"><label htmlFor="usage-job">งานที่พิมพ์</label><input id="usage-job" value={usageForm.printJob} onChange={(event) => setUsageForm({ ...usageForm, printJob: event.target.value })} placeholder="ชิ้นงาน/รหัสงาน" required /></div>
            <div className="field"><label htmlFor="usage-weight">น้ำหนักที่ใช้ (กรัม)</label><input id="usage-weight" type="number" min="0.1" step="0.1" value={usageForm.amountGrams} onChange={(event) => setUsageForm({ ...usageForm, amountGrams: event.target.value })} required /></div>
            <div className="field"><label htmlFor="usage-date">วันที่ใช้</label><input id="usage-date" type="date" value={usageForm.usedAt} onChange={(event) => setUsageForm({ ...usageForm, usedAt: event.target.value })} required /></div>
            <div className="field"><label>ผู้บันทึก / ผู้ใช้</label><input value={currentUser?.name || "กำลังโหลด..."} readOnly /></div>
          </div>
          <div className="form-actions"><button type="button" className="cancel" onClick={() => setActivePanel(null)}>ยกเลิก</button><button className="action" type="submit" disabled={saving || spools.length === 0}>{saving ? "กำลังบันทึก..." : "ยืนยันการใช้"}</button></div>
        </form>
      )}

      <div className="summary" aria-label="สรุปการใช้ Filament">
        <div className="metric"><div className="metric-top"><span className="metric-label">ใช้รวม · {formatMonth(selectedMonth)}</span><span className="metric-icon"><i className="bx bx-calendar-check" aria-hidden="true" /></span></div><strong>{formatGrams(monthlyGrams)}</strong></div>
        <div className="metric"><div className="metric-top"><span className="metric-label">คงเหลือทุกม้วน</span><span className="metric-icon"><i className="bx bx-package" aria-hidden="true" /></span></div><strong>{formatGrams(remainingGrams)}</strong></div>
        <div className="metric"><div className="metric-top"><span className="metric-label">ใช้สะสมทุกม้วน</span><span className="metric-icon"><i className="bx bx-trending-up" aria-hidden="true" /></span></div><strong>{formatGrams(allTimeGrams)}</strong></div>
      </div>

      <div className="section-head">
        <div className="section-title"><span className="section-marker" /><h3>ม้วน Filament <span className="muted">({spools.length})</span></h3></div>
        <label className="month-control" htmlFor="usage-month">สรุปประจำเดือน <input id="usage-month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
      </div>
      {loading ? <div className="loading">กำลังโหลดข้อมูล...</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ชนิด / สี</th><th>ซื้อจาก</th><th>วันที่ซื้อ</th><th>น้ำหนักตั้งต้น</th><th>ใช้รวมม้วนนี้</th><th>คงเหลือ</th></tr></thead>
            <tbody>
              {spools.map((spool) => {
                const used = spool.initialWeightGrams - spool.remainingWeightGrams;
                return <tr key={spool.id}>
                  <td><div className="filament-name"><span className="swatch" style={{ backgroundColor: spool.color }} /><span><strong>{spool.name}{spool.brand ? ` · ${spool.brand}` : ""}</strong><br /><span className="muted">{spool.color}</span></span></div></td>
                  <td>{spool.supplier}</td><td>{formatDate(spool.purchaseDate)}</td><td>{formatGrams(spool.initialWeightGrams)}</td><td><strong>{formatGrams(used)}</strong></td><td>{formatGrams(spool.remainingWeightGrams)}</td>
                </tr>;
              })}
              {spools.length === 0 && <tr><td colSpan={6} className="empty">ยังไม่มีม้วน Filament เพิ่มม้วนแรกเพื่อเริ่มบันทึก</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-head"><div className="section-title"><span className="section-marker" /><h3>ประวัติการใช้ <span className="muted">({monthUsages.length})</span></h3></div><span className="muted">รวมเดือนนี้: <strong>{formatGrams(monthlyGrams)}</strong></span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>วันที่</th><th>ม้วน / สี</th><th>งานที่พิมพ์</th><th>น้ำหนักที่ใช้</th><th>ผู้ใช้ / ผู้ลงชื่อ</th></tr></thead>
          <tbody>
            {monthUsages.map((usage) => <tr key={usage.id}>
              <td>{formatDate(usage.usedAt)}</td><td><div className="filament-name"><span className="swatch" style={{ backgroundColor: usage.spool.color }} /><span>{usage.spool.name} · {usage.spool.color}</span></div></td><td><strong>{usage.printJob}</strong></td><td>{formatGrams(usage.amountGrams)}</td><td>{usage.usedBy}</td>
            </tr>)}
            {monthUsages.length === 0 && <tr><td colSpan={5} className="empty">ไม่มีรายการใช้ในเดือนที่เลือก</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
