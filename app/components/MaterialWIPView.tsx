"use client";

import React, { useEffect, useState, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────

type RollData = {
  id?: string;
  rollNo: number | string;
  weightKg: number | string;
  issueDate: string;
  issuer: string;
  productCode: string;
  lotNo: string;
  goodQty: string;
  defectQty: string;
  diecutQty: string;
  diecutReceiveDate: string;
  packQty: string;
};

type MaterialOption = {
  id: string;
  name: string;
  unit: string | null;
  unitPrice: number;
  width?: number | null;
  height?: number | null;
  thickness?: number | null;
};

type ReceiptData = {
  id: string;
  materialId?: string | null;
  materialName: string;
  material?: { id: string; name: string; unit: string | null; unitPrice: number } | null;
  receivedDate?: string | null;
  supplier?: string | null;
  supplierNote?: string | null;
  invoiceNo?: string | null;
  unitPrice?: number;
  width?: number | null;
  height?: number | null;
  thickness?: number | null;
  rolls: RollData[];
  createdAt?: string;
  updatedAt?: string;
};

type ReceiptForm = {
  id?: string;
  materialId: string;
  materialName: string;
  receivedDate: string;
  supplier: string;
  supplierNote: string;
  invoiceNo: string;
  unitPrice: string;
  width: string;
  height: string;
  thickness: string;
  rolls: RollData[];
};

// ─── Helpers ─────────────────────────────────────────────────────────

const COMPANY_NAME = "บริษัท ที สยามแพ็ค จำกัด";

function emptyRoll(rollNo: number): RollData {
  return { rollNo, weightKg: "", issueDate: "", issuer: "", productCode: "", lotNo: "", goodQty: "", defectQty: "", diecutQty: "", diecutReceiveDate: "", packQty: "" };
}

function emptyForm(): ReceiptForm {
  return { materialId: "", materialName: "", receivedDate: "", supplier: "", supplierNote: "", invoiceNo: "", unitPrice: "", width: "", height: "", thickness: "", rolls: [emptyRoll(1)] };
}

function totalWeight(rolls: RollData[]): number {
  return rolls.reduce((sum, r) => sum + (Number(r.weightKg) || 0), 0);
}

function totalDefectQty(rolls: RollData[]): number {
  return rolls.reduce((sum, r) => sum + (Number(r.defectQty) || 0), 0);
}

function totalGoodQty(rolls: RollData[]): number {
  return rolls.reduce((sum, r) => sum + (Number(r.goodQty) || 0), 0);
}

function parseUnitPrice(value: string | number | undefined): number {
  return Number(value) || 0;
}

function costPerJob(rolls: RollData[], unitPrice: number): number {
  if (!rolls.length || !unitPrice) return 0;
  return totalWeight(rolls) * unitPrice / rolls.length;
}

function damageCost(rolls: RollData[], unitPrice: number): number {
  const totalQty = totalGoodQty(rolls) + totalDefectQty(rolls);
  if (!totalQty || !unitPrice) return 0;
  const defectRatio = totalDefectQty(rolls) / totalQty;
  return totalWeight(rolls) * unitPrice * defectRatio;
}

// ─── Component ───────────────────────────────────────────────────────

export function MaterialWIPView() {
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [form, setForm] = useState<ReceiptForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<ReceiptData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchReceipts(); fetchMaterialOptions(); }, []);

  async function fetchReceipts() {
    setLoading(true);
    try {
      const res = await fetch("/api/material-receipts");
      const data = await res.json();
      setReceipts(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchMaterialOptions() {
    try {
      const res = await fetch("/api/materials");
      const data = await res.json();
      setMaterialOptions(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  }

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  }

  // ─ Form helpers ─
  function resetForm() { setEditing(false); setForm(emptyForm()); setShowForm(false); }

  function openAdd() { resetForm(); setShowForm(true); }

  function openEdit(receipt: ReceiptData) {
    setEditing(true);
    setForm({
      id: receipt.id,
      materialId: receipt.materialId || receipt.material?.id || "",
      materialName: receipt.materialName || "",
      receivedDate: receipt.receivedDate || "",
      supplier: receipt.supplier || "",
      supplierNote: receipt.supplierNote || "",
      invoiceNo: receipt.invoiceNo || "",
      unitPrice: receipt.unitPrice?.toString() || "",
      width: receipt.width?.toString() || "",
      height: receipt.height?.toString() || "",
      thickness: receipt.thickness?.toString() || "",
      rolls: receipt.rolls.length > 0
        ? receipt.rolls.map((r, i) => ({
            id: r.id, rollNo: r.rollNo ?? i + 1, weightKg: r.weightKg ?? "",
            issueDate: r.issueDate || "", issuer: r.issuer || "",
            productCode: r.productCode || "", lotNo: r.lotNo || "",
            goodQty: r.goodQty || "", defectQty: r.defectQty || "",
            diecutQty: r.diecutQty || "", diecutReceiveDate: r.diecutReceiveDate || "",
            packQty: r.packQty || "",
          }))
        : [emptyRoll(1)],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField(field: keyof Omit<ReceiptForm, "rolls" | "id" | "materialId">, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // ── เลือกวัสดุจาก Catalog: auto-fill ชื่อ/ขนาด/ราคา ──
  function handleMaterialSelect(materialId: string) {
    if (!materialId) {
      setForm(f => ({ ...f, materialId: "" }));
      return;
    }
    const mat = materialOptions.find(m => m.id === materialId);
    if (!mat) return;
    setForm(f => ({
      ...f,
      materialId: mat.id,
      materialName: mat.name,
      width: mat.width != null ? String(mat.width) : f.width,
      height: mat.height != null ? String(mat.height) : f.height,
      thickness: mat.thickness != null ? String(mat.thickness) : f.thickness,
      unitPrice: mat.unitPrice != null ? String(mat.unitPrice) : f.unitPrice,
    }));
  }

  function updateRoll(index: number, field: keyof RollData, value: string) {
    setForm(f => ({ ...f, rolls: f.rolls.map((r, i) => i === index ? { ...r, [field]: value } : r) }));
  }

  function addRoll() {
    setForm(f => ({ ...f, rolls: [...f.rolls, emptyRoll(f.rolls.length + 1)] }));
  }

  function removeRoll(index: number) {
    setForm(f => {
      const rolls = f.rolls.filter((_, i) => i !== index).map((r, i) => ({ ...r, rollNo: i + 1 }));
      return { ...f, rolls: rolls.length > 0 ? rolls : [emptyRoll(1)] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const method = editing ? "PUT" : "POST";
    const url = editing && form.id ? `/api/material-receipts/${form.id}` : "/api/material-receipts";
    const payload = { ...form, materialId: form.materialId || null };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      await fetchReceipts();
      flash(editing ? "แก้ไขใบรับวัสดุสำเร็จ" : "เพิ่มใบรับวัสดุสำเร็จ");
      resetForm();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ยืนยันลบใบรับวัสดุนี้?")) return;
    const res = await fetch(`/api/material-receipts/${id}`, { method: "DELETE" });
    if (res.ok) { setReceipts(r => r.filter(x => x.id !== id)); flash("ลบใบรับวัสดุเรียบร้อย"); }
  }

  function handlePrint(receipt: ReceiptData) {
    setPrintReceipt(receipt);
    setTimeout(() => {
      const el = printRef.current;
      if (!el) return;
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>WIP - ${receipt.materialName}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'TH SarabunPSK', 'Sarabun', 'Tahoma', sans-serif; font-size: 14px; padding: 20px; }
.wip-sheet { max-width: 850px; margin: 0 auto; }
.wip-header { text-align: center; margin-bottom: 8px; }
.wip-company { font-size: 18px; font-weight: bold; }
.wip-title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
.wip-meta { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
.wip-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
.wip-table th, .wip-table td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
.wip-table th { background: #f0f0f0; font-weight: bold; }
.wip-table td { min-height: 20px; }
.wip-total td { font-weight: bold; background: #f9f9f9; }
.wip-signatures { margin-top: 40px; display: flex; justify-content: space-around; font-size: 13px; }
.wip-sig-block { text-align: center; min-width: 180px; }
.wip-sig-line { border-bottom: 1px solid #333; width: 180px; margin: 30px auto 4px; }
@media print { body { padding: 10px; } }
</style>
</head><body>${el.innerHTML}<script>window.onload=function(){window.print();}<\/script></body></html>`);
      w.document.close();
      setPrintReceipt(null);
    }, 100);
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div>
      {message && <div className="alert success">{message}</div>}

      {/* ─ Form section ─ */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ marginBottom: 16 }}>{editing ? "แก้ไขใบรับวัสดุ (Work In Process)" : "เพิ่มใบรับวัสดุ (Work In Process)"}</h3>
          <form onSubmit={handleSubmit}>
            {/* Header fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>เลือกวัสดุจาก Catalog (ถ้ามี)</label>
                <select
                  value={form.materialId}
                  onChange={e => handleMaterialSelect(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "white" }}
                >
                  <option value="">- ไม่ผูกกับ Catalog / พิมพ์ชื่อเอง -</option>
                  {materialOptions.map(m => (
                    <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ""} — ฿{m.unitPrice.toLocaleString("th-TH")}</option>
                  ))}
                </select>
                {materialOptions.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>ยังไม่มีวัสดุใน Catalog — เพิ่มได้ที่แท็บ "รายการวัสดุ (Catalog)"</div>
                )}
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>
                  ชื่อวัสดุ / Material
                  {form.materialId && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#16a34a" }}>✓ เชื่อมกับ Catalog</span>}
                </label>
                <input value={form.materialName} onChange={e => updateField("materialName", e.target.value)} required style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น PP Sheet T: 0.9x440mm สีธรรมชาติ" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>ความกว้าง</label>
                <input type="number" min="0" step="0.01" value={form.width} onChange={e => updateField("width", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น 100" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>ความสูง</label>
                <input type="number" min="0" step="0.01" value={form.height} onChange={e => updateField("height", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น 50" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>ความหนา</label>
                <input type="number" min="0" step="0.01" value={form.thickness} onChange={e => updateField("thickness", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น 1.2" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>วันที่รับเข้าคลัง</label>
                <input value={form.receivedDate} onChange={e => updateField("receivedDate", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น 13/03/68" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Supplier (ผู้จัดจำหน่าย)</label>
                <input value={form.supplier} onChange={e => updateField("supplier", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น บ. ซินเหวย PPN-A" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>หมายเหตุ Supplier</label>
                <input value={form.supplierNote} onChange={e => updateField("supplierNote", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น รอยซ / บ.เอกทริม" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Invoice No.</label>
                <input value={form.invoiceNo} onChange={e => updateField("invoiceNo", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น IV68030071" />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: 13 }}>ราคาต่อ Kg (฿)</label>
                <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => updateField("unitPrice", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} placeholder="เช่น 42.50" />
              </div>
            </div>

            {/* Rolls table */}
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ fontSize: 14 }}>รายการม้วน (Rolls)</h4>
              <button type="button" onClick={addRoll} style={{ padding: "6px 14px", background: "#16a34a", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ เพิ่มม้วน</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 40 }}>มวนที่</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 70 }}>น้ำหนัก Kg</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 80 }}>วันที่เบิกผลิต</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 70 }}>ผู้เบิก</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 80 }}>รหัสสินค้า</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 70 }}>Lot.No.</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 55 }}>งานดี</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 55 }}>งานเสีย</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 65 }}>ไดคัท-จน.</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 80 }}>ไดคัท-วันที่รับ</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 65 }}>แพค/Stock</th>
                    <th style={{ padding: "8px 4px", border: "1px solid #e2e8f0", minWidth: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.rolls.map((roll, i) => (
                    <tr key={i}>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input type="number" step="0.01" value={roll.weightKg} onChange={e => updateRoll(i, "weightKg", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3, textAlign: "center" }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.issueDate} onChange={e => updateRoll(i, "issueDate", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} placeholder="วว/ดด/ปป" /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.issuer} onChange={e => updateRoll(i, "issuer", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.productCode} onChange={e => updateRoll(i, "productCode", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.lotNo} onChange={e => updateRoll(i, "lotNo", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.goodQty} onChange={e => updateRoll(i, "goodQty", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.defectQty} onChange={e => updateRoll(i, "defectQty", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.diecutQty} onChange={e => updateRoll(i, "diecutQty", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.diecutReceiveDate} onChange={e => updateRoll(i, "diecutReceiveDate", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0" }}><input value={roll.packQty} onChange={e => updateRoll(i, "packQty", e.target.value)} style={{ width: "100%", padding: "4px", border: "1px solid #ddd", borderRadius: 3 }} /></td>
                      <td style={{ padding: 2, border: "1px solid #e2e8f0", textAlign: "center" }}>
                        {form.rolls.length > 1 && (
                          <button type="button" onClick={() => removeRoll(i)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 11, cursor: "pointer" }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: "#f9fafb", fontWeight: 700 }}>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0", textAlign: "center" }}>รวม</td>
                    <td style={{ padding: "6px", border: "1px solid #e2e8f0", textAlign: "center" }}>{totalWeight(form.rolls).toFixed(2)}</td>
                    <td colSpan={10} style={{ border: "1px solid #e2e8f0" }}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cost summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
              <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>วัสดุใช้ไป</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{(totalWeight(form.rolls) * parseUnitPrice(form.unitPrice)).toLocaleString("th-TH", { style: "currency", currency: "THB" })}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>1 งานใช้งบ</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{costPerJob(form.rolls, parseUnitPrice(form.unitPrice)).toLocaleString("th-TH", { style: "currency", currency: "THB" })}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>เสียหาย</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{damageCost(form.rolls, parseUnitPrice(form.unitPrice)).toLocaleString("th-TH", { style: "currency", currency: "THB" })}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button type="submit" style={{ padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>{editing ? "บันทึกการแก้ไข" : "บันทึกใบรับวัสดุ"}</button>
              <button type="button" onClick={resetForm} style={{ padding: "10px 20px", background: "#6b7280", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>ยกเลิก</button>
            </div>
          </form>
        </div>
      )}

      {/* ─ Receipt list ─ */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>ใบรับวัสดุ (Work In Process)</h3>
          {!showForm && <button type="button" onClick={openAdd} style={{ padding: "8px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>+ เพิ่มใบรับวัสดุ</button>}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลดข้อมูล...</div>}

        {!loading && receipts.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>ยังไม่มีใบรับวัสดุ</div>}

        {!loading && receipts.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>ชื่อวัสดุ</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>Catalog</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Supplier</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Invoice No.</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>วันที่รับ</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>จำนวนม้วน</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>น้ำหนักรวม (Kg)</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(receipt => (
                  <tr key={receipt.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{receipt.materialName}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      {receipt.materialId || receipt.material ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "2px 8px", borderRadius: 12, border: "1px solid #bbf7d0" }}>✓ เชื่อม</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{receipt.supplier || "-"}</td>
                    <td style={{ padding: "10px 8px" }}>{receipt.invoiceNo || "-"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{receipt.receivedDate || "-"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{receipt.rolls.length}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>{totalWeight(receipt.rolls).toFixed(2)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <button type="button" onClick={() => openEdit(receipt)} style={{ padding: "4px 10px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, fontSize: 11, marginRight: 4, cursor: "pointer" }}>แก้ไข</button>
                      <button type="button" onClick={() => handlePrint(receipt)} style={{ padding: "4px 10px", background: "#8b5cf6", color: "white", border: "none", borderRadius: 4, fontSize: 11, marginRight: 4, cursor: "pointer" }}>พิมพ์</button>
                      <button type="button" onClick={() => handleDelete(receipt.id)} style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─ Hidden print template ─ */}
      <div ref={printRef} style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {printReceipt && <WIPPrintSheet receipt={printReceipt} />}
      </div>
    </div>
  );
}

// ─── Print Sheet Component (matches Excel layout) ───────────────────

function WIPPrintSheet({ receipt }: { receipt: ReceiptData }) {
  const total = totalWeight(receipt.rolls);

  return (
    <div className="wip-sheet">
      <div className="wip-header">
        <div className="wip-company">{COMPANY_NAME}</div>
        <div className="wip-title">Work In Process</div>
      </div>

      <div className="wip-meta">
        <div>{receipt.materialName}</div>
        <div>วันที่รับเข้าคลัง : {receipt.receivedDate || "___________"}</div>
      </div>
      <div className="wip-meta">
        <div>Supplier : {receipt.supplier || "___________"} {receipt.supplierNote || ""}</div>
        <div>Invoice No. : {receipt.invoiceNo || "___________"}</div>
      </div>
      <div className="wip-meta">
        <div>ราคาต่อ Kg : {receipt.unitPrice ? receipt.unitPrice.toLocaleString("th-TH", { style: "currency", currency: "THB" }) : "___________"}</div>
        <div>ราคาเสียหาย : {damageCost(receipt.rolls, receipt.unitPrice || 0).toLocaleString("th-TH", { style: "currency", currency: "THB" })}</div>
      </div>
      <table className="wip-table">
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: 40 }}>มวนที่</th>
            <th rowSpan={2} style={{ width: 70 }}>น้ำหนัก<br/>Kg</th>
            <th rowSpan={2} style={{ width: 70 }}>วันที่เบิก<br/>ผลิต</th>
            <th rowSpan={2} style={{ width: 60 }}>ผู้เบิก</th>
            <th colSpan={4}>ฝ่ายผลิต</th>
            <th colSpan={2}>งานไดคัท</th>
            <th>งานแพค/<br/>Stock</th>
          </tr>
          <tr>
            <th style={{ width: 70 }}>รหัสสินค้า</th>
            <th style={{ width: 60 }}>Lot.No.</th>
            <th style={{ width: 50 }}>งานดี</th>
            <th style={{ width: 50 }}>งานเสีย</th>
            <th style={{ width: 50 }}>จำนวน</th>
            <th style={{ width: 70 }}>วันที่รับ</th>
            <th style={{ width: 50 }}>จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {receipt.rolls.map((roll, i) => (
            <tr key={i}>
              <td>{roll.rollNo}</td>
              <td>{roll.weightKg || ""}</td>
              <td>{roll.issueDate || ""}</td>
              <td>{roll.issuer || ""}</td>
              <td>{roll.productCode || ""}</td>
              <td>{roll.lotNo || ""}</td>
              <td>{roll.goodQty || ""}</td>
              <td>{roll.defectQty || ""}</td>
              <td>{roll.diecutQty || ""}</td>
              <td>{roll.diecutReceiveDate || ""}</td>
              <td>{roll.packQty || ""}</td>
            </tr>
          ))}
          <tr className="wip-total">
            <td>รวม</td>
            <td>{total > 0 ? total.toFixed(2) : ""}</td>
            <td colSpan={9}></td>
          </tr>
        </tbody>
      </table>

      <div className="wip-signatures">
        <div className="wip-sig-block">
          <div className="wip-sig-line"></div>
          ฝ่ายผลิต
        </div>
        <div className="wip-sig-block">
          <div className="wip-sig-line"></div>
          QC
        </div>
        <div className="wip-sig-block">
          <div className="wip-sig-line"></div>
          ไดคัท
        </div>
        <div className="wip-sig-block">
          <div className="wip-sig-line"></div>
          ฝ่ายบัญชี
        </div>
      </div>
    </div>
  );
}