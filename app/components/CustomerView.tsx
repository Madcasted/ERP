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

type ManHourJob = {
  id: string;
  name: string;
  orderNumber: string;
  ownerRole: string;
  targetHours: number;
  status: "active" | "done";
  createdAt: string;
};

type ManHourLog = {
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

const customerRoleOptions = [
  { value: "EMPLOYEE", label: "พนักงาน" },
  { value: "MANAGER", label: "ผู้จัดการ" },
  { value: "EXECUTIVE", label: "ผู้บริหาร" },
];

function getCustomerRoleLabel(role?: string | null) {
  return customerRoleOptions.find((option) => option.value === role)?.label ?? role ?? "-";
}

function calcWorkHours(checkIn: string, checkOut: string) {
  const [inHour, inMinute] = checkIn.split(":").map(Number);
  const [outHour, outMinute] = checkOut.split(":").map(Number);
  const start = inHour * 60 + inMinute;
  const end = outHour * 60 + outMinute;
  const grossMinutes = Math.max(0, end - start);
  const breaks = [
    { start: 10 * 60, end: 10 * 60 + 10 },
    { start: 12 * 60, end: 13 * 60 },
    { start: 15 * 60, end: 15 * 60 + 10 },
  ];
  const breakMinutes = breaks.reduce((sum, br) => {
    const overlap = Math.max(0, Math.min(end, br.end) - Math.max(start, br.start));
    return sum + overlap;
  }, 0);
  const workMinutes = Math.max(0, grossMinutes - breakMinutes);
  const totalHours = Math.round((workMinutes / 60) * 10) / 10;
  const regularHours = Math.min(8, totalHours);
  const overtimeHours = Math.max(0, Math.round((totalHours - regularHours) * 10) / 10);
  return { regularHours, overtimeHours, totalHours, breakMinutes };
}

function readLocalArray<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalArray<T>(key: string, data: T[]) {
  window.localStorage.setItem(key, JSON.stringify(data));
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

// ─── Man Hour Panel ────────────────────────────────────────────────────────────

function ManHourPanel({ customers }: { customers: Customer[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [jobs, setJobs] = useState<ManHourJob[]>([]);
  const [logs, setLogs] = useState<ManHourLog[]>([]);
  const [jobForm, setJobForm] = useState({
    name: "",
    orderNumber: "",
    ownerRole: "EMPLOYEE",
    targetHours: 40,
  });
  const [logForm, setLogForm] = useState({
    customerId: "",
    jobId: "",
    date: today,
    checkIn: "08:00",
    checkOut: "17:00",
    note: "",
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);

  useEffect(() => {
    setJobs(readLocalArray<ManHourJob>("customer_manhour_jobs", []));
    setLogs(readLocalArray<ManHourLog>("customer_manhour_logs", []));
  }, []);

  const activeMembers = customers.filter((customer) => customer.role !== "INACTIVE");
  const activeJobs = jobs.filter((job) => job.status === "active");
  const logPreview = calcWorkHours(logForm.checkIn, logForm.checkOut);
  const selectedMember = activeMembers.find((member) => member.id === logForm.customerId);

  const logsWithMeta = logs
    .map((log) => ({
      ...log,
      customer: customers.find((customer) => customer.id === log.customerId),
      job: jobs.find((job) => job.id === log.jobId),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const totalHours = logs.reduce((sum, log) => sum + log.regularHours + log.overtimeHours, 0);
  const todayHours = logs
    .filter((log) => log.date === today)
    .reduce((sum, log) => sum + log.regularHours + log.overtimeHours, 0);
  const overtimeHours = logs.reduce((sum, log) => sum + log.overtimeHours, 0);

  const hoursByMember = activeMembers
    .map((member) => {
      const memberLogs = logs.filter((log) => log.customerId === member.id);
      const hours = memberLogs.reduce((sum, log) => sum + log.regularHours + log.overtimeHours, 0);
      const ot = memberLogs.reduce((sum, log) => sum + log.overtimeHours, 0);
      return { member, hours: Math.round(hours * 10) / 10, ot: Math.round(ot * 10) / 10 };
    })
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const memberHoursMap = new Map(hoursByMember.map((item) => [item.member.id, item]));
  const filteredMembers = activeMembers.filter((member) => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return true;
    return (
      member.name.toLowerCase().includes(keyword) ||
      member.email.toLowerCase().includes(keyword) ||
      getCustomerRoleLabel(member.role).toLowerCase().includes(keyword)
    );
  });

  function saveJobs(nextJobs: ManHourJob[]) {
    setJobs(nextJobs);
    writeLocalArray("customer_manhour_jobs", nextJobs);
  }

  function saveLogs(nextLogs: ManHourLog[]) {
    setLogs(nextLogs);
    writeLocalArray("customer_manhour_logs", nextLogs);
  }

  function addJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobForm.name.trim()) return;
    const nextJob: ManHourJob = {
      id: `MHJ${Date.now()}`,
      name: jobForm.name.trim(),
      orderNumber: jobForm.orderNumber.trim(),
      ownerRole: jobForm.ownerRole,
      targetHours: Math.max(1, Number(jobForm.targetHours) || 1),
      status: "active",
      createdAt: today,
    };
    saveJobs([nextJob, ...jobs]);
    setJobForm({ name: "", orderNumber: "", ownerRole: "EMPLOYEE", targetHours: 40 });
  }

  function addLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!logForm.customerId || !logForm.jobId) return;
    const hours = calcWorkHours(logForm.checkIn, logForm.checkOut);
    const nextLog: ManHourLog = {
      id: `MHL${Date.now()}`,
      ...logForm,
      regularHours: hours.regularHours,
      overtimeHours: hours.overtimeHours,
      note: logForm.note.trim(),
      createdAt: new Date().toISOString(),
    };
    saveLogs([nextLog, ...logs]);
    setLogForm({ customerId: "", jobId: "", date: today, checkIn: "08:00", checkOut: "17:00", note: "" });
  }

  function closeJob(id: string) {
    saveJobs(jobs.map((job) => job.id === id ? { ...job, status: "done" } : job));
  }

  function deleteLog(id: string) {
    saveLogs(logs.filter((log) => log.id !== id));
  }

  return (
    <div>
      <ul className="box-info" style={{ marginTop: 0, marginBottom: 24 }}>
        <li>
          <i className="bx bxs-user-check"></i>
          <span className="text"><h3>{activeMembers.length}</h3><p>สมาชิกที่ใช้บันทึกเวลา</p></span>
        </li>
        <li>
          <i className="bx bxs-time-five"></i>
          <span className="text"><h3>{Math.round(todayHours * 10) / 10}</h3><p>ชั่วโมงวันนี้</p></span>
        </li>
        <li>
          <i className="bx bxs-briefcase"></i>
          <span className="text"><h3>{activeJobs.length}</h3><p>งานที่กำลังทำ</p></span>
        </li>
        <li>
          <i className="bx bxs-bar-chart-alt-2" style={{ background: "#E8F1FF", color: "#2563eb" }}></i>
          <span className="text"><h3>{Math.round(totalHours * 10) / 10}</h3><p>ชั่วโมงรวมทั้งหมด</p></span>
        </li>
      </ul>

      <div className="form-grid" style={{ gridTemplateColumns: "minmax(340px, 460px) minmax(0, 1fr)", alignItems: "start" }}>
        <div className="card form-card" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%)", border: "1px solid #e4efe8" }}>
          <div className="section-header">
            <div>
              <h3>บันทึกเวลา</h3>
              <p className="sub-text" style={{ marginTop: 4 }}>ค้นหาสมาชิกจาก dropdown แล้วกรอกงานกับช่วงเวลา</p>
            </div>
          </div>
          <form onSubmit={addLog}>
            <div className="field-group">
              <label>สมาชิก</label>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMemberDropdownOpen((open) => !open);
                    setMemberSearch("");
                  }}
                  style={{
                    width: "100%",
                    minHeight: 54,
                    padding: "8px 12px",
                    borderRadius: 16,
                    border: memberDropdownOpen ? "2px solid var(--green)" : "1px solid #e6e9f0",
                    background: "white",
                    color: "var(--dark)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {selectedMember ? (
                    <>
                      <CustomerAvatar customer={selectedMember} size={38} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedMember.name}</span>
                        <span className="sub-text">{getCustomerRoleLabel(selectedMember.role)} · {selectedMember.email}</span>
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "#718096", flex: 1 }}>เลือกหรือค้นหาสมาชิก</span>
                  )}
                  {selectedMember && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="ยกเลิกสมาชิกที่เลือก"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLogForm({ ...logForm, customerId: "" });
                        setMemberSearch("");
                        setMemberDropdownOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setLogForm({ ...logForm, customerId: "" });
                          setMemberSearch("");
                          setMemberDropdownOpen(false);
                        }
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#f1f5f9",
                        color: "#718096",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <i className="bx bx-x" style={{ fontSize: 18 }} />
                    </span>
                  )}
                  <i className={`bx ${memberDropdownOpen ? "bx-chevron-up" : "bx-chevron-down"}`} style={{ fontSize: 22, color: "#718096" }} />
                </button>

                {memberDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: 0,
                      right: 0,
                      zIndex: 30,
                      background: "white",
                      border: "1px solid #e6e9f0",
                      borderRadius: 18,
                      boxShadow: "0 18px 50px rgba(15,23,42,.16)",
                      padding: 10,
                    }}
                  >
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <i className="bx bx-search" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#718096", fontSize: 18 }} />
                      <input
                        autoFocus
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="ค้นหาชื่อ, อีเมล หรือ Role"
                        style={{ paddingLeft: 38 }}
                      />
                    </div>
                    <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {filteredMembers.length === 0 && (
                        <div style={{ padding: 18, color: "#718096", textAlign: "center" }}>
                          ไม่พบสมาชิกที่ค้นหา
                        </div>
                      )}
                      {filteredMembers.map((member) => {
                        const isSelected = member.id === logForm.customerId;
                        const memberStats = memberHoursMap.get(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              setLogForm({ ...logForm, customerId: member.id });
                              setMemberSearch("");
                              setMemberDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: 10,
                              borderRadius: 14,
                              border: "none",
                              background: isSelected ? "#edf8f1" : "transparent",
                              color: "var(--dark)",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <CustomerAvatar customer={member} size={40} />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: "block", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.name}</span>
                              <span style={{ display: "block", color: "#718096", fontSize: 12, marginTop: 2 }}>{getCustomerRoleLabel(member.role)} · {member.email}</span>
                              <span style={{ display: "block", color: isSelected ? "#225d3d" : "#a0aec0", fontSize: 11, marginTop: 3 }}>
                                {memberStats ? `${memberStats.hours} ชม. · OT ${memberStats.ot}` : "ยังไม่มีบันทึก"}
                              </span>
                            </span>
                            {isSelected && <i className="bx bxs-check-circle" style={{ color: "var(--green)", fontSize: 20, flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedMember && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, background: "#edf8f1", border: "1px solid #c8eedd", marginBottom: 16 }}>
                <CustomerAvatar customer={selectedMember} size={52} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{selectedMember.name}</div>
                  <div className="sub-text">{selectedMember.email}</div>
                </div>
              </div>
            )}

            <div className="field-group">
              <label>งาน / ออเดอร์</label>
              <select value={logForm.jobId} onChange={(e) => setLogForm({ ...logForm, jobId: e.target.value })}>
                <option value="">เลือกงาน</option>
                {activeJobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field-group">
                <label>วันที่</label>
                <input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
              </div>
              <div className="field-group">
                <label>หมายเหตุ</label>
                <input value={logForm.note} onChange={(e) => setLogForm({ ...logForm, note: e.target.value })} placeholder="เพิ่มเติม" />
              </div>
              <div className="field-group">
                <label>เวลาเข้า</label>
                <input type="time" value={logForm.checkIn} onChange={(e) => setLogForm({ ...logForm, checkIn: e.target.value })} />
              </div>
              <div className="field-group">
                <label>เวลาออก</label>
                <input type="time" value={logForm.checkOut} onChange={(e) => setLogForm({ ...logForm, checkOut: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 12, borderRadius: 16, background: "white", border: "1px solid #e6e9f0" }}>
                <div className="sub-text">รวม</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--dark)" }}>{logPreview.totalHours}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 16, background: "white", border: "1px solid #e6e9f0" }}>
                <div className="sub-text">ปกติ</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--green)" }}>{logPreview.regularHours}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 16, background: "white", border: "1px solid #e6e9f0" }}>
                <div className="sub-text">OT</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#FD7238" }}>{logPreview.overtimeHours}</div>
              </div>
            </div>
            <button className="btn" type="submit" style={{ width: "100%", justifyContent: "center" }}>+ เพิ่มบันทึกเวลา</button>
          </form>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 18, background: "#fff" }}>
            <div className="section-header">
              <div>
                <h3>เพิ่มงาน</h3>
                <p className="sub-text" style={{ marginTop: 4 }}>สร้างงานก่อน แล้วนำไปเลือกตอนบันทึกเวลา</p>
              </div>
            </div>
            <form onSubmit={addJob} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "end" }}>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label>ชื่องาน</label>
                <input value={jobForm.name} onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })} placeholder="เช่น ผลิต Tray รุ่น A" />
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label>เลขออเดอร์</label>
                <input value={jobForm.orderNumber} onChange={(e) => setJobForm({ ...jobForm, orderNumber: e.target.value })} placeholder="ORD-001" />
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label>กลุ่มงาน</label>
                <select value={jobForm.ownerRole} onChange={(e) => setJobForm({ ...jobForm, ownerRole: e.target.value })}>
                  {customerRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="field-group" style={{ marginBottom: 0 }}>
                <label>เป้าหมาย</label>
                <input type="number" min={1} value={jobForm.targetHours} onChange={(e) => setJobForm({ ...jobForm, targetHours: Number(e.target.value) })} />
              </div>
              <button className="btn" type="submit" style={{ minHeight: 45 }}>เพิ่มงาน</button>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 18, background: "#fff" }}>
            <div className="section-header"><h3>สรุปรายสมาชิก</h3><span className="sub-text">OT รวม {Math.round(overtimeHours * 10) / 10} ชม.</span></div>
            {hoursByMember.length === 0 ? (
              <div className="text-center" style={{ padding: 24, color: "#888" }}>ยังไม่มีข้อมูลชั่วโมงทำงาน</div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>สมาชิก</th><th>Role</th><th>ชั่วโมงรวม</th><th>OT</th></tr></thead>
                  <tbody>
                    {hoursByMember.map(({ member, hours, ot }) => (
                      <tr key={member.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <CustomerAvatar customer={member} size={38} />
                            <div>
                              <div style={{ fontWeight: 700 }}>{member.name}</div>
                              <div className="sub-text">{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getCustomerRoleLabel(member.role)}</td>
                        <td><strong>{hours}</strong> ชม.</td>
                        <td><span style={{ color: ot > 0 ? "#FD7238" : "#718096", fontWeight: 700 }}>{ot}</span> ชม.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ background: "#fff" }}>
            <div className="section-header"><h3>งานทั้งหมด ({jobs.length})</h3></div>
            <div className="table-responsive">
              <table>
                <thead><tr><th>งาน</th><th>ออเดอร์</th><th>เป้าหมาย</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {jobs.length === 0 && <tr><td colSpan={5} className="text-center">ยังไม่มีงาน</td></tr>}
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.name}</td>
                      <td>{job.orderNumber || "-"}</td>
                      <td>{job.targetHours} ชม.</td>
                      <td>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 12px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: job.status === "done" ? "#EDF8F1" : "#FFF2C6",
                          color: job.status === "done" ? "#225D3D" : "#8A5B00",
                        }}>
                          {job.status === "done" ? "เสร็จแล้ว" : "กำลังทำ"}
                        </span>
                      </td>
                      <td>{job.status === "active" && <button className="btn btn-small" type="button" onClick={() => closeJob(job.id)}>ปิดงาน</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18, background: "#fff" }}>
        <div className="section-header">
          <div>
            <h3>บันทึกล่าสุด</h3>
            <p className="sub-text" style={{ marginTop: 4 }}>ประวัติการลงเวลาของสมาชิกทั้งหมด</p>
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead><tr><th>วันที่</th><th>สมาชิก</th><th>งาน</th><th>เข้า</th><th>ออก</th><th>ชั่วโมง</th><th>OT</th><th>จัดการ</th></tr></thead>
            <tbody>
              {logsWithMeta.length === 0 && <tr><td colSpan={8} className="text-center">ยังไม่มีบันทึกเวลา</td></tr>}
              {logsWithMeta.map((log) => (
                <tr key={log.id}>
                  <td>{log.date}</td>
                  <td>
                    {log.customer ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <CustomerAvatar customer={log.customer} size={38} />
                        <div>
                          <div style={{ fontWeight: 700 }}>{log.customer.name}</div>
                          <div className="sub-text">{getCustomerRoleLabel(log.customer.role)}</div>
                        </div>
                      </div>
                    ) : "ไม่พบสมาชิก"}
                  </td>
                  <td>{log.job?.name ?? "ไม่พบงาน"}</td>
                  <td>{log.checkIn}</td>
                  <td>{log.checkOut}</td>
                  <td><strong>{Math.round((log.regularHours + log.overtimeHours) * 10) / 10}</strong> ชม.</td>
                  <td>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      background: log.overtimeHours > 0 ? "#FFE0D3" : "#f1f5f9",
                      color: log.overtimeHours > 0 ? "#B64A17" : "#718096",
                    }}>
                      {log.overtimeHours > 0 ? `${log.overtimeHours} ชม.` : "ไม่มี OT"}
                    </span>
                  </td>
                  <td><button className="btn btn-small btn-danger" type="button" onClick={() => deleteLog(log.id)}>ลบ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const [activeTab, setActiveTab] = useState<"members" | "manhour">("members");
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
          <p>จัดการข้อมูลสมาชิกและบันทึกชั่วโมงทำงานในหน้าเดียว</p>
        </div>
      </div>

      <div className="module-tabs">
        <button
          type="button"
          className={`tab${activeTab === "members" ? " active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          สมาชิกทั้งหมด
        </button>
        <button
          type="button"
          className={`tab${activeTab === "manhour" ? " active" : ""}`}
          onClick={() => setActiveTab("manhour")}
        >
          Man Hour
        </button>
      </div>

      {/* Messages */}
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert">{error}</div>}

      {/* Table card */}
      {activeTab === "members" ? <div className="card">
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
      </div> : <ManHourPanel customers={customers} />}
    </section>
  );
}
