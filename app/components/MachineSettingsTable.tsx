"use client";

import React, { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MachineCategory = {
  id: string;
  name: string;
  fields: MachineField[];
};

type MachineField = {
  key: string;
  label: string;
  unit?: string;
  type?: "text" | "number" | "select";
  options?: { label: string; value: string }[];
};

type MachineConfigEntry = {
  key: string;
  value: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  machineId: string;
  machineName: string;
}

// ─── Default categories and fields for machine settings ───────────────────────

const DEFAULT_CATEGORIES: MachineCategory[] = [
  {
    id: "timer",
    name: "ตั้งค่าเวลา (วินาที)",
    fields: [
      { key: "timerPrintDown", label: "หน่วงพิมพ์ล่างขึ้น", unit: "วินาที", type: "number" },
      { key: "timerPrintUp", label: "หน่วงพิมพ์บนลง", unit: "วินาที", type: "number" },
      { key: "timerPrintTop", label: "หน่วงพิมพ์บนขึ้น", unit: "วินาที", type: "number" },
      { key: "timerOpenVac1", label: "หน่วงเปิดแวค 1", unit: "วินาที", type: "number" },
      { key: "timerCloseVac1", label: "หน่วงปิดแวค 1", unit: "วินาที", type: "number" },
      { key: "timerOpenVac2", label: "หน่วงเปิดแวค 2", unit: "วินาที", type: "number" },
      { key: "timerCloseVac2", label: "หน่วงปิดแวค 2", unit: "วินาที", type: "number" },
      { key: "timerOpenFan", label: "หน่วงเปิดพัดลม", unit: "วินาที", type: "number" },
      { key: "timerCloseFan", label: "หน่วงปิดพัดลม", unit: "วินาที", type: "number" },
      { key: "timerOpenBlow", label: "หน่วงเปิดลมเป่า", unit: "วินาที", type: "number" },
      { key: "timerCloseBlow", label: "หน่วงปิดลมเป่า", unit: "วินาที", type: "number" },
      { key: "timerOpenHeat", label: "หน่วงเปิดความร้อน", unit: "วินาที", type: "number" },
      { key: "timerHeat", label: "เวลาความร้อน", unit: "วินาที", type: "number" },
      { key: "timerOpenShield", label: "เปิดบังความร้อน", unit: "วินาที", type: "number" },
    ],
  },
  {
    id: "speed",
    name: "ตั้งค่าความเร็วและความยาว",
    fields: [
      { key: "unrollSpeed", label: "ความเร็วคลายม้วน", unit: "", type: "number" },
      { key: "runSpeed", label: "ความเร็วเดินเครื่อง", unit: "", type: "number" },
      { key: "runLength", label: "ความยาวเดินเครื่อง", unit: "", type: "number" },
      { key: "programNo", label: "โปรแกรมที่", unit: "", type: "number" },
    ],
  },
  {
    id: "heat",
    name: "ตั้งค่าความร้อนเตา",
    fields: [
      { key: "heater1", label: "เตาที่ 1", unit: "°C", type: "number" },
      { key: "heater2", label: "เตาที่ 2", unit: "°C", type: "number" },
      { key: "heater3", label: "เตาที่ 3", unit: "°C", type: "number" },
      { key: "heater4", label: "เตาที่ 4", unit: "°C", type: "number" },
      { key: "heater5", label: "เตาที่ 5", unit: "°C", type: "number" },
      { key: "heater6", label: "เตาที่ 6", unit: "°C", type: "number" },
      { key: "heater7", label: "เตาที่ 7", unit: "°C", type: "number" },
    ],
  },
  {
    id: "info",
    name: "ข้อมูลการผลิต",
    fields: [
      { key: "productName", label: "ชื่อสินค้า", type: "text" },
      { key: "matCode", label: "รหัสวัตถุดิบ", type: "text" },
      { key: "company", label: "บริษัท", type: "text" },
      { key: "operator1", label: "พนักงาน 1", type: "text" },
      { key: "operator2", label: "พนักงาน 2", type: "text" },
      { key: "recordedBy", label: "ผู้บันทึก", type: "text" },
    ],
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px", border: "none", borderRadius: 6, fontSize: 14,
  fontWeight: 700, cursor: "pointer", fontFamily: "'Sarabun', 'Prompt', sans-serif",
};

const inputCellStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4,
  fontSize: 13, fontFamily: "'Sarabun', 'Prompt', sans-serif", background: "#fff",
  color: "#222", outline: "none", textAlign: "center" as const, boxSizing: "border-box",
};

const textInputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", border: "1px solid #ccc", borderRadius: 4,
  fontSize: 13, fontFamily: "'Sarabun', 'Prompt', sans-serif", background: "#fff",
  color: "#222", outline: "none", boxSizing: "border-box",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MachineSettingsTable({ machineId, machineName }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<MachineCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [headerProduct, setHeaderProduct] = useState("");
  const [headerMat, setHeaderMat] = useState("");
  const [headerCompany, setHeaderCompany] = useState("");
  const [footerRecorder, setFooterRecorder] = useState("");
  const [footerDate, setFooterDate] = useState("");

  // ── Initialize defaults ─────────────────────────────────────────────────────

  const defaultConfig: Record<string, string> = {};
  DEFAULT_CATEGORIES.forEach(cat => {
    cat.fields.forEach(f => {
      defaultConfig[f.key] = "";
    });
  });

  // ── Load settings from latest machine log ────────────────────────────────────

  const loadSettings = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/machine-logs?machineId=${machineId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const latest = data[0];
        const newConfig: Record<string, string> = { ...defaultConfig };

        // Timer fields
        if (latest.timerPrintDown != null) newConfig.timerPrintDown = String(latest.timerPrintDown);
        if (latest.timerPrintUp != null) newConfig.timerPrintUp = String(latest.timerPrintUp);
        if (latest.timerPrintTop != null) newConfig.timerPrintTop = String(latest.timerPrintTop);
        if (latest.timerOpenVac1 != null) newConfig.timerOpenVac1 = String(latest.timerOpenVac1);
        if (latest.timerCloseVac1 != null) newConfig.timerCloseVac1 = String(latest.timerCloseVac1);
        if (latest.timerOpenVac2 != null) newConfig.timerOpenVac2 = String(latest.timerOpenVac2);
        if (latest.timerCloseVac2 != null) newConfig.timerCloseVac2 = String(latest.timerCloseVac2);
        if (latest.timerOpenFan != null) newConfig.timerOpenFan = String(latest.timerOpenFan);
        if (latest.timerCloseFan != null) newConfig.timerCloseFan = String(latest.timerCloseFan);
        if (latest.timerOpenBlow != null) newConfig.timerOpenBlow = String(latest.timerOpenBlow);
        if (latest.timerCloseBlow != null) newConfig.timerCloseBlow = String(latest.timerCloseBlow);
        if (latest.timerOpenHeat != null) newConfig.timerOpenHeat = String(latest.timerOpenHeat);
        if (latest.timerHeat != null) newConfig.timerHeat = String(latest.timerHeat);
        if (latest.timerOpenShield != null) newConfig.timerOpenShield = String(latest.timerOpenShield);

        // Speed/length
        if (latest.unrollSpeed != null) newConfig.unrollSpeed = String(latest.unrollSpeed);
        if (latest.runSpeed != null) newConfig.runSpeed = String(latest.runSpeed);
        if (latest.runLength != null) newConfig.runLength = String(latest.runLength);
        if (latest.programNo != null) newConfig.programNo = String(latest.programNo);

        // Heat - try to parse JSON
        if (latest.heat) {
          try {
            const heatData = typeof latest.heat === "string" ? JSON.parse(latest.heat) : latest.heat;
            if (Array.isArray(heatData) && heatData.length > 0) {
              // Extract first row heater values
              const firstRow = heatData[0];
              ["heater1","heater2","heater3","heater4","heater5","heater6","heater7"].forEach((hk, i) => {
                const val = firstRow[`heater${i+1}`];
                if (val != null && val !== "-") newConfig[hk] = String(val);
              });
            }
          } catch (e) {}
        }

        // Info
        newConfig.productName = latest.productName || "";
        newConfig.matCode = latest.matCode || "";
        newConfig.company = latest.company || "";
        newConfig.operator1 = latest.operator1 || "";
        newConfig.operator2 = latest.operator2 || "";
        newConfig.recordedBy = latest.recordedBy || "";

        setConfig(newConfig);
        setHeaderProduct(latest.productName || "");
        setHeaderMat(latest.matCode || "");
        setHeaderCompany(latest.company || "");
        setFooterRecorder(latest.recordedBy || "B");
        setFooterDate(latest.recordedAt ? new Date(latest.recordedAt).toLocaleDateString("th-TH") : "");
      } else {
        setConfig({ ...defaultConfig });
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
      setConfig({ ...defaultConfig });
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    if (machineId) loadSettings();
  }, [machineId, loadSettings]);

  useEffect(() => {
    if (!footerDate) {
      setFooterDate(new Date().toLocaleDateString("th-TH"));
    }
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function handleConfigChange(key: string, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }));
  }

  // ── Save all settings to DB ─────────────────────────────────────────────────

  async function saveToDatabase() {
    if (!machineId) return;
    setSaving(true);
    try {
      // Build heat JSON from the heat table entries
      const heatRows = [
        {
          rowLabel: "แถวที่ 1",
          heater1: config.heater1 || "-",
          heater2: config.heater2 || "-",
          heater3: config.heater3 || "-",
          heater4: config.heater4 || "-",
          heater5: config.heater5 || "-",
          heater6: config.heater6 || "-",
          heater7: config.heater7 || "-",
        },
      ];
      const heatJson = JSON.stringify(heatRows);

      const payload = {
        machineId,
        productName: config.productName || "",
        matCode: config.matCode || "",
        company: config.company || "",
        rollNo: 0,
        timerPrintDown: config.timerPrintDown ? parseFloat(config.timerPrintDown) : null,
        timerPrintUp: config.timerPrintUp ? parseFloat(config.timerPrintUp) : null,
        timerPrintTop: config.timerPrintTop ? parseFloat(config.timerPrintTop) : null,
        timerOpenVac1: config.timerOpenVac1 ? parseFloat(config.timerOpenVac1) : null,
        timerCloseVac1: config.timerCloseVac1 ? parseFloat(config.timerCloseVac1) : null,
        timerOpenVac2: config.timerOpenVac2 ? parseFloat(config.timerOpenVac2) : null,
        timerCloseVac2: config.timerCloseVac2 ? parseFloat(config.timerCloseVac2) : null,
        timerOpenFan: config.timerOpenFan ? parseFloat(config.timerOpenFan) : null,
        timerCloseFan: config.timerCloseFan ? parseFloat(config.timerCloseFan) : null,
        timerOpenBlow: config.timerOpenBlow ? parseFloat(config.timerOpenBlow) : null,
        timerCloseBlow: config.timerCloseBlow ? parseFloat(config.timerCloseBlow) : null,
        timerOpenHeat: config.timerOpenHeat ? parseFloat(config.timerOpenHeat) : null,
        timerHeat: config.timerHeat ? parseFloat(config.timerHeat) : null,
        timerOpenShield: config.timerOpenShield ? parseFloat(config.timerOpenShield) : null,
        unrollSpeed: config.unrollSpeed ? parseFloat(config.unrollSpeed) : null,
        runSpeed: config.runSpeed ? parseFloat(config.runSpeed) : null,
        runLength: config.runLength ? parseFloat(config.runLength) : null,
        programNo: config.programNo ? parseInt(config.programNo) : null,
        heat: heatJson,
        operator1: config.operator1 || null,
        operator2: config.operator2 || null,
        recordedBy: footerRecorder || config.recordedBy || null,
        recordedAt: footerDate ? new Date() : null,
        logDate: new Date(),
        goodPcs: 0,
        defectPcs: 0,
      };

      const res = await fetch("/api/machine-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");
      showToast("บันทึกค่าการตั้งค่าเครื่องจักรสำเร็จ ✓");
      await loadSettings();
    } catch (e) {
      console.error("Save error:", e);
      showToast("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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

      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16,
        padding: "12px 16px", background: "white", borderRadius: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#1a3a5c" }}>
            ⚙️ ตั้งค่า: {machineName}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={saveToDatabase} disabled={saving} style={{
            ...buttonStyle, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white",
            display: "flex", alignItems: "center", gap: 6, opacity: saving ? 0.7 : 1,
          }}>💾 บันทึกค่าตั้งค่า</button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 24, color: "#888" }}>
          กำลังโหลดข้อมูลการตั้งค่า...
        </div>
      )}

      {!loading && (
        <div style={{ background: "white", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <div style={{ padding: "16px 20px", fontFamily: "'Sarabun', 'Prompt', sans-serif" }}>
            
            {/* Section: Header Info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a3a5c", marginBottom: 8, paddingLeft: 8, borderLeft: "4px solid #1a3a5c" }}>
                ข้อมูลการผลิต
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 13 }}>
                <tbody>
                  {[
                    { label: "ชื่อสินค้า", key: "productName" },
                    { label: "รหัสวัตถุดิบ", key: "matCode" },
                    { label: "บริษัท", key: "company" },
                  ].map(({ label, key }) => (
                    <tr key={key}>
                      <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 700, background: "#1a3a5c", color: "white", width: 150, fontSize: 13 }}>{label}</td>
                      <td style={{ border: "1px solid #333", padding: "4px 8px" }}>
                        <input
                          type="text"
                          value={config[key] || ""}
                          onChange={(e) => handleConfigChange(key, e.target.value)}
                          style={{ ...textInputStyle, fontSize: 13, fontWeight: 600 }}
                          placeholder={`ระบุ${label}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Render each category as a table */}
            {categories.map((category) => (
              <div key={category.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a3a5c", marginBottom: 6, paddingLeft: 8, borderLeft: "4px solid #1a3a5c" }}>
                  {category.name}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #333", padding: "6px 8px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 180 }}>รายการ</th>
                      <th style={{ border: "1px solid #333", padding: "6px 8px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 120 }}>ค่า</th>
                      {category.fields[0]?.unit ? (
                        <th style={{ border: "1px solid #333", padding: "6px 8px", background: "#1a3a5c", color: "white", fontWeight: 700, textAlign: "center", minWidth: 80 }}>หน่วย</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {category.fields.map((field, idx) => (
                      <tr key={field.key} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                        <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 600, textAlign: "left" }}>{field.label}</td>
                        <td style={{ border: "1px solid #333", padding: "4px 8px", textAlign: "center" }}>
                          <input
                            type={field.type === "number" ? "number" : "text"}
                            value={config[field.key] || ""}
                            onChange={(e) => handleConfigChange(field.key, e.target.value)}
                            style={field.type === "number" ? { ...inputCellStyle, width: 120 } : { ...textInputStyle, textAlign: "center" as const }}
                            placeholder={field.type === "number" ? "0" : "..."}
                            step={field.type === "number" ? "0.1" : undefined}
                          />
                        </td>
                        {category.fields[0]?.unit ? (
                          <td style={{ border: "1px solid #333", padding: "6px 10px", textAlign: "center", color: "#666", fontSize: 13 }}>{field.unit || "-"}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Section: Footer */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a3a5c", marginBottom: 6, paddingLeft: 8, borderLeft: "4px solid #1a3a5c" }}>
                ข้อมูลผู้บันทึก
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #333", fontSize: 13 }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 700, background: "#1a3a5c", color: "white", width: 150 }}>ผู้บันทึก</td>
                    <td style={{ border: "1px solid #333", padding: "4px 8px", width: "30%" }}>
                      <input
                        type="text"
                        value={footerRecorder}
                        onChange={(e) => setFooterRecorder(e.target.value)}
                        style={{ ...textInputStyle, fontSize: 13, fontWeight: 600, maxWidth: 150 }}
                        placeholder="ชื่อผู้บันทึก"
                      />
                    </td>
                    <td style={{ border: "1px solid #333", padding: "6px 10px", fontWeight: 700, background: "#1a3a5c", color: "white", width: 100 }}>วันที่</td>
                    <td style={{ border: "1px solid #333", padding: "4px 8px" }}>
                      <input
                        type="text"
                        value={footerDate}
                        onChange={(e) => setFooterDate(e.target.value)}
                        style={{ ...textInputStyle, fontSize: 13, fontWeight: 600, maxWidth: 150 }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </>
  );
}