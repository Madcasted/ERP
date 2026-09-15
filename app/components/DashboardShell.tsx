"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "antd";
import { Sidebar } from "./Sidebar";
import { CustomerView } from "./CustomerView";
import { InventoryView, MachineView, ProductionView, ReportView, SystemView, TransactionView } from "./ModuleViews";
import DashboardCharts from "./DashboardCharts";
import { SettingsProvider, useSettings } from "./SettingsContext";
import { SettingsPanel } from "./SettingsPanel";

type Product = any;
type MaterialReceiving = any;
type Machine = any;
type CurrentUser = { id: string; name: string; email: string; role: string; image?: string | null };
type DashboardNotification = { id: string; icon: string; title: string; detail: string; tone: "warning" | "info" };

type DashboardTotals = {
  products: number;
  lowStock: number;
  materials: number;
  machines: number;
  totalMaterialCost: number;
};

const sectionTitle: Record<string, string> = {
  dashboard: "แดชบอร์ด",
  inventory: "คลังสินค้า",
  customer: "ลูกค้า",
  transaction: "ธุรกรรม",
  production: "การผลิต",
  machine: "เครื่องจักร",
  report: "รายงาน",
  system: "ระบบ",
  settings: "ตั้งค่าระบบ",
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency", currency: "THB", maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("th-TH");

const emptyTotals: DashboardTotals = {
  products: 0,
  lowStock: 0,
  materials: 0,
  machines: 0,
  totalMaterialCost: 0,
};

const profileOverlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 2100, padding: 16,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(15, 23, 42, 0.55)",
};

const profileModalStyle: React.CSSProperties = {
  width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto",
  padding: 28, borderRadius: 16, background: "#fff",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
};

const profileModalHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22,
};

const profileCloseButtonStyle: React.CSSProperties = {
  width: 36, height: 36, border: "none", borderRadius: 10, background: "#f1f5f9",
  color: "#475569", fontSize: 25, lineHeight: 1, cursor: "pointer",
};

const profileFormGridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16,
};

const profileLabelStyle: React.CSSProperties = {
  display: "block", color: "#334155", fontSize: 13, fontWeight: 600,
};

const profileInputStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 6, padding: "10px 11px",
  border: "1px solid #cbd5e1", borderRadius: 8, outline: "none", fontSize: 14,
};

const profileAvatarStyle: React.CSSProperties = {
  width: 76, height: 76, borderRadius: "50%", flexShrink: 0, objectFit: "cover",
  border: "1px solid #cbd5e1",
};

const profileRemoveButtonStyle: React.CSSProperties = {
  marginTop: 7, padding: "4px 9px", border: "none", borderRadius: 6,
  background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontSize: 12,
};

const profileModalActionsStyle: React.CSSProperties = {
  display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 18,
  borderTop: "1px solid #e2e8f0",
};

const profileCancelButtonStyle: React.CSSProperties = {
  padding: "10px 18px", border: "1px solid #cbd5e1", borderRadius: 8,
  background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer",
};

const profileSaveButtonStyle: React.CSSProperties = {
  padding: "10px 18px", border: "none", borderRadius: 8,
  background: "#2c9e6e", color: "#fff", fontWeight: 700, cursor: "pointer",
};

// จัดระดับความเร่งด่วนของสต็อกสินค้า เพื่อขึ้นสีป้ายให้เห็นชัดเจนโดยไม่ต้องพึ่ง CSS เพิ่ม
function stockSeverity(stock: number) {
  if (stock <= 2) return { label: "วิกฤต", bg: "rgba(239,68,68,0.12)", fg: "#dc2626" };
  if (stock <= 5) return { label: "ต่ำ", bg: "rgba(245,158,11,0.14)", fg: "#b45309" };
  return { label: "ปกติ", bg: "rgba(34,197,94,0.12)", fg: "#15803d" };
}

function timeAgo(dateInput: string | Date | undefined) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

type ShellProps = {
  products?: Product[];
  totals?: Partial<DashboardTotals>;
  recentMaterials?: MaterialReceiving[];
  lowStockProducts?: Product[];
  recentMachines?: Machine[];
};

// Component ชั้นนอกทำหน้าที่แค่ครอบ SettingsProvider เพื่อให้ทุกอย่างข้างในเข้าถึง theme ได้
export default function DashboardShell(props: ShellProps) {
  return (
    <SettingsProvider>
      <DashboardShellInner {...props} />
    </SettingsProvider>
  );
}

function DashboardShellInner({
  products,
  totals,
  recentMaterials,
  lowStockProducts,
  recentMachines,
}: ShellProps) {
  // Defensive defaults: never let these be undefined, no matter what the caller passes in.
  const safeProducts: Product[] = products ?? [];
  const safeTotals: DashboardTotals = { ...emptyTotals, ...(totals ?? {}) };
  const safeRecentMaterials: MaterialReceiving[] = recentMaterials ?? [];
  const safeLowStockProducts: Product[] = lowStockProducts ?? [];
  const safeRecentMachines: Machine[] = recentMachines ?? [];

  const router = useRouter();
  const { darkMode, toggleDarkMode, sidebarDefaultCollapsed } = useSettings();

  const [selected, setSelected] = useState<string>("dashboard");
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(sidebarDefaultCollapsed);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reportView, setReportView] = useState<"graph" | "numbers">("graph");
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year">("month");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", image: "", password: "" });
  const [profileSaving, setProfileSaving] = useState(false);

  const notifications: DashboardNotification[] = [
    ...safeLowStockProducts.map((product) => ({
      id: `stock-${product.id}`,
      icon: "bx bxs-error-circle",
      title: `สต็อกต่ำ: ${product.name}`,
      detail: `เหลือ ${numberFormatter.format(Number(product.stock) || 0)} ชิ้น`,
      tone: "warning" as const,
    })),
    ...safeRecentMaterials.slice(0, 5).map((receipt) => ({
      id: `receipt-${receipt.id}`,
      icon: "bx bxs-package",
      title: `รับวัสดุเข้า: ${receipt.materialName}`,
      detail: timeAgo(receipt.createdAt),
      tone: "info" as const,
    })),
    ...safeRecentMachines.slice(0, 3).map((machine) => ({
      id: `machine-${machine.id}`,
      icon: "bx bxs-cog",
      title: `เครื่องจักรอัปเดต: ${machine.name}`,
      detail: timeAgo(machine.updatedAt),
      tone: "info" as const,
    })),
  ];

  useEffect(() => {
    fetch("/api/me").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.user) {
        setCurrentUser(data.user);
        setProfileForm({ name: data.user.name || "", email: data.user.email || "", image: data.user.image || "", password: "" });
      }
    }).catch(() => undefined);
  }, []);

  // ถ้าผู้ใช้เปลี่ยนค่า default การย่อเมนูในหน้าตั้งค่า ให้ sync ทันที (เฉพาะตอนที่ยังไม่ได้เปิด/ปิดเองระหว่างเซสชัน)
  useEffect(() => {
    setSidebarHidden(sidebarDefaultCollapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSidebar() {
    setSidebarHidden((s) => !s);
  }

  // เปิดหน้าตั้งค่าระบบจากเมนูโปรไฟล์ และปิดเมนูโปรไฟล์ทันที
  function handleGoToSettings(e: React.MouseEvent) {
    e.preventDefault();
    setSelected("settings");
    setProfileOpen(false);
  }

  function handleOpenProfile(e: React.MouseEvent) {
    e.preventDefault();
    setProfileOpen(false);
    setProfileModalOpen(true);
  }

  function handleProfileImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setProfileForm((form) => ({ ...form, image: event.target?.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleProfileSave() {
    setProfileSaving(true);
    const response = await fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    const data = await response.json().catch(() => ({}));
    setProfileSaving(false);
    if (!response.ok) {
      window.alert(data.error || "แก้ไขข้อมูลไม่สำเร็จ");
      return;
    }
    setCurrentUser(data.user);
    setProfileForm((form) => ({ ...form, password: "" }));
    setProfileModalOpen(false);
  }

  // เปิด modal ยืนยันออกจากระบบจากเมนูโปรไฟล์
  function handleRequestLogout(e: React.MouseEvent) {
    e.preventDefault();
    setProfileOpen(false);
    setLogoutConfirmOpen(true);
  }

  async function handleConfirmLogout() {
    setLoggingOut(true);
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();

    // ไปหน้า Login
    router.push("/login");
  }

  const summaryCards = [
    {
      title: "สินค้าในระบบ",
      value: numberFormatter.format(safeTotals.products ?? 0),
      detail: "รายการสินค้าทั้งหมด",
      icon: "bx bxs-package",
      accent: "green",
    },
    {
      title: "สินค้าคงคลังต่ำ",
      value: numberFormatter.format(safeTotals.lowStock ?? 0),
      detail: safeTotals.lowStock > 0 ? "ควรเติมสต็อกโดยเร็ว" : "สต็อกอยู่ในเกณฑ์ปกติ",
      icon: "bx bxs-error-circle",
      accent: "amber",
    },
    {
      title: "วัสดุในระบบ",
      value: numberFormatter.format(safeTotals.materials ?? 0),
      detail: "ชนิดวัสดุที่ติดตามอยู่",
      icon: "bx bxs-wrench",
      accent: "orange",
    },
    {
      title: "เครื่องจักร",
      value: numberFormatter.format(safeTotals.machines ?? 0),
      detail: "เครื่องจักรในโรงงาน",
      icon: "bx bxs-cog",
      accent: "blue",
    },
    {
      title: "ต้นทุนวัสดุรวม",
      value: currencyFormatter.format(safeTotals.totalMaterialCost ?? 0),
      detail: "สะสมจากใบรับวัสดุทั้งหมด",
      icon: "bx bxs-wallet",
      accent: "teal",
    },
  ];

  return (
    <div className="dashboard-shell">
      <Sidebar selected={selected} onSelect={setSelected} collapsed={sidebarHidden} />

      <section id="content">
        <nav>
          <i className='bx bx-menu bx-sm' onClick={toggleSidebar}></i>
          <a href="#" className="nav-link">{sectionTitle[selected] || "แดชบอร์ด"}</a>
          <form action="#" className={searchOpen ? "show" : ""}>
            <div className="form-input">
              <input type="search" placeholder="Search..." />
              <button
                type="submit"
                className="search-btn"
                onClick={(e) => {
                  if (window.innerWidth < 768) {
                    e.preventDefault();
                    setSearchOpen((s) => !s);
                  }
                }}
              >
                <i className='bx bx-search'></i>
              </button>
            </div>
          </form>

          <input type="checkbox" className="checkbox" id="switch-mode" checked={darkMode} readOnly hidden />
          <label className="swith-lm" htmlFor="switch-mode" onClick={() => toggleDarkMode()}>
            <i className="bx bxs-moon"></i>
            <i className="bx bx-sun"></i>
            <div className="ball"></div>
          </label>

          <a
            href="#"
            className="notification"
            id="notificationIcon"
            onClick={(e) => {
              e.preventDefault();
              setNotificationOpen((s) => !s);
              setProfileOpen(false);
            }}
          >
            <i className='bx bxs-bell bx-tada-hover'></i>
            {notifications.length > 0 && <span className="num">{notifications.length}</span>}
          </a>
          <div className={`notification-menu${notificationOpen ? " show" : ""}`} id="notificationMenu">
            <ul>
              {notifications.length === 0 ? (
                <li><i className="bx bx-check-circle" style={{ marginRight: 8 }} />ไม่มีรายการแจ้งเตือน</li>
              ) : notifications.map((notification) => (
                <li key={notification.id}>
                  <a
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setSelected("dashboard");
                      setNotificationOpen(false);
                    }}
                    style={{ display: "block", color: "inherit" }}
                  >
                    <i className={notification.icon} style={{ color: notification.tone === "warning" ? "#d97706" : "#2563eb", marginRight: 8 }} />
                    <strong style={{ display: "block", fontSize: 13 }}>{notification.title}</strong>
                    <small style={{ color: "#64748b" }}>{notification.detail}</small>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <a
            href="#"
            className="profile"
            id="profileIcon"
            onClick={(e) => {
              e.preventDefault();
              setProfileOpen((s) => !s);
              setNotificationOpen(false);
            }}
          >
            {currentUser?.image ? <img src={currentUser.image} alt={currentUser.name} /> : <span style={{ color: "white", fontWeight: 700 }}>{currentUser?.name?.charAt(0)?.toUpperCase() || "U"}</span>}
          </a>
          <div className={`profile-menu${profileOpen ? " show" : ""}`} id="profileMenu">
            <ul>
              <li><a href="#" onClick={handleOpenProfile}>โปรไฟล์ {currentUser ? `(${currentUser.name})` : ""}</a></li>
              <li>
                <a href="#" onClick={handleGoToSettings}>
                  ตั้งค่า
                </a>
              </li>
              <li>
                <a href="#" onClick={handleRequestLogout}>
                  ออกจากระบบ
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <main>
          <div className="head-title">
            <div className="left">
              <h1>{sectionTitle[selected] ?? "แดชบอร์ด"}</h1>
              <ul className="breadcrumb">
                <li>
                  <a href="#">แดชบอร์ด</a>
                </li>
                <li><i className='bx bx-chevron-right'></i></li>
                <li>
                  <a className="active" href="#">{sectionTitle[selected] || "หน้าแรก"}</a>
                </li>
              </ul>
            </div>
          </div>

          {selected === "dashboard" && (
            <>
              <section className="dashboard-hero">
                <div>
                  <p className="dashboard-eyebrow">ERP Operations Overview</p>
                  <h2>ภาพรวมคลังสินค้าและเครื่องจักรแบบเรียลไทม์</h2>
                  <p>ติดตามสถานะสินค้า วัสดุ และเครื่องจักรของโรงงานได้ในหน้าเดียว เห็นสิ่งที่ต้องจัดการก่อนทันที</p>
                </div>
                <div className="dashboard-hero-badge">
                  <span className={`chip ${safeTotals.lowStock > 0 ? "chip-warning" : "chip-success"}`}>
                    <i className="bx bxs-error-circle" /> {safeTotals.lowStock} รายการสต็อกต่ำ
                  </span>
                  <span className="chip">
                    <i className="bx bxs-wallet" /> ต้นทุนวัสดุ {currencyFormatter.format(safeTotals.totalMaterialCost ?? 0)}
                  </span>
                </div>
              </section>

              <div className="dashboard-top-tabs" role="tablist" aria-label="Dashboard summary view">
                <button
                  type="button"
                  className={`dashboard-tab ${reportView === "graph" ? "active" : ""}`}
                  onClick={() => setReportView("graph")}
                >
                  กราฟสรุป
                </button>
                <button
                  type="button"
                  className={`dashboard-tab ${reportView === "numbers" ? "active" : ""}`}
                  onClick={() => setReportView("numbers")}
                >
                  ตัวเลขปกติ
                </button>
              </div>

              <ul className="box-info">
                {summaryCards.map((card) => (
                  <li key={card.title} className={`summary-card ${card.accent}`}>
                    <i className={card.icon}></i>
                    <span className="text">
                      <h3>{card.value}</h3>
                      <p>{card.title}</p>
                      <small>{card.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="dashboard-grid">
                <div className="dashboard-section-card wide">
                  <div className="section-header">
                    <div>
                      <h3>สินค้าคงคลังต่ำ</h3>
                      <p>รายการที่ควรเติมสต็อกก่อนหมด</p>
                    </div>
                    <span className={`chip ${safeTotals.lowStock > 0 ? "chip-warning" : "chip-success"}`}>
                      {safeLowStockProducts.length} รายการ
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table>
                      <thead>
                        <tr>
                          <th>สินค้า</th>
                          <th>รหัส SKU</th>
                          <th>คลัง</th>
                          <th>คงเหลือ</th>
                          <th>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safeLowStockProducts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="empty-row">
                              ไม่มีสินค้าคงคลังต่ำในขณะนี้ ✅
                            </td>
                          </tr>
                        ) : (
                          safeLowStockProducts.map((item) => {
                            const severity = stockSeverity(item.stock ?? 0);
                            return (
                              <tr key={item.id}>
                                <td>
                                  <div className="customer-cell">
                                    <div className="avatar">{(item.name ?? "P").slice(0, 1)}</div>
                                    <strong>{item.name}</strong>
                                  </div>
                                </td>
                                <td>{item.sku ?? "-"}</td>
                                <td>{item.warehouse?.name ?? "-"}</td>
                                <td>{item.stock ?? 0} ชิ้น</td>
                                <td>
                                  <span
                                    className="status"
                                    style={{ background: severity.bg, color: severity.fg }}
                                  >
                                    {severity.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="dashboard-section-card">
                  <div className="section-header">
                    <div>
                      <h3>เครื่องจักรในระบบ</h3>
                      <p>ข้อมูลเครื่องจักรที่มีอยู่ในโรงงาน</p>
                    </div>
                    <span className="chip">{safeTotals.machines ?? 0} เครื่อง</span>
                  </div>
                  <ul className="dashboard-list">
                    {safeRecentMachines.length === 0 ? (
                      <li className="empty-row">ยังไม่มีข้อมูลเครื่องจักร</li>
                    ) : (
                      safeRecentMachines.map((machine) => (
                        <li key={machine.id}>
                          <div>
                            <strong>{machine.name}</strong>
                            <div className="sub-text">{machine.code} • {machine.description ?? "พร้อมใช้งาน"}</div>
                          </div>
                          <span className="pill">พร้อม</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="dashboard-grid secondary-grid">
                <div className="dashboard-section-card">
                  <div className="section-header">
                    <div>
                      <h3>รับวัสดุล่าสุด</h3>
                      <p>รายการรับเข้าวัสดุที่เพิ่งอัปเดต</p>
                    </div>
                  </div>
                  <ul className="dashboard-list">
                    {safeRecentMaterials.length === 0 ? (
                      <li className="empty-row">ยังไม่มีรายการรับวัสดุ</li>
                    ) : (
                      safeRecentMaterials.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{item.material?.name ?? item.materialName ?? "วัสดุ"}</strong>
                            <div className="sub-text">{item.supplier ?? "-"} • ล็อต {item.lotNumber ?? "-"}</div>
                          </div>
                          <span className="pill">{timeAgo(item.createdAt)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className="dashboard-section-card">
                  <div className="section-header">
                    <div>
                      <h3>สินค้าอัปเดตล่าสุด</h3>
                      <p>รายการสินค้าที่เพิ่งมีการเปลี่ยนแปลง</p>
                    </div>
                  </div>
                  <ul className="dashboard-list">
                    {safeProducts.length === 0 ? (
                      <li className="empty-row">ยังไม่มีข้อมูลสินค้า</li>
                    ) : (
                      safeProducts.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <div className="sub-text">{item.sku ?? "-"} • คงเหลือ {item.stock ?? 0} ชิ้น</div>
                          </div>
                          <span className="pill">{timeAgo(item.updatedAt)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="dashboard-chart-controls">
                <div>
                  <p className="dashboard-eyebrow">Business intelligence</p>
                  <h3>ภาพรวมธุรกิจแบบรายเดือน / รายไตรมาส / รายปี</h3>
                </div>
                <div className="dashboard-range-tabs">
                  {(["month", "quarter", "year"] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      className={`dashboard-tab ${timeRange === range ? "active" : ""}`}
                      onClick={() => setTimeRange(range)}
                    >
                      {range === "month" ? "รายเดือน" : range === "quarter" ? "รายไตรมาส" : "รายปี"}
                    </button>
                  ))}
                </div>
              </div>

              <DashboardCharts timeRange={timeRange} view={reportView} />
            </>
          )}

          {selected === "inventory" && <InventoryView />}
          {selected === "customer" && <CustomerView />}
          {selected === "transaction" && <TransactionView />}
          {selected === "production" && <ProductionView />}
          {selected === "machine" && <MachineView />}
          {selected === "report" && <ReportView />}
          {selected === "system" && <SystemView />}
          {selected === "settings" && <SettingsPanel />}
        </main>
      </section>

      {profileModalOpen && (
        <div style={profileOverlayStyle} onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileModalOpen(false); }}>
          <div style={profileModalStyle}>
            <div style={profileModalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>แก้ไขข้อมูลส่วนตัว</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>ข้อมูลนี้จะใช้กับบัญชีที่กำลังล็อกอินอยู่</p>
              </div>
              <button type="button" onClick={() => setProfileModalOpen(false)} style={profileCloseButtonStyle} aria-label="ปิด">×</button>
            </div>

            <div style={profileFormGridStyle}>
              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 16, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                {profileForm.image ? (
                  <img src={profileForm.image} alt={profileForm.name || "โปรไฟล์"} style={profileAvatarStyle} />
                ) : (
                  <div style={{ ...profileAvatarStyle, background: "linear-gradient(135deg, #2c9e6e, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700 }}>
                    {profileForm.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
                <div>
                  <label style={profileLabelStyle}>รูปโปรไฟล์</label>
                  <input type="file" accept="image/*" onChange={handleProfileImageChange} style={{ display: "block", marginTop: 7, fontSize: 12 }} />
                  {profileForm.image && <button type="button" onClick={() => setProfileForm((form) => ({ ...form, image: "" }))} style={profileRemoveButtonStyle}>ลบรูป</button>}
                </div>
              </div>

              <label style={profileLabelStyle}>ชื่อ
                <input value={profileForm.name} onChange={(e) => setProfileForm((form) => ({ ...form, name: e.target.value }))} style={profileInputStyle} required />
              </label>
              <label style={profileLabelStyle}>อีเมล
                <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((form) => ({ ...form, email: e.target.value }))} style={profileInputStyle} required />
              </label>
              <label style={{ ...profileLabelStyle, gridColumn: "1 / -1" }}>รูปโปรไฟล์ URL (ถ้าไม่เลือกไฟล์)
                <input value={profileForm.image.startsWith("data:") ? "" : profileForm.image} onChange={(e) => setProfileForm((form) => ({ ...form, image: e.target.value }))} placeholder="https://..." style={profileInputStyle} />
              </label>
              <label style={{ ...profileLabelStyle, gridColumn: "1 / -1" }}>รหัสผ่านใหม่
                <input type="password" value={profileForm.password} onChange={(e) => setProfileForm((form) => ({ ...form, password: e.target.value }))} placeholder="เว้นว่างถ้าไม่เปลี่ยนรหัสผ่าน" minLength={6} style={profileInputStyle} />
              </label>
            </div>

            <div style={profileModalActionsStyle}>
              <button type="button" onClick={() => setProfileModalOpen(false)} style={profileCancelButtonStyle}>ยกเลิก</button>
              <button type="button" onClick={handleProfileSave} disabled={profileSaving} style={profileSaveButtonStyle}>{profileSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ยืนยันออกจากระบบ (เรียกจากเมนูโปรไฟล์) — ใช้สไตล์ .logout-modal ร่วมกับ Sidebar */}
      <Modal
        open={logoutConfirmOpen}
        centered
        onCancel={() => setLogoutConfirmOpen(false)}
        footer={null}
        closable={false}
        width={420}
        className="logout-modal"
        maskClosable={!loggingOut}
      >
        <div className="logout-modal-body">
          <div className="logout-modal-icon">
            <i className="bx bx-power-off"></i>
          </div>
          <p className="logout-modal-title">ยืนยันการออกจากระบบ</p>
          <p className="logout-modal-desc">
            คุณต้องการออกจากระบบใช่หรือไม่?
            <br />
            ระบบจะพาคุณกลับไปยังหน้าเข้าสู่ระบบ
          </p>
        </div>
        <div className="logout-modal-actions">
          <button
            type="button"
            className="logout-modal-cancel"
            onClick={() => setLogoutConfirmOpen(false)}
            disabled={loggingOut}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="logout-modal-confirm"
            onClick={handleConfirmLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
          </button>
        </div>
      </Modal>
    </div>
  );
}