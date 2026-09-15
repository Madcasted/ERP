"use client";

import React from "react";
import { useSettings, FONT_SIZE_MAP, ACCENT_MAP, type FontSizeKey, type AccentKey } from "./SettingsContext";

export function SettingsPanel() {
  const {
    fontSize,
    accent,
    darkMode,
    sidebarDefaultCollapsed,
    setFontSize,
    setAccent,
    toggleDarkMode,
    setSidebarDefaultCollapsed,
    resetSettings,
  } = useSettings();

  return (
    <div className="settings-panel-wrap">
      <style>{`
        .settings-panel-wrap { display: flex; flex-direction: column; gap: 20px; }
        .settings-card-header { margin-bottom: 18px; }
        .settings-card-header h4 { margin: 0 0 4px; font-size: 1.05rem; }
        .settings-card-header p { margin: 0; font-size: 0.85rem; color: #94a3b8; }

        .settings-fontsize-row { display: flex; gap: 10px; flex-wrap: wrap; }
        .settings-fontsize-btn {
          flex: 1 1 140px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          border-radius: 12px;
          padding: 14px 12px;
          cursor: pointer;
          text-align: left;
          transition: all .15s ease;
        }
        .settings-fontsize-btn:hover { border-color: var(--accent-color, #2c9e6e); }
        .settings-fontsize-btn strong { display: block; font-size: 1rem; margin-bottom: 2px; }
        .settings-fontsize-btn span { font-size: 0.75rem; opacity: 0.75; }
        .settings-fontsize-preview { font-weight: 700; margin-top: 6px; }

        .settings-swatch-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .settings-swatch-item { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; background: none; border: none; }
        .settings-swatch {
          width: 44px; height: 44px; border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.06);
          transition: transform .15s ease;
        }
        .settings-swatch-item:hover .settings-swatch { transform: scale(1.08); }
        .settings-swatch-item span { font-size: 0.72rem; color: #64748b; text-align: center; max-width: 72px; }

        .settings-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 12px;
        }
        .settings-toggle-row + .settings-toggle-row { margin-top: 10px; }
        .settings-toggle-row-label strong { display: block; font-size: 0.92rem; }
        .settings-toggle-row-label small { color: #94a3b8; font-size: 0.78rem; }

        .settings-toggle {
          width: 46px; height: 26px; border-radius: 999px; background: #cbd5e1;
          position: relative; border: none; cursor: pointer; flex-shrink: 0;
          transition: background .15s ease;
        }
        .settings-toggle::after {
          content: ""; position: absolute; top: 3px; left: 3px;
          width: 20px; height: 20px; border-radius: 50%; background: #fff;
          transition: transform .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.25);
        }
        .settings-toggle.on::after { transform: translateX(20px); }

        .settings-reset-btn {
          border: 1.5px solid #ef4444; color: #ef4444; background: #fff;
          padding: 10px 18px; border-radius: 10px; cursor: pointer; font-weight: 600;
          font-size: 0.85rem; align-self: flex-start;
        }
        .settings-reset-btn:hover { background: rgba(239,68,68,0.08); }
      `}</style>

      <div className="dashboard-section-card">
        <div className="section-header settings-card-header">
          <div>
            <h4>ขนาดตัวอักษร</h4>
            <p>ปรับให้เหมาะกับสายตาและขนาดหน้าจอที่ใช้งาน มีผลทั้งระบบทันที</p>
          </div>
        </div>
        <div className="settings-fontsize-row">
          {(Object.keys(FONT_SIZE_MAP) as FontSizeKey[]).map((key) => {
            const item = FONT_SIZE_MAP[key];
            const isSelected = fontSize === key;
            return (
              <button
                key={key}
                type="button"
                className={`settings-fontsize-btn ${isSelected ? "selected" : ""}`}
                onClick={() => setFontSize(key)}
              >
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
                <div className="settings-fontsize-preview" style={{ fontSize: item.px }}>Aa ตัวอย่าง</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="dashboard-section-card">
        <div className="section-header settings-card-header">
          <div>
            <h4>โทนสีหลักของระบบ</h4>
            <p>ใช้กับเมนูที่กำลังเลือก แท็บ และปุ่มหลัก โดยไม่กระทบสีสถานะ (สำเร็จ/เตือน/ผิดพลาด)</p>
          </div>
        </div>
        <div className="settings-swatch-row">
          {(Object.keys(ACCENT_MAP) as AccentKey[]).map((key) => {
            const item = ACCENT_MAP[key];
            const isSelected = accent === key;
            return (
              <button
                key={key}
                type="button"
                className="settings-swatch-item"
                onClick={() => setAccent(key)}
              >
                <span
                  className={`settings-swatch ${isSelected ? "selected" : ""}`}
                  style={{ background: item.hex }}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="dashboard-section-card">
        <div className="section-header settings-card-header">
          <div>
            <h4>การแสดงผลและเมนู</h4>
            <p>ตั้งค่าพฤติกรรมทั่วไปของหน้าจอ</p>
          </div>
        </div>

        <div className="settings-toggle-row">
          <div className="settings-toggle-row-label">
            <strong>โหมดมืด (Dark mode)</strong>
            <small>ลดแสงจ้าเมื่อใช้งานในที่แสงน้อย</small>
          </div>
          <button
            type="button"
            className={`settings-toggle ${darkMode ? "on" : ""}`}
            onClick={toggleDarkMode}
            aria-pressed={darkMode}
            aria-label="สลับโหมดมืด"
          />
        </div>

        <div className="settings-toggle-row">
          <div className="settings-toggle-row-label">
            <strong>ย่อเมนูด้านข้างเป็นค่าเริ่มต้น</strong>
            <small>เหมาะกับผู้ที่ต้องการพื้นที่หน้าจอมากขึ้น</small>
          </div>
          <button
            type="button"
            className={`settings-toggle ${sidebarDefaultCollapsed ? "on" : ""}`}
            onClick={() => setSidebarDefaultCollapsed(!sidebarDefaultCollapsed)}
            aria-pressed={sidebarDefaultCollapsed}
            aria-label="ย่อเมนูด้านข้างเป็นค่าเริ่มต้น"
          />
        </div>
      </div>

      <div className="dashboard-section-card">
        <div className="section-header settings-card-header">
          <div>
            <h4>คืนค่าเริ่มต้น</h4>
            <p>ล้างการตั้งค่าทั้งหมดกลับไปเป็นค่าเริ่มต้นของระบบ</p>
          </div>
        </div>
        <button type="button" className="settings-reset-btn" onClick={resetSettings}>
          <i className="bx bx-reset" style={{ marginRight: 6 }} />
          คืนค่าเริ่มต้นทั้งหมด
        </button>
      </div>
    </div>
  );
}