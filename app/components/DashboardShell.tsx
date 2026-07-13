"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { CustomerView } from "./CustomerView";
import { InventoryView, MachineView, ProductionView, ReportView, SystemView, TransactionView } from "./ModuleViews";
import DashboardCharts from "./DashboardCharts";

type Product = any;
type Order = any;
type MaterialReceiving = any;
type Machine = any;

type DashboardTotals = {
  products: number;
  lowStock: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  customers: number;
  materials: number;
  machines: number;
  orders: number;
  totalRevenue: number;
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
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export default function DashboardShell({
  products,
  orders,
  totals,
  recentMaterials,
  lowStockProducts,
  recentMachines,
}: {
  products: Product[];
  orders: Order[];
  totals: DashboardTotals;
  recentMaterials: MaterialReceiving[];
  lowStockProducts: Product[];
  recentMachines: Machine[];
}) {
  const [selected, setSelected] = useState<string>("dashboard");
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reportView, setReportView] = useState<"graph" | "numbers">("graph");
  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year">("month");

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  function toggleSidebar() {
    setSidebarHidden((s) => !s);
  }

  const summaryCards = [
    {
      title: "สินค้าในระบบ",
      value: totals.products ?? 0,
      detail: "รายการสินค้า",
      icon: "bx bxs-package",
      accent: "green",
    },
    {
      title: "สินค้าคงคลังต่ำ",
      value: totals.lowStock ?? 0,
      detail: "ต้องเติมสต็อก",
      icon: "bx bxs-box",
      accent: "amber",
    },
    {
      title: "คำสั่งซื้อทั้งหมด",
      value: totals.orders ?? 0,
      detail: `${totals.deliveredOrders ?? 0} สำเร็จ`,
      icon: "bx bxs-cart-alt",
      accent: "blue",
    },
    {
      title: "ลูกค้า",
      value: totals.customers ?? 0,
      detail: "ลูกค้าทั้งหมด",
      icon: "bx bxs-user-detail",
      accent: "purple",
    },
    {
      title: "วัสดุ",
      value: totals.materials ?? 0,
      detail: "รายการวัสดุ",
      icon: "bx bxs-wrench",
      accent: "orange",
    },
    {
      title: "รายได้รวม",
      value: currencyFormatter.format(totals.totalRevenue ?? 0),
      detail: "จากคำสั่งซื้อ",
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

          <input type="checkbox" className="checkbox" id="switch-mode" hidden />
          <label className="swith-lm" htmlFor="switch-mode" onClick={() => setDarkMode((d) => !d)}>
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
            <span className="num">8</span>
          </a>
          <div className={`notification-menu${notificationOpen ? " show" : ""}`} id="notificationMenu">
            <ul>
              <li>รายการแจ้งเตือนใหม่</li>
              <li>สินค้าคงคลังต่ำ</li>
              <li>คำสั่งซื้อรอจัดส่ง</li>
              <li>เครื่องจักรต้องซ่อม</li>
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
              <li><a href="#">ตั้งค่า</a></li>
              <li><a href="#">ออกจากระบบ</a></li>
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
                  <h2>ภาพรวมธุรกิจของคุณในมุมมองที่สวยและเข้าใจง่าย</h2>
                  <p>ติดตามสถานะสินค้า ลูกค้า ออเดอร์ วัสดุ และเครื่องจักรแบบครบถ้วนจากข้อมูลระบบจริง</p>
                </div>
                <div className="dashboard-hero-badge">
                  <span className="chip chip-success">{totals.pendingOrders ?? 0} คำสั่งซื้อรอการยืนยัน</span>
                  <span className="chip">{totals.confirmedOrders ?? 0} อยู่ระหว่างดำเนินการ</span>
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
                      <h3>คำสั่งซื้อล่าสุด</h3>
                      <p>ภาพรวมออเดอร์ที่เพิ่งเข้ามาในระบบ</p>
                    </div>
                    <span className="chip chip-success">{totals.deliveredOrders ?? 0} ส่งสำเร็จ</span>
                  </div>
                  <div className="table-responsive">
                    <table>
                      <thead>
                        <tr>
                          <th>ลูกค้า</th>
                          <th>วันที่สั่ง</th>
                          <th>ยอดรวม</th>
                          <th>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <div className="customer-cell">
                                <div className="avatar">{(order.customer?.name ?? "C").slice(0, 1)}</div>
                                <div>
                                  <strong>{order.customer?.name ?? "ลูกค้า"}</strong>
                                  <div className="sub-text">{order.items?.length ? `${order.items.length} รายการ` : "-"}</div>
                                </div>
                              </div>
                            </td>
                            <td>{new Date(order.createdAt || order.updatedAt || Date.now()).toLocaleDateString("th-TH")}</td>
                            <td>{currencyFormatter.format(order.total ?? 0)}</td>
                            <td>
                              <span className={`status ${order.status === "DELIVERED" ? "completed" : order.status === "PENDING" ? "pending" : "process"}`}>
                                {order.status ?? "PENDING"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="dashboard-section-card">
                  <div className="section-header">
                    <div>
                      <h3>สินค้าคงคลังต่ำ</h3>
                      <p>รายการที่ควรเติมสต็อก</p>
                    </div>
                  </div>
                  <ul className="dashboard-list">
                    {lowStockProducts.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <div className="sub-text">{item.sku} • {item.warehouse?.name ?? "-"}</div>
                        </div>
                        <span className="pill">{item.stock} ชิ้น</span>
                      </li>
                    ))}
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
                    {recentMaterials.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.material?.name ?? "วัสดุ"}</strong>
                          <div className="sub-text">{item.supplier} • {item.lotNumber}</div>
                        </div>
                        <span className="pill">{item.quantity} {item.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="dashboard-section-card">
                  <div className="section-header">
                    <div>
                      <h3>เครื่องจักรในระบบ</h3>
                      <p>ข้อมูลเครื่องจักรที่มีอยู่ในโรงงาน</p>
                    </div>
                    <span className="chip">{totals.machines ?? 0} เครื่อง</span>
                  </div>
                  <ul className="dashboard-list">
                    {recentMachines.map((machine) => (
                      <li key={machine.id}>
                        <div>
                          <strong>{machine.name}</strong>
                          <div className="sub-text">{machine.code} • {machine.description ?? "พร้อมใช้งาน"}</div>
                        </div>
                        <span className="pill">พร้อม</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <DashboardCharts timeRange={timeRange} />
            </>
          )}

          {selected === "inventory" && <InventoryView />}
          {selected === "customer" && <CustomerView />}
          {selected === "transaction" && <TransactionView />}
          {selected === "production" && <ProductionView />}
          {selected === "machine" && <MachineView />}
          {selected === "report" && <ReportView />}
          {selected === "system" && <SystemView />}
        </main>
      </section>
    </div>
  );
}
