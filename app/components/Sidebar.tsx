"use client";

import { useState } from "react";

const navItems = [
  { id: "dashboard", label: "แดชบอร์ด", icon: "🏠" },
  { id: "products", label: "สินค้า", icon: "📦" },
  { id: "orders", label: "คำสั่งซื้อ", icon: "🧾" },
  { id: "customers", label: "ลูกค้า", icon: "👥" },
];

type Props = {
  selected?: string;
  onSelect?: (id: string) => void;
};

export function Sidebar({ selected = "dashboard", onSelect, collapsed = false, onToggleCollapse }: Props & { collapsed?: boolean; onToggleCollapse?: () => void }) {
  const expanded = !collapsed;

  return (
    <section id="sidebar" className={collapsed ? "hide" : ""}>
      <a href="#" className="brand" onClick={(e) => { e.preventDefault(); onSelect?.("dashboard"); }}>
        <i className='bx bxs-smile bx-lg'></i>
        <span className="text">ทีสยามแพ็ค</span>
      </a>

      <ul className="side-menu top">
        {navItems.map((item) => (
          <li key={item.id} className={selected === item.id ? "active" : ""}>
            <a href="#" onClick={(e) => { e.preventDefault(); onSelect?.(item.id); }}>
              <i className={`bx ${item.id === 'dashboard' ? 'bxs-dashboard' : item.id === 'products' ? 'bxs-shopping-bag-alt' : item.id === 'orders' ? 'bxs-doughnut-chart' : 'bxs-group'} bx-sm`}></i>
              <span className="text">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <ul className="side-menu bottom">
        <li>
          <a href="#" onClick={(e) => e.preventDefault()}>
            <i className='bx bxs-cog bx-sm bx-spin-hover'></i>
            <span className="text">Settings</span>
          </a>
        </li>
        <li>
          <a href="#" className="logout" onClick={(e) => e.preventDefault()}>
            <i className='bx bx-power-off bx-sm bx-burst-hover'></i>
            <span className="text">Logout</span>
          </a>
        </li>
      </ul>
    </section>
  );
}
