import React, { useState, useRef } from "react";

// ── Material Receiving Table Component ──
export function MaterialReceivingTable({ 
  materialId, 
  receivingLots, 
  onAddRow, 
  onUpdateRow, 
  onDeleteRow,
  onImportExcel,
  onExportExcel,
}: {
  materialId: string;
  receivingLots: any[];
  onAddRow: (row: any) => void;
  onUpdateRow: (rowId: string, row: any) => void;
  onDeleteRow: (rowId: string) => void;
  onImportExcel: (file: File) => Promise<void>;
  onExportExcel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);

  // New row template
  const newRow = {
    id: `row-${Date.now()}`,
    supplier: "",
    invoiceNo: "",
    lotNumber: "",
    productCode: "",
    weight: 0,
    quantity: 0,
    unit: "",
    receivingDate: new Date().toISOString().split("T")[0],
    qcStatus: "pending",
    notes: "",
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);

    try {
      // Dynamic import of SheetJS (xlsx)
      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
          if (!worksheet) {
            setImportError("ไม่พบข้อมูลในไฟล์ Excel");
            setIsImporting(false);
            return;
          }

          // Convert to JSON, starting from row 2 (skip header)
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (rows.length < 2) {
            setImportError("ไฟล์ Excel ต้องมีข้อมูลอย่างน้อย 1 แถว");
            setIsImporting(false);
            return;
          }

          // Header mapping (assume first row is header)
          const headers = rows[0] as string[];
          const colMap = {
            supplier: headers.findIndex(h => h?.toLowerCase().includes("supplier")),
            invoiceNo: headers.findIndex(h => h?.toLowerCase().includes("invoice")),
            lotNumber: headers.findIndex(h => h?.toLowerCase().includes("lot")),
            productCode: headers.findIndex(h => h?.toLowerCase().includes("product")),
            weight: headers.findIndex(h => h?.toLowerCase().includes("weight")),
            quantity: headers.findIndex(h => h?.toLowerCase().includes("quantity") || h?.toLowerCase().includes("qty")),
            unit: headers.findIndex(h => h?.toLowerCase().includes("unit")),
            receivingDate: headers.findIndex(h => h?.toLowerCase().includes("date")),
            qcStatus: headers.findIndex(h => h?.toLowerCase().includes("qc")),
            notes: headers.findIndex(h => h?.toLowerCase().includes("notes")),
          };

          // Parse data rows
          const importedData = rows.slice(1).map((row: any) => ({
            id: `row-${Date.now()}-${Math.random()}`,
            supplier: row[colMap.supplier] || "",
            invoiceNo: row[colMap.invoiceNo] || "",
            lotNumber: row[colMap.lotNumber] || "",
            productCode: row[colMap.productCode] || "",
            weight: Number(row[colMap.weight]) || 0,
            quantity: Number(row[colMap.quantity]) || 0,
            unit: row[colMap.unit] || "",
            receivingDate: row[colMap.receivingDate] ? new Date(row[colMap.receivingDate]).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
            qcStatus: row[colMap.qcStatus] || "pending",
            notes: row[colMap.notes] || "",
          }));

          // Add all rows
          for (const item of importedData) {
            onAddRow(item);
          }

          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = "";
          
        } catch (err) {
          setImportError(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
        } finally {
          setIsImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setImportError(`ไม่สามารถนำเข้าไฟล์ได้: ${err.message}`);
      setIsImporting(false);
    }
  };

  const startEdit = (row: any) => {
    setEditingRowId(row.id);
    setEditFormData({ ...row });
  };

  const saveEdit = () => {
    if (editFormData && editingRowId) {
      onUpdateRow(editingRowId, editFormData);
      setEditingRowId(null);
      setEditFormData(null);
    }
  };

  const cancelEdit = () => {
    setEditingRowId(null);
    setEditFormData(null);
  };

  return (
    <div style={{ marginTop: 20 }}>
      {/* Toolbar */}
      <div style={{ 
        display: "flex", 
        gap: 10, 
        marginBottom: 16, 
        flexWrap: "wrap",
        padding: "12px 14px",
        background: "#f8fafc",
        borderRadius: 10,
        border: "1px solid #e2e8f0"
      }}>
        <button
          type="button"
          onClick={() => onAddRow(newRow)}
          style={{
            padding: "8px 14px",
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + เพิ่มแถว
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          style={{
            padding: "8px 14px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: isImporting ? "not-allowed" : "pointer",
            opacity: isImporting ? 0.6 : 1,
          }}
        >
          {isImporting ? "🔄 นำเข้า..." : "📥 นำเข้า Excel"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleImport}
          style={{ display: "none" }}
        />

        <button
          type="button"
          onClick={onExportExcel}
          style={{
            padding: "8px 14px",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          📤 ส่งออก Excel
        </button>
      </div>

      {importError && (
        <div style={{
          padding: "10px 14px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 8,
          color: "#b91c1c",
          fontSize: 12,
          marginBottom: 12,
        }}>
          ⚠️ {importError}
        </div>
      )}

      {/* Table */}
      {receivingLots && receivingLots.length > 0 ? (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            backgroundColor: "white",
          }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, color: "#1a2e1c", whiteSpace: "nowrap" }}>ลำดับที่</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, color: "#1a2e1c", minWidth: 100 }}>ผู้จัดจำหน่าย</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, color: "#1a2e1c", minWidth: 80 }}>Invoice</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, color: "#1a2e1c", minWidth: 80 }}>Lot No.</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, color: "#1a2e1c", minWidth: 80 }}>รหัสสินค้า</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a2e1c" }}>น้ำหนัก</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a2e1c" }}>จำนวน</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a2e1c" }}>หน่วย</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, color: "#1a2e1c" }}>วันที่รับเข้า</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a2e1c" }}>QC</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#1a2e1c" }}>ทำการ</th>
              </tr>
            </thead>
            <tbody>
              {receivingLots.map((row, index) => (
                <tr key={row.id} style={{ 
                  borderBottom: "1px solid #e5e7eb",
                  background: editingRowId === row.id ? "#fffbeb" : index % 2 === 0 ? "white" : "#f9fafb",
                }}>
                  <td style={{ padding: "8px", textAlign: "center", fontWeight: 600, color: "#64748b" }}>{index + 1}</td>
                  
                  {editingRowId === row.id ? (
                    <>
                      <td style={{ padding: "6px" }}><input type="text" value={editFormData?.supplier} onChange={e => setEditFormData({...editFormData, supplier: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="text" value={editFormData?.invoiceNo} onChange={e => setEditFormData({...editFormData, invoiceNo: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="text" value={editFormData?.lotNumber} onChange={e => setEditFormData({...editFormData, lotNumber: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="text" value={editFormData?.productCode} onChange={e => setEditFormData({...editFormData, productCode: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="number" value={editFormData?.weight} onChange={e => setEditFormData({...editFormData, weight: Number(e.target.value)})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="number" value={editFormData?.quantity} onChange={e => setEditFormData({...editFormData, quantity: Number(e.target.value)})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="text" value={editFormData?.unit} onChange={e => setEditFormData({...editFormData, unit: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><input type="date" value={editFormData?.receivingDate} onChange={e => setEditFormData({...editFormData, receivingDate: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }} /></td>
                      <td style={{ padding: "6px" }}><select value={editFormData?.qcStatus} onChange={e => setEditFormData({...editFormData, qcStatus: e.target.value})} style={{ width: "100%", padding: "4px", border: "1px solid #d1d5db", borderRadius: 4 }}><option value="pending">รอ</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></td>
                      <td style={{ padding: "6px", textAlign: "center", display: "flex", gap: 4, justifyContent: "center" }}>
                        <button type="button" onClick={saveEdit} style={{ padding: "3px 8px", background: "#10b981", color: "white", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>บันทึก</button>
                        <button type="button" onClick={cancelEdit} style={{ padding: "3px 8px", background: "#6b7280", color: "white", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>ยกเลิก</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "8px" }}>{row.supplier}</td>
                      <td style={{ padding: "8px" }}>{row.invoiceNo}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace", fontWeight: 600 }}>{row.lotNumber}</td>
                      <td style={{ padding: "8px", fontFamily: "monospace" }}>{row.productCode}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{row.weight}</td>
                      <td style={{ padding: "8px", textAlign: "center", fontWeight: 600 }}>{row.quantity}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{row.unit}</td>
                      <td style={{ padding: "8px" }}>{row.receivingDate ? new Date(row.receivingDate).toLocaleDateString("th-TH") : "-"}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: row.qcStatus === "pass" ? "#d1fae5" : row.qcStatus === "fail" ? "#fee2e2" : "#fef3c7",
                          color: row.qcStatus === "pass" ? "#065f46" : row.qcStatus === "fail" ? "#7c2d12" : "#7c2d12",
                        }}>
                          {row.qcStatus === "pass" ? "✓ ผ่าน" : row.qcStatus === "fail" ? "✕ ไม่ผ่าน" : "⏳ รอ"}
                        </span>
                      </td>
                      <td style={{ padding: "6px", textAlign: "center", display: "flex", gap: 4, justifyContent: "center" }}>
                        <button type="button" onClick={() => startEdit(row)} style={{ padding: "3px 8px", background: "#3b82f6", color: "white", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>แก้ไข</button>
                        <button type="button" onClick={() => onDeleteRow(row.id)} style={{ padding: "3px 8px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>ลบ</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{
          padding: "24px",
          textAlign: "center",
          background: "#f8fafc",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          color: "#64748b",
          fontSize: 14,
        }}>
          📋 ยังไม่มีบันทึกการรับเข้า
        </div>
      )}
    </div>
  );
}
