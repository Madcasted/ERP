"use client";

import React, { useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  address?: string | null;
  image?: string | null;
  createdAt?: string;
  updatedAt: string;
};

type CustomerForm = {
  id?: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  address: string;
  image: string | null;
};

const customerRoleOptions = [
  { value: "EMPLOYEE", label: "พนักงาน" },
  { value: "MANAGER", label: "ผู้จัดการ" },
  { value: "EXECUTIVE", label: "ผู้บริหาร" },
];

function getCustomerRoleLabel(role?: string | null) {
  return customerRoleOptions.find((option) => option.value === role)?.label ?? role ?? "-";
}

function CustomerAvatar({
  customer,
  size = 36,
}: {
  customer: Pick<Customer, "name" | "image">;
  size?: number;
}) {
  if (customer.image) {
    return (
      <img
        src={customer.image}
        alt={customer.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid #e2e8f0",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.max(14, Math.round(size * 0.38)), color: "white", fontWeight: 700, flexShrink: 0,
      }}
    >
      {customer.name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Shared Modal Overlay ─────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "16px",
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "12px",
  maxWidth: "640px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "32px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: "400px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 20 }}>ยืนยันการลบ</h3>
        <p style={{ color: "#555", marginBottom: 28 }}>{message}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={onConfirm}
            style={{
              padding: "10px 32px",
              backgroundColor: "#e53e3e",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ใช่ ลบเลย
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 32px",
              backgroundColor: "#e2e8f0",
              color: "#333",
              border: "none",
              borderRadius: "8px",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ไม่
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CustomerView ─────────────────────────────────────────────────────────────

export function CustomerView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    name: "", email: "", role: "EMPLOYEE", phone: "", address: "", image: null,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  }>({ show: false, message: "", onConfirm: () => {} });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    async function fetchCustomers() {
      setLoading(true);
      try {
        const res = await fetch("/api/customers");
        const data = await res.json();
        if (active) setCustomers(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchCustomers();
    return () => { active = false; };
  }, []);

  async function refreshData() {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const data = await res.json();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          getCustomerRoleLabel(c.role).toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").includes(search)
      ),
    [customers, search]
  );

  function showMsg(text: string) {
    setMessage(text);
    setError(null);
    window.setTimeout(() => setMessage(null), 3000);
  }

  function showErr(text: string) {
    setError(text);
    setMessage(null);
    window.setTimeout(() => setError(null), 4000);
  }

  function confirmDelete(msg: string, action: () => void) {
    setDeleteConfirm({ show: true, message: msg, onConfirm: action });
  }

  // ── Add / Edit ─────────────────────────────────────────────────────────────

  function openAdd() {
    setSelectedCustomer(null);
    setCustomerForm({ name: "", email: "", role: "EMPLOYEE", phone: "", address: "", image: null });
    setShowEditModal(true);
  }

  function openEdit(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerForm({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: customer.role || "EMPLOYEE",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      image: customer.image ?? null,
    });
    setShowEditModal(true);
  }

  function handleCustomerImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCustomerForm({ ...customerForm, image: ev.target?.result as string });
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerForm.name.trim()) { showErr("กรุณากรอกชื่อสมาชิก"); return; }
    if (!customerForm.email.trim()) { showErr("กรุณากรอกอีเมล"); return; }

    const payload = {
      name: customerForm.name.trim(),
      email: customerForm.email.trim(),
      role: customerForm.role,
      phone: customerForm.phone.trim() || null,
      address: customerForm.address.trim() || null,
      image: customerForm.image,
    };

    const isEdit = !!customerForm.id;
    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `/api/customers/${customerForm.id}` : "/api/customers";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showErr(body?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }

      await refreshData();
      showMsg(isEdit ? "แก้ไขข้อมูลสมาชิกเรียบร้อยแล้ว" : "เพิ่มสมาชิกใหม่เรียบร้อยแล้ว");
      setShowEditModal(false);
    } catch (e) {
      console.error(e);
      showErr("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete(id: string, name: string) {
    confirmDelete(`คุณแน่ใจที่จะลบสมาชิก "${name}" ใช่ไหม?`, async () => {
      setDeleteConfirm((d) => ({ ...d, show: false }));
      try {
        const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
        if (res.ok) {
          setCustomers((c) => c.filter((cu) => cu.id !== id));
          showMsg("ลบสมาชิกเรียบร้อยแล้ว");
        } else {
          showErr("ลบไม่สำเร็จ กรุณาลองใหม่");
        }
      } catch (e) {
        console.error(e);
        showErr("เกิดข้อผิดพลาดขณะลบสมาชิก");
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="module-panel">
      {/* Delete Confirm Modal */}
      {deleteConfirm.show && (
        <DeleteConfirmModal
          message={deleteConfirm.message}
          onConfirm={deleteConfirm.onConfirm}
          onCancel={() => setDeleteConfirm((d) => ({ ...d, show: false }))}
        />
      )}

      {/* Add / Edit Modal */}
      {showEditModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>{customerForm.id ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกใหม่"}</h2>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="field-group" style={{ gridColumn: "1 / -1" }}>
                  <label>รูปโปรไฟล์</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <CustomerAvatar
                      customer={{ name: customerForm.name || "สมาชิก", image: customerForm.image }}
                      size={72}
                    />
                    <div style={{ flex: 1 }}>
                      <input type="file" accept="image/*" onChange={handleCustomerImageChange} />
                      {customerForm.image && (
                        <button
                          type="button"
                          className="btn btn-small btn-secondary"
                          style={{ marginTop: 8 }}
                          onClick={() => setCustomerForm({ ...customerForm, image: null })}
                        >
                          ลบรูป
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="field-group" style={{ gridColumn: "1 / -1" }}>
                  <label>ชื่อสมาชิก <span style={{ color: "#e53e3e" }}>*</span></label>
                  <input
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="เช่น บริษัท ABC จำกัด หรือ นาย สมชาย ใจดี"
                    required
                  />
                </div>

                <div className="field-group">
                  <label>อีเมล <span style={{ color: "#e53e3e" }}>*</span></label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="example@email.com"
                    required
                  />
                </div>

                <div className="field-group">
                  <label>เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    placeholder="เช่น 081-234-5678"
                  />
                </div>

                <div className="field-group">
                  <label>Role</label>
                  <select
                    value={customerForm.role}
                    onChange={(e) => setCustomerForm({ ...customerForm, role: e.target.value })}
                  >
                    {customerRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="field-group" style={{ gridColumn: "1 / -1" }}>
                  <label>ที่อยู่</label>
                  <textarea
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                    rows={3}
                    placeholder="เช่น 123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                <button type="submit" className="btn">
                  {customerForm.id ? "บันทึกการแก้ไข" : "เพิ่มสมาชิก"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCustomer && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>ข้อมูลสมาชิก</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <CustomerAvatar customer={selectedCustomer} size={72} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, color: "#718096", marginBottom: 2 }}>ชื่อสมาชิก</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{selectedCustomer.name}</div>
              </div>
              <div style={{ height: 1, background: "#e2e8f0" }} />
              <div>
                <div style={{ fontSize: 13, color: "#718096", marginBottom: 2 }}>อีเมล</div>
                <div style={{ fontWeight: 500 }}>{selectedCustomer.email}</div>
              </div>
              <div style={{ height: 1, background: "#e2e8f0" }} />
              <div>
                <div style={{ fontSize: 13, color: "#718096", marginBottom: 2 }}>Role</div>
                <div style={{ fontWeight: 500 }}>{getCustomerRoleLabel(selectedCustomer.role)}</div>
              </div>
              <div style={{ height: 1, background: "#e2e8f0" }} />
              <div>
                <div style={{ fontSize: 13, color: "#718096", marginBottom: 2 }}>เบอร์โทรศัพท์</div>
                <div style={{ fontWeight: 500 }}>{selectedCustomer.phone || "-"}</div>
              </div>
              <div style={{ height: 1, background: "#e2e8f0" }} />
              <div>
                <div style={{ fontSize: 13, color: "#718096", marginBottom: 2 }}>ที่อยู่</div>
                <div style={{ fontWeight: 500, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {selectedCustomer.address || "-"}
                </div>
              </div>
              {selectedCustomer.createdAt && (
                <>
                  <div style={{ height: 1, background: "#e2e8f0" }} />
                  <div>
                    <div style={{ fontSize: 13, color: "#718096", marginBottom: 2 }}>วันที่เพิ่มเข้าระบบ</div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {new Date(selectedCustomer.createdAt).toLocaleDateString("th-TH", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => { setShowDetailModal(false); openEdit(selectedCustomer); }}
              >
                แก้ไข
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowDetailModal(false)}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="module-header">
        <div>
          <h2>สมาชิก</h2>
          <p>จัดการข้อมูลลูกค้าและสมาชิกทั้งหมด</p>
        </div>
      </div>

      {/* Messages */}
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert">{error}</div>}

      {/* Table card */}
      <div className="card">
        <div className="section-header">
          <h3>สมาชิกทั้งหมด ({filteredCustomers.length} ราย)</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร"
            />
            <button type="button" className="btn" onClick={openAdd}>
              + เพิ่มสมาชิก
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>Role</th>
                <th>เบอร์โทรศัพท์</th>
                <th>ที่อยู่</th>
                <th>วันที่สร้าง</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center">กำลังโหลดข้อมูล...</td>
                </tr>
              )}
              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center">
                    {search ? "ไม่พบสมาชิกที่ค้นหา" : "ยังไม่มีสมาชิกในระบบ"}
                  </td>
                </tr>
              )}
              {!loading &&
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setShowDetailModal(true);
                    }}
                  >
                    {/* Avatar + name */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <CustomerAvatar customer={customer} />
                        <span style={{ fontWeight: 500 }}>{customer.name}</span>
                      </div>
                    </td>
                    <td>{customer.email}</td>
                    <td>{getCustomerRoleLabel(customer.role)}</td>
                    <td>{customer.phone || <span className="text-muted">-</span>}</td>
                    <td style={{ maxWidth: 220 }}>
                      {customer.address
                        ? <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{customer.address}</span>
                        : <span className="text-muted">-</span>}
                    </td>
                    <td>
                      {customer.createdAt
                        ? new Date(customer.createdAt).toLocaleDateString("th-TH")
                        : "-"}
                    </td>
                    <td className="table-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-small"
                        type="button"
                        onClick={() => openEdit(customer)}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn btn-small btn-danger"
                        type="button"
                        onClick={() => handleDelete(customer.id, customer.name)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
