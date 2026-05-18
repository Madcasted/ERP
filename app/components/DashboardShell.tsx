"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import ReportChart from "./ReportChart";

type Product = any;
type Customer = any;
type Order = any;

export default function DashboardShell({ products, orders, totals }: { products: Product[]; orders: Order[]; totals: any }) {
  const [selected, setSelected] = useState<string>("dashboard");
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  function toggleSidebar() {
    setSidebarHidden((s) => !s);
  }

  return (
    <div className="dashboard-shell">
      <Sidebar selected={selected} onSelect={setSelected} collapsed={sidebarHidden} />

      <section id="content">
        <nav>
          <i className='bx bx-menu bx-sm' onClick={toggleSidebar}></i>
          <a href="#" className="nav-link">Categories</a>
          <form action="#">
            <div className="form-input">
              <input type="search" placeholder="Search..." />
              <button type="submit" className="search-btn" onClick={(e) => { if (window.innerWidth < 768) { e.preventDefault(); setSearchOpen((s) => !s); } }}>
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

          <a href="#" className="notification" id="notificationIcon" onClick={(e) => { e.preventDefault(); setNotificationOpen((s) => !s); setProfileOpen(false); }}>
            <i className='bx bxs-bell bx-tada-hover'></i>
            <span className="num">8</span>
          </a>
          <div className={`notification-menu${notificationOpen ? ' show' : ''}`} id="notificationMenu">
            <ul>
              <li>New message from John</li>
              <li>Your order has been shipped</li>
              <li>New comment on your post</li>
              <li>Update available for your app</li>
              <li>Reminder: Meeting at 3PM</li>
            </ul>
          </div>

          <a href="#" className="profile" id="profileIcon" onClick={(e) => { e.preventDefault(); setProfileOpen((s) => !s); setNotificationOpen(false); }}>
            <img src="https://placehold.co/600x400/png" alt="Profile" />
          </a>
          <div className={`profile-menu${profileOpen ? ' show' : ''}`} id="profileMenu">
            <ul>
              <li><a href="#">My Profile</a></li>
              <li><a href="#">Settings</a></li>
              <li><a href="#">Log Out</a></li>
            </ul>
          </div>
        </nav>

        <main>
          <div className="head-title">
            <div className="left">
              <h1>{selected === "dashboard" ? "แดชบอร์ด" : selected === "products" ? "สินค้า" : selected === "orders" ? "คำสั่งซื้อ" : "ลูกค้า"}</h1>
              <ul className="breadcrumb">
                <li>
                  <a href="#">แดชบอร์ด</a>
                </li>
                <li><i className='bx bx-chevron-right'></i></li>
                <li>
                  <a className="active" href="#">หน้าแรก</a>
                </li>
              </ul>
            </div>
            <a href="#" className="btn-download" target="_blank">
              <i className='bx bxs-cloud-download bx-fade-down-hover'></i>
              <span className="text">อัปเดต V2.5</span>
            </a>
          </div>

          <ul className="box-info">
            <li>
              <i className='bx bxs-package'></i>
              <span className="text">
                <h3>{totals.products ?? 0}</h3>
                <p>จำนวนสินค้า</p>
              </span>
            </li>
            <li>
              <i className='bx bxs-box' ></i>
              <span className="text">
                <h3>{totals.lowStock ?? 0}</h3>
                <p>สินค้าคงคลังต่ำ</p>
              </span>
            </li>
            <li>
              <i className='bx bxs-time-five'></i>
              <span className="text">
                <h3>{totals.pendingOrders ?? 0}</h3>
                <p>คำสั่งซื้อค้าง</p>
              </span>
            </li>
          </ul>

          <div className="table-data">
            <div className="order">
              <div className="head">
                <h3>คำสั่งซื้อล่าสุด</h3>
                <i className='bx bx-search'></i>
                <i className='bx bx-filter'></i>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>ผู้ใช้</th>
                    <th>วันที่สั่ง</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <img src="https://placehold.co/600x400/png" alt="" />
                        <p>{order.customer?.name ?? 'ลูกค้า'}</p>
                      </td>
                      <td>{new Date(order.createdAt || order.updatedAt || Date.now()).toLocaleDateString()}</td>
                      <td><span className={`status ${order.status === 'completed' ? 'completed' : order.status === 'pending' ? 'pending' : 'process'}`}>{order.status ?? 'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="todo">
              <div className="head">
                <h3>รายงานการเพิ่มสินค้า</h3>
              </div>
              <ReportChart />
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}
