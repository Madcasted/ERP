"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductionRow = {
  id: string;
  date: string;
  rollNo: string;
  matWeight: string;
  timeOpen: string;
  timeClose: string;
  timeTotal: string;
  goodQty: string;
  rejectQty: string;
  totalQty: string;
  staff1: string;
  staff2: string;
  rejectBy: string;
  rejectCount: string;
};

type TimeDelaySettings = {
  delayPrintBottomUp: string;
  delayPrintTopDown: string;
  delayPrintTopUp: string;
  delayVac1On: string;
  delayVac1Off: string;
  delayVac2On: string;
  delayVac2Off: string;
  delayFanOn: string;
  delayFanOff: string;
  blowOn: string;
  blowOff: string;
  delayOpen: string;
  delayHeat: string;
  openHeatShield: string;
  unwind: string;
  setSpeed: string;
  setLength: string;
  programNo: string;
};

type HeatRow = {
  id: string;
  rowLabel: string;
  heater1: string;
  heater2: string;
  heater3: string;
  heater4: string;
  heater5: string;
  heater6: string;
  heater7: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_TIME_DELAYS: TimeDelaySettings = {
  delayPrintBottomUp: "0",
  delayPrintTopDown: "0",
  delayPrintTopUp: "2",
  delayVac1On: "0",
  delayVac1Off: "9",
  delayVac2On: "0",
  delayVac2Off: "8",
  delayFanOn: "0",
  delayFanOff: "8.5",
  blowOn: "0.2",
  blowOff: "0.2",
  delayOpen: "2",
  delayHeat: "0",
  openHeatShield: "",
  unwind: "0.5",
  setSpeed: "450",
  setLength: "340",
  programNo: "1",
};

const DEFAULT_HEAT_ROW: HeatRow = {
  id: "",
  rowLabel: "แถวใหม่",
  heater1: "0",
  heater2: "0",
  heater3: "0",
  heater4: "-",
  heater5: "-",
  heater6: "-",
  heater7: "-",
};

const INITIAL_HEAT_ROWS: HeatRow[] = [
  { id: "hr-1", rowLabel: "แถวที่ 1", heater1: "700", heater2: "700", heater3: "700", heater4: "-", heater5: "-", heater6: "-", heater7: "-" },
  { id: "hr-2", rowLabel: "แถวที่ 2", heater1: "530", heater2: "540", heater3: "540", heater4: "-", heater5: "-", heater6: "-", heater7: "-" },
  { id: "hr-3", rowLabel: "แถวที่ 3", heater1: "480", heater2: "540", heater3: "540", heater4: "-", heater5: "-", heater6: "-", heater7: "-" },
  { id: "hr-4", rowLabel: "แถวที่ 4", heater1: "480", heater2: "540", heater3: "540", heater4: "-", heater5: "-", heater6: "-", heater7: "-" },
  { id: "hr-5", rowLabel: "แถวที่ 5", heater1: "530", heater2: "540", heater3: "540", heater4: "-", heater5: "-", heater6: "-", heater7: "-" },
  { id: "hr-6", rowLabel: "แถวที่ 6", heater1: "700", heater2: "700", heater3: "700", heater4: "-", heater5: "-", heater6: "-", heater7: "-" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  machineId: string;
  machineName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTimeTotal(open: string, close: string): string {
  const o = parseFloat(open);
  const c = parseFloat(close);
  if (isNaN(o) || isNaN(c)) return "";
  const diff = c - o;
  return diff >= 0 ? diff.toFixed(2) : "";
}

function calcQtyTotal(good: string, reject: string): string {
  const g = parseInt(good) || 0;
  const r = parseInt(reject) || 0;
  return (g + r).toString();
}

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px", border: "none", borderRadius: 6, fontSize: 14,
  fontWeight: 700, cursor: "pointer", fontFamily: "'Sarabun', 'Prompt', sans-serif",
};

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "4px 8px", border: "1px solid #999", borderRadius: 3,
  fontSize: 13, fontFamily: "'Sarabun', 'Prompt', sans-serif", background: "#fff",
  color: "#222", outline: "none", boxSizing: "border-box",
};

const inputCellStyle: React.CSSProperties = {
  width: "100%", padding: "2px 4px", border: "1px solid #aaa", borderRadius: 2,
  fontSize: 12, fontFamily: "'Sarabun', 'Prompt', sans-serif", background: "#fff",
  color: "#222", outline: "none", textAlign: "center" as const, boxSizing: "border-box",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VaccumMachineSettings({ machineId, machineName }: Props) {
  const [headerProduct, setHeaderProduct] = useState("");
  const [headerMat, setHeaderMat] = useState("800");
  const [headerCompany, setHeaderCompany] = useState("เจินหยง");
  const [rows, setRows] = useState<ProductionRow[]>([]);
  
  // Multiple time delay presets
  const [timeDelayPresets, setTimeDelayPresets] = useState<TimeDelaySettings[]>([]);
  const [activeTimeDelayPreset, setActiveTimeDelayPreset] = useState(0);
  
  const [heatRows, setHeatRows] = useState<HeatRow[]>(INITIAL_HEAT_ROWS);
  const [footerRecorder, setFooterRecorder] = useState("B");
  const [footerDate, setFooterDate] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProductionRow | null>(null);
  const [formData, setFormData] = useState<ProductionRow>({
    id: "", date: "", rollNo: "", matWeight: "", timeOpen: "", timeClose: "",
    timeTotal: "", goodQty: "", rejectQty: "", totalQty: "",
    staff1: "", staff2: "", rejectBy: "", rejectCount: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ── Load data from DB ───────────────────────────────────────────────────────

  const loadLogs = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/machine-logs?machineId=${machineId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Convert DB logs to UI rows
        const uiRows: ProductionRow[] = data.map((log: any) => ({
          id: log.id,
          date: log.logDate ? new Date(log.logDate).toLocaleDateString("th-TH") : "",
          rollNo: String(log.rollNo || ""),
          matWeight: log.matWeight?.toString() || "",
          timeOpen: log.timeOpen?.toString() || "",
          timeClose: log.timeClose?.toString() || "",
          timeTotal: (log.timeClose != null && log.timeOpen != null)
            ? (parseFloat(log.timeClose) - parseFloat(log.timeOpen)).toFixed(2)
            : "",
          goodQty: String(log.goodPcs || ""),
          rejectQty: String(log.defectPcs || ""),
          totalQty: String((log.goodPcs || 0) + (log.defectPcs || 0)),
          staff1: log.operator1 || "",
          staff2: log.operator2 || "",
          rejectBy: log.returnedBy || "",
          rejectCount: log.returnedQty?.toString() || "",
        }));
        setRows(uiRows);

        // Restore header from latest log
        const latest = data[0];
        if (latest) {
          setHeaderProduct(latest.productName || "");
          setHeaderMat(latest.matCode || "800");
          setHeaderCompany(latest.company || "เจินหยง");
          setFooterRecorder(latest.recordedBy || "B");
          setFooterDate(latest.recordedAt ? new Date(latest.recordedAt).toLocaleDateString("th-TH") : "");

          // Restore time delay settings as first preset
          setTimeDelayPresets([{
            delayPrintBottomUp: latest.timerPrintDown != null ? String(latest.timerPrintDown) : "0",
            delayPrintTopDown: latest.timerPrintUp != null ? String(latest.timerPrintUp) : "0",
            delayPrintTopUp: latest.timerPrintTop != null ? String(latest.timerPrintTop) : "2",
            delayVac1On: latest.timerOpenVac1 != null ? String(latest.timerOpenVac1) : "0",
            delayVac1Off: latest.timerCloseVac1 != null ? String(latest.timerCloseVac1) : "9",
            delayVac2On: latest.timerOpenVac2 != null ? String(latest.timerOpenVac2) : "0",
            delayVac2Off: latest.timerCloseVac2 != null ? String(latest.timerCloseVac2) : "8",
            delayFanOn: latest.timerOpenFan != null ? String(latest.timerOpenFan) : "0",
            delayFanOff: latest.timerCloseFan != null ? String(latest.timerCloseFan) : "8.5",
            blowOn: latest.timerOpenBlow != null ? String(latest.timerOpenBlow) : "0.2",
            blowOff: latest.timerCloseBlow != null ? String(latest.timerCloseBlow) : "0.2",
            delayOpen: latest.timerOpenHeat != null ? String(latest.timerOpenHeat) : "2",
            delayHeat: latest.timerHeat != null ? String(latest.timerHeat) : "0",
            openHeatShield: latest.timerOpenShield != null ? String(latest.timerOpenShield) : "",
            unwind: latest.unrollSpeed != null ? String(latest.unrollSpeed) : "0.5",
            setSpeed: latest.runSpeed != null ? String(latest.runSpeed) : "450",
            setLength: latest.runLength != null ? String(latest.runLength) : "340",
            programNo: latest.programNo != null ? String(latest.programNo) : "1",
          }]);

          // Restore heat settings
          if (latest.heat) {
            try {
              const heatData = typeof latest.heat === "string" ? JSON.parse(latest.heat) : latest.heat;
              if (Array.isArray(heatData) && heatData.length > 0) {
                // Ensure each heat row has an id
                const withIds = heatData.map((h: any, i: number) => ({
                  ...h,
                  id: h.id || `hr-${i}-${Date.now()}`,
                }));
                setHeatRows(withIds);
              }
            } catch (e) {
              // ignore parse error
            }
          }
        }
      } else {
        // No data - use defaults
        setTimeDelayPresets([{ ...INITIAL_TIME_DELAYS }]);
      }
    } catch (e) {
      console.error("Failed to load machine logs:", e);
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    if (machineId) loadLogs();
  }, [machineId, loadLogs]);

  // Set default footer date
  useEffect(() => {
    if (!footerDate) {
      setFooterDate(new Date().toLocaleDateString("th-TH"));
    }
  }, []);

  // Init time delays if empty
  useEffect(() => {
    if (timeDelayPresets.length === 0) {
      setTimeDelayPresets([{ ...INITIAL_TIME_DELAYS }]);
    }
  }, [timeDelayPresets.length]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  // ── Save all settings to DB ─────────────────────────────────────────────────

  async function saveToDatabase() {
    if (!machineId) return;
    setSaving(true);
    try {
      // Save the latest row as a single machine log entry with all settings
      const latestRow = rows.length > 0 ? rows[0] : null;
      const activeDelay = timeDelayPresets[activeTimeDelayPreset] || timeDelayPresets[0] || INITIAL_TIME_DELAYS;

      const heatJson = JSON.stringify(heatRows);

      const payload = {
        machineId,
        productName: headerProduct,
        matCode: headerMat,
        company: headerCompany,
        rollNo: latestRow ? parseInt(latestRow.rollNo) || 0 : 0,
        matWeight: latestRow ? parseFloat(latestRow.matWeight) || null : null,
        timeOpen: latestRow ? parseFloat(latestRow.timeOpen) || null : null,
        timeClose: latestRow ? parseFloat(latestRow.timeClose) || null : null,
        goodPcs: latestRow ? parseInt(latestRow.goodQty) || 0 : 0,
        defectPcs: latestRow ? parseInt(latestRow.rejectQty) || 0 : 0,
        operator1: latestRow?.staff1 || null,
        operator2: latestRow?.staff2 || null,
        returnedBy: latestRow?.rejectBy || null,
        returnedQty: latestRow ? parseInt(latestRow.rejectCount) || null : null,
        timerPrintDown: parseFloat(activeDelay.delayPrintBottomUp) || null,
        timerPrintUp: parseFloat(activeDelay.delayPrintTopDown) || null,
        timerPrintTop: parseFloat(activeDelay.delayPrintTopUp) || null,
        timerOpenVac1: parseFloat(activeDelay.delayVac1On) || null,
        timerCloseVac1: parseFloat(activeDelay.delayVac1Off) || null,
        timerOpenVac2: parseFloat(activeDelay.delayVac2On) || null,
        timerCloseVac2: parseFloat(activeDelay.delayVac2Off) || null,
        timerOpenFan: parseFloat(activeDelay.delayFanOn) || null,
        timerCloseFan: parseFloat(activeDelay.delayFanOff) || null,
        timerOpenBlow: parseFloat(activeDelay.blowOn) || null,
        timerCloseBlow: parseFloat(activeDelay.blowOff) || null,
        timerOpenHeat: parseFloat(activeDelay.delayOpen) || null,
        timerHeat: parseFloat(activeDelay.delayHeat) || null,
        timerOpenShield: activeDelay.openHeatShield ? parseFloat(activeDelay.openHeatShield) || null : null,
        unrollSpeed: parseFloat(activeDelay.unwind) || null,
        runSpeed: parseFloat(activeDelay.setSpeed) || null,
        runLength: parseFloat(activeDelay.setLength) || null,
        programNo: activeDelay.programNo ? parseInt(activeDelay.programNo) || null : null,
        heat: heatJson,
        recordedBy: footerRecorder || null,
        recordedAt: footerDate ? new Date() : null,
        logDate: footerDate ? new Date() : new Date(),
      };

      const res = await fetch("/api/machine-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");

      showToast("บันทึกข้อมูลสำเร็จ ✓");
      await loadLogs();
    } catch (e) {
      console.error("Save error:", e);
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  // ── Modal handlers ──

  function openAddModal() {
    setEditingRow(null);
    setFormData({
      id: Date.now().toString(), date: "", rollNo: "", matWeight: "",
      timeOpen: "", timeClose: "", timeTotal: "", goodQty: "", rejectQty: "",
      totalQty: "", staff1: "", staff2: "", rejectBy: "", rejectCount: "",
    });
    setFormErrors({});
    setModalOpen(true);
  }

  function openEditModal(row: ProductionRow) {
    setEditingRow(row);
    setFormData({ ...row });
    setFormErrors({});
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRow(null);
    setFormErrors({});
  }

  function handleFormChange(field: keyof ProductionRow, value: string) {
    const updated = { ...formData, [field]: value };
    if (field === "timeOpen" || field === "timeClose") {
      updated.timeTotal = calcTimeTotal(
        field === "timeOpen" ? value : formData.timeOpen,
        field === "timeClose" ? value : formData.timeClose
      );
    }
    if (field === "goodQty" || field === "rejectQty") {
      updated.totalQty = calcQtyTotal(
        field === "goodQty" ? value : formData.goodQty,
        field === "rejectQty" ? value : formData.rejectQty
      );
    }
    setFormData(updated);
    if (formErrors[field]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.date.trim()) errors.date = "กรุณากรอกวันที่";
    if (!formData.rollNo.trim()) errors.rollNo = "กรุณากรอกม้วนที่";
    if (!formData.matWeight.trim()) errors.matWeight = "กรุณากรอกน้ำหนัก Mat";
    if (!formData.timeOpen.trim()) errors.timeOpen = "กรุณากรอกเวลาเปิด";
    if (!formData.timeClose.trim()) errors.timeClose = "กรุณากรอกเวลาปิด";
    if (!formData.goodQty.trim()) errors.goodQty = "กรุณากรอกจำนวนชิ้นดี";
    if (!formData.rejectQty.trim()) errors.rejectQty = "กรุณากรอกจำนวนเสีย";
    if (formData.matWeight && isNaN(parseFloat(formData.matWeight))) errors.matWeight = "ต้องเป็นตัวเลขเท่านั้น";
    if (formData.timeOpen && isNaN(parseFloat(formData.timeOpen))) errors.timeOpen = "ต้องเป็นตัวเลขเท่านั้น";
    if (formData.timeClose && isNaN(parseFloat(formData.timeClose))) errors.timeClose = "ต้องเป็นตัวเลขเท่านั้น";
    if (formData.goodQty && isNaN(parseInt(formData.goodQty))) errors.goodQty = "ต้องเป็นตัวเลขเท่านั้น";
    if (formData.rejectQty && isNaN(parseInt(formData.rejectQty))) errors.rejectQty = "ต้องเป็นตัวเลขเท่านั้น";
    if (formData.rejectCount && isNaN(parseInt(formData.rejectCount))) errors.rejectCount = "ต้องเป็นตัวเลขเท่านั้น";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function saveRow() {
    if (!validateForm()) return;
    const finalData = {
      ...formData,
      timeTotal: calcTimeTotal(formData.timeOpen, formData.timeClose),
      totalQty: calcQtyTotal(formData.goodQty, formData.rejectQty),
    };
    if (editingRow) {
      setRows((prev) => prev.map((r) => (r.id === editingRow.id ? finalData : r)));
    } else {
      finalData.id = Date.now().toString();
      setRows((prev) => [...prev, finalData]);
    }
    closeModal();
  }

  // ── Time Delay presets handlers ──

  function getCurrentTimeDelays(): TimeDelaySettings {
    return timeDelayPresets[activeTimeDelayPreset] || timeDelayPresets[0] || INITIAL_TIME_DELAYS;
  }

  function handleTimeDelayChange(field: keyof TimeDelaySettings, value: string) {
    setTimeDelayPresets((prev) => {
      const updated = [...prev];
      updated[activeTimeDelayPreset] = { ...updated[activeTimeDelayPreset], [field]: value };
      return updated;
    });
  }

  function addTimeDelayPreset() {
    const newPreset: TimeDelaySettings = { ...INITIAL_TIME_DELAYS };
    setTimeDelayPresets((prev) => [...prev, newPreset]);
    setActiveTimeDelayPreset(timeDelayPresets.length);
  }

  function deleteTimeDelayPreset(index: number) {
    if (timeDelayPresets.length <= 1) return;
    setTimeDelayPresets((prev) => prev.filter((_, i) => i !== index));
    if (activeTimeDelayPreset >= index) {
      setActiveTimeDelayPreset(Math.max(0, activeTimeDelayPreset - 1));
    }
  }

  // ── Heat row handlers ──

  function handleHeatChange(rowIndex: number, field: keyof HeatRow, value: string) {
    setHeatRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  }

  function addHeatRow() {
    const newId = `hr-${Date.now()}`;
    const newRow: HeatRow = { ...DEFAULT_HEAT_ROW, id: newId, rowLabel: `แถวที่ ${heatRows.length + 1}` };
    setHeatRows((prev) => [...prev, newRow]);
  }

  function deleteHeatRow(id: string) {
    if (heatRows.length <= 1) return;
    setDeleteConfirm(id);
  }

  function confirmDeleteHeatRow(id: string) {
    setHeatRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      // Re-label rows
      return filtered.map((r, i) => ({ ...r, rowLabel: `แถวที่ ${i + 1}` }));
    });
    setDeleteConfirm(null);
  }

  // ── Render ──

  const currentTimeDelays = getCurrentTimeDelays();

  return (
    <>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "12px 24px", borderRadius: 12,
          background: toastMsg.includes("ไม่สำเร็จ") ? "#dc2626" : "#16a34a",
          color: "white", fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          animation: "fadeIn 0.3s ease",
        }}>{toastMsg}</div>
      )}

      {/* Saving overlay */}
      {saving && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 8000,
        }}>
          <div style={{ background: "white", borderRadius: 16, padding: "24px 40px", fontWeight: 700 }}>
            กำลังบันทึก...
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─── */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 2000, padding: 16,
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 32, maxWidth: 400,
            width: "100%", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 20 }}>ยืนยันการลบ</h3>
            <p style={{ color: "#555", marginBottom: 28 }}>คุณต้องการลบรายการนี้ใช่หรือไม่?</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => confirmDeleteHeatRow(deleteConfirm)}
                style={{ ...buttonStyle, background: "#e53e3e", color: "white" }}>ใช่ ลบเลย</button>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ ...buttonStyle, background: "#e2e8f0", color: "#333" }}>ไม่</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      {modalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 2000, padding: 16,
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 28, maxWidth: 560,
            width: "100%", maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
          }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: 20, color: "#1a3a5c" }}>
              {editingRow ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[ 
                { key: "date", label: "วันที่ *", placeholder: "เช่น 22-04-69" },
                { key: "rollNo", label: "ม้วนที่ *" },
                { key: "matWeight", label: "น้ำหนัก Mat *" },
                { key: "timeOpen", label: "เวลาเปิด *" },
                { key: "timeClose", label: "เวลาปิด *" },
                { key: "timeTotal", label: "รวม (ชม)", readOnly: true },
                { key: "goodQty", label: "ชิ้นดี *" },
                { key: "rejectQty", label: "เสีย *" },
                { key: "totalQty", label: "รวม (ชิ้น)", readOnly: true },
                { key: "staff1", label: "จนท.(1)" },
                { key: "staff2", label: "จนท.(2)" },
                { key: "rejectBy", label: "ผู้ตีกลับ" },
                { key: "rejectCount", label: "จำนวนตีกลับ" },
              ].map((f) => (
                <div key={f.key}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input
                    type="text"
                    value={(formData as any)[f.key] || ""}
                    onChange={(e) => handleFormChange(f.key as keyof ProductionRow, e.target.value)}
                    readOnly={f.readOnly}
                    style={{ ...fieldStyle, background: f.readOnly ? "#f0f0f0" : "#fff" }}
                    placeholder={f.placeholder}
                  />
                  {formErrors[f.key] && <div style={{ color: "#e53e3e", fontSize: 12, marginTop: 2 }}>{formErrors[f.key]}</div>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={closeModal} style={{ ...buttonStyle, background: "#e2e8f0", color: "#333" }}>ยกเลิก</button>
              <button onClick={saveRow} style={{ ...buttonStyle, background: "#1a3a5c", color: "white" }}>
                {editingRow ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toolbar ─── */}
      <div className="no-print" style={{
        display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16,
        padding: "12px 16px", background: "white", borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={openAddModal} style={{
            ...buttonStyle, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white",
            display: "flex", alignItems: "center", gap: 6,
          }}><span>+</span> เพิ่มข้อมูล</button>
          <button onClick={() => window.print()} style={{
            ...buttonStyle, background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
            display: "flex", alignItems: "center", gap: 6,
          }}>🖨️ พิมพ์</button>
          <button onClick={saveToDatabase} disabled={saving} style={{
            ...buttonStyle, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white",
            display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1,
          }}>💾 บันทึกทั้งหมด</button>
        </div>
        <div style={{ fontSize: 14, color: "#666" }}>ทั้งหมด {rows.length} รายการ</div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลดข้อมูล...</div>
      )}

      {!loading && (
        <div className="print-area" style={{ background: "white", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <div className="print-content" style={{ padding: "16px 20px", fontFamily: "'Sarabun', 'Prompt', sans-serif" }}>
            
            {/* SECTION 1: Header */}
            <table className="vaccum-header-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, border: "1px solid #333" }}>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 700, background: "#1a3a5c", color: "white", fontSize: 14, whiteSpace: "nowrap", width: 120 }}>ชื่อสินค้า :</td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", width: "30%" }}>
                    <input type="text" value={headerProduct} onChange={(e) => setHeaderProduct(e.target.value)} style={{ ...inputCellStyle, fontSize: 13, fontWeight: 600 }} />
                  </td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", fontWeight: 700, background: "#1a3a5c", color: "white", fontSize: 14, whiteSpace: "nowrap", width: 60 }}>Mat :</td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", width: "15%" }}>
                    <input type="text" value={headerMat} onChange={(e) => setHeaderMat(e.target.value)} style={{ ...inputCellStyle, fontSize: 13, fontWeight: 600 }} />
                  </td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", fontWeight: 700, background: "#1a3a5c", color: "white", fontSize: 14, whiteSpace: "nowrap", width: 80 }}>บริษัท :</td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", width: "25%" }}>
                    <input type="text" value={headerCompany} onChange={(e) => setHeaderCompany(e.target.value)} style={{ ...inputCellStyle, fontSize: 13, fontWeight: 600 }} />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* SECTION 2: Production Log */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a3a5c", marginBottom: 8, paddingLeft: 8, borderLeft: "4px solid #1a3a5c" }}>
                บันทึกการตั้งค่า Vaccum
              </div>
              <div className="table-responsive-vaccum">
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 12, minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 70 }}>วันที่</th>
                      <th rowSpan={2} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 50 }}>ม้วนที่</th>
                      <th rowSpan={2} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 70 }}>น้ำหนัก<br/>Mat</th>
                      <th colSpan={3} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 150 }}>เวลารันเครื่อง</th>
                      <th colSpan={3} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 120 }}>จำนวนชิ้นงาน</th>
                      <th colSpan={2} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 100 }}>ลงชื่อ</th>
                      <th colSpan={2} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 100 }}>งานที่ถูกตีกลับ</th>
                      <th rowSpan={2} style={{ border: "1px solid #333", padding: "6px 4px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 60 }} className="col-actions no-print">จัดการ</th>
                    </tr>
                    <tr>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>เปิด</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>ปิด</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>รวม (ชม)</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>ดี</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>เสีย</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>รวม</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>จนท.(1)</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>จนท.(2)</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>ผู้ตีกลับ</th>
                      <th style={{ border: "1px solid #333", padding: "4px 3px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>จำนวน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={14} style={{ border: "1px solid #333", padding: 16, textAlign: "center", color: "#888" }}>
                          ไม่มีรายการข้อมูล คลิก "+ เพิ่มข้อมูล" เพื่อเพิ่มรายการ
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={row.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.date}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.rollNo}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.matWeight}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.timeOpen}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.timeClose}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center", fontWeight: 700 }}>{row.timeTotal}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.goodQty}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.rejectQty}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center", fontWeight: 700 }}>{row.totalQty}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.staff1}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.staff2}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.rejectBy}</td>
                          <td style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center" }}>{row.rejectCount}</td>
                          <td className="col-actions no-print" style={{ border: "1px solid #333", padding: "3px 5px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button onClick={() => openEditModal(row)}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px", color: "#2563eb" }} title="แก้ไข">✏️</button>
                            <button onClick={() => setDeleteConfirm(row.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 4px", color: "#dc2626" }} title="ลบ">🗑️</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: Time Delay Settings with Presets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a3a5c", paddingLeft: 8, borderLeft: "4px solid #1a3a5c" }}>
                  เปลี่ยนค่าของเวลา (วินาที)
                </div>
                <div className="no-print" style={{ display: "flex", gap: 6 }}>
                  <button onClick={addTimeDelayPreset} style={{
                    ...buttonStyle, fontSize: 12, padding: "4px 12px",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "white",
                  }}>+ เพิ่มชุดเวลา</button>
                </div>
              </div>

              {/* Preset tabs */}
              {timeDelayPresets.length > 1 && (
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {timeDelayPresets.map((_, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <button
                        onClick={() => setActiveTimeDelayPreset(idx)}
                        style={{
                          padding: "4px 10px", border: activeTimeDelayPreset === idx ? "2px solid #2563eb" : "1px solid #d1d5db",
                          borderRadius: 6, fontSize: 12, cursor: "pointer",
                          background: activeTimeDelayPreset === idx ? "#eff6ff" : "white",
                          fontWeight: activeTimeDelayPreset === idx ? 700 : 400,
                          color: activeTimeDelayPreset === idx ? "#1d4ed8" : "#374151",
                        }}
                      >
                        ชุดที่ {idx + 1}
                      </button>
                      <button onClick={() => deleteTimeDelayPreset(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626", padding: "2px" }}
                        title="ลบ">🗑️</button>
                    </div>
                  ))}
                </div>
              )}

              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 12 }}>
                <tbody>
                  {/* Row 1: Labels - Print delays + Vac1 */}
                  <tr>
                    {["หน่วงพิมพ์ ล่างขึ้น", "หน่วงพิมพ์ บนลง", "หน่วงพิมพ์ บนขึ้น", "หน่วงเปิด แวค 1", "หน่วงปิด แวค 1"].map((h) => (
                      <td key={h} style={{ border: "1px solid #333", padding: "4px 6px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11, minWidth: 70 }}>{h}</td>
                    ))}
                  </tr>
                  <tr>
                    {[["delayPrintBottomUp"], ["delayPrintTopDown"], ["delayPrintTopUp"], ["delayVac1On"], ["delayVac1Off"]].map(([key]) => (
                      <td key={key} style={{ border: "1px solid #333", padding: "2px 4px", textAlign: "center" }}>
                        <input type="text" value={(currentTimeDelays as any)[key]} onChange={(e) => handleTimeDelayChange(key as keyof TimeDelaySettings, e.target.value)}
                          style={{ ...inputCellStyle, textAlign: "center", width: 60 }} />
                      </td>
                    ))}
                  </tr>
                  {/* Row 2: Labels - Vac2 + Fan */}
                  <tr>
                    {["หน่วงเปิด แวค 2", "หน่วงปิด แวค 2", "หน่วงเปิด พัดลม", "หน่วงปิด พัดลม", "เปิดลมเป่า"].map((h) => (
                      <td key={h} style={{ border: "1px solid #333", padding: "4px 6px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>{h}</td>
                    ))}
                  </tr>
                  <tr>
                    {[["delayVac2On"], ["delayVac2Off"], ["delayFanOn"], ["delayFanOff"], ["blowOn"]].map(([key]) => (
                      <td key={key} style={{ border: "1px solid #333", padding: "2px 4px", textAlign: "center" }}>
                        <input type="text" value={(currentTimeDelays as any)[key]} onChange={(e) => handleTimeDelayChange(key as keyof TimeDelaySettings, e.target.value)}
                          style={{ ...inputCellStyle, textAlign: "center", width: 60 }} />
                      </td>
                    ))}
                  </tr>
                  {/* Row 3: Labels - Blow off + Others */}
                  <tr>
                    {["ปิดลมเป่า", "หน่วงเปิด", "หน่วงความร้อน", "เปิดบังความร้อน", "คลายม้วน"].map((h) => (
                      <td key={h} style={{ border: "1px solid #333", padding: "4px 6px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>{h}</td>
                    ))}
                  </tr>
                  <tr>
                    {[["blowOff"], ["delayOpen"], ["delayHeat"], ["openHeatShield"], ["unwind"]].map(([key]) => (
                      <td key={key} style={{ border: "1px solid #333", padding: "2px 4px", textAlign: "center" }}>
                        <input type="text" value={(currentTimeDelays as any)[key]} onChange={(e) => handleTimeDelayChange(key as keyof TimeDelaySettings, e.target.value)}
                          style={{ ...inputCellStyle, textAlign: "center", width: 60 }} />
                      </td>
                    ))}
                  </tr>
                  {/* Row 4: Labels - Speed + Length + Program */}
                  <tr>
                    {["ตั้งความเร็ว", "ตั้งความยาว", "โปรแกรมที่", "", ""].map((h, i) => (
                      <td key={i} style={{ border: "1px solid #333", padding: "4px 6px", background: "#1a3a5c", color: "white", fontWeight: 600, textAlign: "center", fontSize: 11 }}>{h}</td>
                    ))}
                  </tr>
                  <tr>
                    {[["setSpeed"], ["setLength"], ["programNo"], null, null].map((key, i) => (
                      <td key={i} style={{ border: "1px solid #333", padding: "2px 4px", textAlign: "center" }}>
                        {key ? <input type="text" value={(currentTimeDelays as any)[key[0]]} onChange={(e) => handleTimeDelayChange(key[0] as keyof TimeDelaySettings, e.target.value)}
                          style={{ ...inputCellStyle, textAlign: "center", width: 60 }} /> : null}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 4: Heat Temperature with add/delete rows */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a3a5c", paddingLeft: 8, borderLeft: "4px solid #1a3a5c" }}>
                  บันทึกค่าความร้อน งาน Vaccum
                </div>
                <div className="no-print" style={{ display: "flex", gap: 6 }}>
                  <button onClick={addHeatRow} style={{
                    ...buttonStyle, fontSize: 12, padding: "4px 12px",
                    background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
                  }}>+ เพิ่มแถวความร้อน</button>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #333", padding: "6px 8px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 60 }}>สีเขียว</th>
                    {["เตาที่ 1", "เตาที่ 2", "เตาที่ 3", "เตาที่ 4", "เตาที่ 5", "เตาที่ 6", "เตาที่ 7"].map((h) => (
                      <th key={h} style={{ border: "1px solid #333", padding: "6px 8px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 60 }}>{h}</th>
                    ))}
                    <th className="no-print" style={{ border: "1px solid #333", padding: "6px 8px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 50 }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {heatRows.map((row, idx) => (
                    <tr key={row.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                      <td style={{ border: "1px solid #333", padding: "3px 6px", textAlign: "center", fontWeight: 700, background: "#e8f0fe" }}>{row.rowLabel}</td>
                      {["heater1","heater2","heater3","heater4","heater5","heater6","heater7"].map((hkey) => (
                        <td key={hkey} style={{ border: "1px solid #333", padding: "2px 4px", textAlign: "center" }}>
                          <input type="text" value={(row as any)[hkey]} onChange={(e) => handleHeatChange(idx, hkey as keyof HeatRow, e.target.value)}
                            style={{ ...inputCellStyle, textAlign: "center", width: 50 }} />
                        </td>
                      ))}
                      <td className="no-print" style={{ border: "1px solid #333", padding: "2px 4px", textAlign: "center" }}>
                        <button onClick={() => deleteHeatRow(row.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626", padding: "2px" }}
                          title="ลบ">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECTION 5: Footer */}
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 700, background: "#1a3a5c", color: "white", width: 100, fontSize: 13 }}>ผู้บันทึก</td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", width: 200 }}>
                    <input type="text" value={footerRecorder} onChange={(e) => setFooterRecorder(e.target.value)}
                      style={{ ...inputCellStyle, fontSize: 13, fontWeight: 600, width: 120 }} />
                  </td>
                  <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 700, background: "#1a3a5c", color: "white", width: 100, fontSize: 13 }}>ลงวันที่</td>
                  <td style={{ border: "1px solid #333", padding: "4px 8px", width: 200 }}>
                    <input type="text" value={footerDate} onChange={(e) => setFooterDate(e.target.value)}
                      style={{ ...inputCellStyle, fontSize: 13, fontWeight: 600, width: 120 }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}