"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type FontSizeKey = "sm" | "md" | "lg" | "xl";
export type AccentKey = "green" | "blue" | "purple" | "amber" | "teal" | "rose";

type SettingsState = {
  fontSize: FontSizeKey;
  accent: AccentKey;
  darkMode: boolean;
  sidebarDefaultCollapsed: boolean;
};

type SettingsContextValue = SettingsState & {
  setFontSize: (v: FontSizeKey) => void;
  setAccent: (v: AccentKey) => void;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  setSidebarDefaultCollapsed: (v: boolean) => void;
  resetSettings: () => void;
};

export const FONT_SIZE_MAP: Record<FontSizeKey, { label: string; px: number; detail: string }> = {
  sm: { label: "เล็ก", px: 14, detail: "เหมาะกับจอใหญ่ ต้องการเห็นข้อมูลเยอะ" },
  md: { label: "ปกติ", px: 16, detail: "ค่ามาตรฐาน อ่านง่ายสมดุล" },
  lg: { label: "ใหญ่", px: 18, detail: "อ่านสบายตาขึ้น" },
  xl: { label: "ใหญ่พิเศษ", px: 20, detail: "เหมาะกับผู้ที่ต้องการตัวอักษรชัดมาก" },
};

export const ACCENT_MAP: Record<AccentKey, { label: string; hex: string; soft: string }> = {
  green: { label: "เขียวธรรมชาติ", hex: "#2c9e6e", soft: "rgba(44,158,110,0.14)" },
  blue: { label: "น้ำเงินสุภาพ", hex: "#2563eb", soft: "rgba(37,99,235,0.14)" },
  purple: { label: "ม่วงหรูหรา", hex: "#7c3aed", soft: "rgba(124,58,237,0.14)" },
  amber: { label: "ส้มอบอุ่น", hex: "#ea580c", soft: "rgba(234,88,12,0.14)" },
  teal: { label: "ฟ้าเทอร์ควอยซ์", hex: "#0d9488", soft: "rgba(13,148,136,0.14)" },
  rose: { label: "แดงมาดมั่น", hex: "#e11d48", soft: "rgba(225,29,72,0.14)" },
};

const DEFAULT_SETTINGS: SettingsState = {
  fontSize: "md",
  accent: "green",
  darkMode: false,
  sidebarDefaultCollapsed: false,
};

const STORAGE_KEY = "erp_dashboard_settings_v1";

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // โหลดค่าที่บันทึกไว้จาก localStorage ตอน mount ครั้งแรกเท่านั้น
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {
      // ถ้า parse ไม่ได้ก็ใช้ค่า default ต่อไป ไม่ต้องพัง
    }
    setHydrated(true);
  }, []);

  // บันทึกทุกครั้งที่มีการเปลี่ยนแปลง (หลัง hydrate แล้วเท่านั้น กันการเขียนทับด้วยค่า default ตอนเริ่ม)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // เพิกเฉยถ้า storage เต็มหรือถูกบล็อก
    }
  }, [settings, hydrated]);

  useEffect(() => {
    document.body.classList.toggle("dark", settings.darkMode);
  }, [settings.darkMode]);

  const update = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const value: SettingsContextValue = {
    ...settings,
    setFontSize: (v) => update("fontSize", v),
    setAccent: (v) => update("accent", v),
    setDarkMode: (v) => update("darkMode", v),
    toggleDarkMode: () => update("darkMode", !settings.darkMode),
    setSidebarDefaultCollapsed: (v) => update("sidebarDefaultCollapsed", v),
    resetSettings: () => setSettings(DEFAULT_SETTINGS),
  };

  const accent = ACCENT_MAP[settings.accent];
  const fontPx = FONT_SIZE_MAP[settings.fontSize].px;

  return (
    <SettingsContext.Provider value={value}>
      {/*
        ฉีด CSS ตัวแปรและกฎ global แบบ inline เพื่อให้ธีม/ขนาดตัวอักษรมีผลจริง
        โดยไม่ต้องแก้ไฟล์ CSS หลักของโปรเจกต์ — ปลอดภัยต่อ layout เดิม
        เพราะ override เฉพาะจุดที่เป็น "สีเน้น" (accent) ไม่แตะสีสถานะ (success/warning/error)
      */}
      <style id="dashboard-dynamic-settings">{`
        :root {
          --app-font-size: ${fontPx}px;
          --accent-color: ${accent.hex};
          --accent-soft: ${accent.soft};
        }
        html { font-size: ${fontPx}px; }

        #sidebar .side-menu li.active a {
          background: var(--accent-soft) !important;
          color: var(--accent-color) !important;
        }
        #sidebar .side-menu li.active a i,
        #sidebar .side-menu li.active a .nav-icon {
          color: var(--accent-color) !important;
        }
        #sidebar .brand .text {
          color: var(--accent-color);
        }
        #sidebar .side-menu li a:hover {
          background: var(--accent-soft) !important;
        }
        .dashboard-tab.active {
          background: var(--accent-color) !important;
          border-color: var(--accent-color) !important;
          color: #fff !important;
        }
        .btn-download {
          background: var(--accent-color) !important;
          border-color: var(--accent-color) !important;
        }
        .chip-accent {
          background: var(--accent-soft) !important;
          color: var(--accent-color) !important;
        }
        .settings-swatch.selected {
          box-shadow: 0 0 0 3px var(--accent-soft), 0 0 0 2px var(--accent-color) inset;
        }
        .settings-fontsize-btn.selected {
          background: var(--accent-color) !important;
          border-color: var(--accent-color) !important;
          color: #fff !important;
        }
        .settings-toggle.on {
          background: var(--accent-color) !important;
        }
        ::selection {
          background: var(--accent-soft);
        }
      `}</style>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}