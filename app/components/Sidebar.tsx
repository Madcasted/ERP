"use client";

import { useState } from "react";
import Image from "next/image";

const navItems = [
  { id: "dashboard", label: "แดชบอร์ด", icon: "🏠" },
  { id: "inventory", label: "คลังสินค้า", icon: "📦" },
  { id: "customer", label: "สมาชิก", icon: "" },
  { id: "transaction", label: "คลังสต็อก", icon: "↕️" },
  { id: "production", label: "การผลิต", icon: "🤖" },
  { id: "machine", label: "เครื่องจักร", icon: "⚙️" },
  { id: "report", label: "รายงาน", icon: "📊" },
  { id: "system", label: "ระบบ", icon: "🛠️" },
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
    <Image
      src="/logo.png"
      alt="Logo"
      width={56}
      height={56}
      className="brand-logo"
    />
        <span className="text">ทีสยามแพ็ค</span>
      </a>

      <ul className="side-menu top">
        {navItems.map((item) => (
          <li key={item.id} className={selected === item.id ? "active" : ""}>
            <a href="#" onClick={(e) => { e.preventDefault(); onSelect?.(item.id); }}>
              <span className="nav-icon">{item.icon}</span>
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
