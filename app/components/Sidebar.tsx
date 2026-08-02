"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "antd";

const navItems = [
  { id: "dashboard", label: "แดชบอร์ด", icon: "bx bxs-dashboard" },
  { id: "inventory", label: "คลังสินค้า", icon: "bx bxs-package" },
  { id: "customer", label: "สมาชิก", icon: "bx bxs-user-detail" },
  { id: "transaction", label: "คลังสต็อก", icon: "bx bx-transfer-alt" },
  { id: "production", label: "การผลิต", icon: "bx bxs-factory" },
  { id: "machine", label: "เครื่องจักร", icon: "bx bxs-cog" },
  { id: "report", label: "รายงาน", icon: "bx bxs-bar-chart-alt-2" },
  { id: "settings", label: "ตั้งค่าระบบ", icon: "bx bx-cog" },
];

type Props = {
  selected?: string;
  onSelect?: (id: string) => void;
  collapsed?: boolean;
};

export function Sidebar({
  selected = "dashboard",
  onSelect,
  collapsed = false,
}: Props) {
  const router = useRouter();
  const [openLogout, setOpenLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setLoggingOut(true);
    // ลบข้อมูลที่เก็บไว้ (ถ้ามี)
    localStorage.clear();
    sessionStorage.clear();

    // ไปหน้า Login
    router.push("/login");
  };

  return (
    <>
      <section id="sidebar" className={collapsed ? "hide" : ""}>
        <style>{`
          #sidebar {
            transition: width .25s ease;
          }

          #sidebar.hide {
            width: 78px !important;
            min-width: 78px !important;
            overflow: hidden !important;
            z-index: 50;
            background: #fff;
          }

          body.dark #sidebar.hide {
            background: #1e293b;
          }

          #sidebar.hide .text,
          #sidebar.hide small {
            display: none !important;
          }

          #sidebar.hide .brand {
            justify-content: center;
            padding: 20px 0;
          }

          #sidebar.hide .brand-logo {
            margin: 0 !important;
          }

          #sidebar.hide .side-menu.top,
          #sidebar.hide .side-menu.bottom {
            padding-left: 0;
            padding-right: 0;
          }

          #sidebar.hide .side-menu li a {
            justify-content: center !important;
            padding: 12px 0 !important;
            margin: 4px 8px;
          }

          #sidebar.hide .side-menu li a i {
            margin: 0 !important;
            font-size: 1.35rem;
          }

          /* ===== Logout confirmation modal ===== */
          .logout-modal .ant-modal-content {
            padding: 0;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.35);
          }

          .logout-modal .ant-modal-body {
            padding: 0;
          }

          .logout-modal-body {
            padding: 36px 36px 24px;
            text-align: center;
          }

          .logout-modal-icon {
            width: 60px;
            height: 60px;
            margin: 0 auto 18px;
            border-radius: 16px;
            background: #fee2e2;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .logout-modal-icon i {
            font-size: 28px;
            color: #dc2626;
          }

          .logout-modal-title {
            font-size: 1.05rem;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 8px;
          }

          .logout-modal-desc {
            font-size: 0.875rem;
            color: #64748b;
            line-height: 1.6;
            margin: 0;
          }

          .logout-modal-actions {
            display: flex;
            gap: 12px;
            padding: 0 36px 28px;
          }

          .logout-modal-actions button {
            flex: 1;
            border: none;
            border-radius: 12px;
            padding: 11px 16px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform .15s ease, box-shadow .15s ease, background .15s ease, opacity .15s ease;
          }

          .logout-modal-actions button:active {
            transform: scale(0.97);
          }

          .logout-modal-cancel {
            background: #f1f5f9;
            color: #334155;
          }

          .logout-modal-cancel:hover {
            background: #e2e8f0;
          }

          .logout-modal-confirm {
            background: #dc2626;
            color: #fff;
            box-shadow: 0 8px 16px -6px rgba(220, 38, 38, 0.45);
          }

          .logout-modal-confirm:hover {
            background: #b91c1c;
          }

          .logout-modal-confirm:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          body.dark .logout-modal .ant-modal-content {
            background: #1e293b;
          }

          body.dark .logout-modal-title {
            color: #f1f5f9;
          }

          body.dark .logout-modal-desc {
            color: #94a3b8;
          }

          body.dark .logout-modal-cancel {
            background: #334155;
            color: #e2e8f0;
          }

          body.dark .logout-modal-cancel:hover {
            background: #475569;
          }
        `}</style>

        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onSelect?.("dashboard");
          }}
        >
          <Image
            src="/logo.png"
            alt="Logo"
            width={44}
            height={44}
            className="brand-logo"
          />

          <span className="text">
            ทีสยามแพ็ค
            <small
              style={{
                display: "block",
                fontSize: "0.65rem",
                fontWeight: 500,
                opacity: 0.6,
                letterSpacing: "0.04em",
              }}
            >
              ERP SYSTEM
            </small>
          </span>
        </a>

        <ul className="side-menu top">
          {navItems.map((item) => (
            <li
              key={item.id}
              className={selected === item.id ? "active" : ""}
              title={collapsed ? item.label : undefined}
            >
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onSelect?.(item.id);
                }}
              >
                <i className={`${item.icon} bx-sm`}></i>
                <span className="text">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>

        <ul className="side-menu bottom">
          <li>
            <a
              href="#"
              className="logout"
              title={collapsed ? "ออกจากระบบ" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setOpenLogout(true);
              }}
            >
              <i className="bx bx-power-off bx-sm bx-burst-hover"></i>
              <span className="text">ออกจากระบบ</span>
            </a>
          </li>
        </ul>
      </section>

      {/* Modal ยืนยันออกจากระบบ */}
      <Modal
        open={openLogout}
        centered
        onCancel={() => setOpenLogout(false)}
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
            onClick={() => setOpenLogout(false)}
            disabled={loggingOut}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="logout-modal-confirm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "กำลังออก..." : "ออกจากระบบ"}
          </button>
        </div>
      </Modal>
    </>
  );
}