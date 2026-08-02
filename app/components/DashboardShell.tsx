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

  // เปิด modal ยืนยันออกจากระบบจากเมนูโปรไฟล์
  function handleRequestLogout(e: React.MouseEvent) {
    e.preventDefault();
    setProfileOpen(false);
    setLogoutConfirmOpen(true);
  }

  function handleConfirmLogout() {
    setLoggingOut(true);
    // ลบข้อมูลที่เก็บไว้ (ถ้ามี)
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
            {safeTotals.lowStock > 0 && <span className="num">{safeTotals.lowStock}</span>}
          </a>
          <div className={`notification-menu${notificationOpen ? " show" : ""}`} id="notificationMenu">
            <ul>
              <li>รายการแจ้งเตือนใหม่</li>
              <li>สินค้าคงคลังต่ำ {safeTotals.lowStock} รายการ</li>
              <li>เครื่องจักรต้องตรวจสอบ</li>
              <li>อัปเดตระบบพร้อมใช้งาน</li>
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
            <img src="https://placehold.co/600x400/png" alt="Profile" />
          </a>
          <div className={`profile-menu${profileOpen ? " show" : ""}`} id="profileMenu">
            <ul>
              <li><a href="#">โปรไฟล์</a></li>
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
            <a href="#" className="btn-download" target="_blank">
              <i className='bx bxs-cloud-download bx-fade-down-hover'></i>
              <span className="text">อัปเดต V2.5</span>
            </a>
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