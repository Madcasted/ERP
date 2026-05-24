"use client";

import { useState, useRef, MouseEvent } from "react";

// ─── MaterialInput Component ──────────────────────────────────────────────────

interface MaterialInputProps {
  type: "text" | "email" | "password";
  label: string;
  id: string;
}

function MaterialInput({ type, label, id }: MaterialInputProps) {
  const [focused, setFocused] = useState(false);
  const [used, setUsed] = useState(false);

  const isActive = focused || used;

  return (
    <div style={styles.group}>
      <input
        id={id}
        type={type}
        style={styles.input}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          setUsed(e.target.value.length > 0);
        }}
      />
      <span
        style={{
          ...styles.highlight,
          animation: focused ? "inputHighlighter 0.3s ease" : "none",
        }}
      />
      <span style={styles.bar}>
        <span
          style={{
            ...styles.barBefore,
            width: focused ? "50%" : "0",
          }}
        />
        <span
          style={{
            ...styles.barAfter,
            width: focused ? "50%" : "0",
          }}
        />
      </span>
      <label
        htmlFor={id}
        style={{
          ...styles.label,
          ...(isActive ? styles.labelActive : {}),
        }}
      >
        {label}
      </label>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ERPLoginForm() {
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });
  const [rippleActive, setRippleActive] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleRipple(e: MouseEvent<HTMLDivElement>) {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setRipplePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setRippleActive(false);
    // force reflow to restart animation
    requestAnimationFrame(() => setRippleActive(true));
  }

  function handleAnimationEnd() {
    setRippleActive(false);
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Helvetica, sans-serif;
          background: #f0f2f5;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes inputHighlighter {
          from { background: #2e7d32; }
          to   { width: 0; background: transparent; }
        }
        @keyframes ripple-anim {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          100% { width: 220%; padding-bottom: 220%; opacity: 0; }
        }
        .erp-btn:hover { background: #388e3c !important; }
        footer a { color: #2e7d32; text-decoration: none; transition: all .2s ease; }
        footer a:hover { text-decoration: underline; }
        footer img:hover { opacity: 1 !important; }
      `}</style>

      <div style={styles.page}>
        {/* Header */}
        <hgroup style={styles.hgroup}>
          <p style={styles.title}>ERP ระบบบริหารงาน</p>
          <p style={styles.subtitle}>
            เข้าสู่ระบบเพื่อจัดการคลังสินค้า การผลิต และรายงาน
          </p>
        </hgroup>

        {/* Card */}
        <div style={styles.card}>
          <MaterialInput id="inp-email" type="email" label="อีเมล" />
          <MaterialInput id="inp-pass" type="password" label="รหัสผ่าน" />

          {/* Button */}
          <button
            ref={btnRef}
            type="button"
            className="erp-btn"
            style={styles.btn}
          >
            เข้าสู่ระบบ
            <div style={styles.rippleWrap} onClick={handleRipple}>
              <span
                style={{
                  ...styles.rippleCircle,
                  top: ripplePos.y,
                  left: ripplePos.x,
                  animation: rippleActive
                    ? "ripple-anim 0.4s ease-in"
                    : "none",
                }}
                onAnimationEnd={handleAnimationEnd}
              />
            </div>
          </button>

          <p style={styles.note}>ทดลองใช้ได้ทันทีโดยกรอกข้อมูลใดก็ได้</p>
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <a
            href="http://www.polymer-project.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://www.polymer-project.org/images/logos/p-logo.svg"
              alt="Polymer"
              style={styles.footerImg}
            />
          </a>
          <p style={styles.footerP}>
            You Gotta Love{" "}
            <a
              href="http://www.polymer-project.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#2e7d32";
const GREEN_DARK = "#1b5e20";
const GREEN_HOVER = "#388e3c";

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "Helvetica, sans-serif",
    background: "#f0f2f5",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    WebkitFontSmoothing: "antialiased",
  },

  // header
  hgroup: {
    textAlign: "center",
    marginBottom: "1.5rem",
  },
  title: {
    fontWeight: 300,
    fontSize: 22,
    color: "#424242",
  },
  subtitle: {
    fontWeight: 300,
    fontSize: 15,
    color: GREEN,
    marginTop: "0.4rem",
  },

  // card
  card: {
    width: 360,
    margin: "0 auto",
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: 8,
    padding: "2.5rem 2rem 2rem",
    boxShadow:
      "rgba(0,0,0,0.12) 0px 1px 3px 0px, rgba(0,0,0,0.08) 0px 1px 2px 0px",
  },

  // input group
  group: {
    position: "relative",
    marginBottom: 36,
  },
  input: {
    fontSize: 17,
    padding: "10px 10px 10px 5px",
    display: "block",
    background: "transparent",
    color: "#424242",
    width: "100%",
    border: "none",
    borderRadius: 0,
    borderBottom: "1.5px solid #9e9e9e",
    outline: "none",
    transition: "border-color .2s",
  },

  // label
  label: {
    color: "#9e9e9e",
    fontSize: 16,
    fontWeight: "normal",
    position: "absolute",
    pointerEvents: "none",
    left: 5,
    top: 10,
    transition: "all 0.2s ease",
    transformOrigin: "left center",
  },
  labelActive: {
    top: -16,
    transform: "scale(0.75)",
    left: -2,
    color: GREEN,
  },

  // animated underline bar
  bar: {
    position: "relative",
    display: "block",
    width: "100%",
    height: 0,
  },
  barBefore: {
    content: "''",
    height: 2,
    bottom: 0,
    position: "absolute",
    background: GREEN,
    transition: "all 0.2s ease",
    left: "50%",
    display: "block",
  },
  barAfter: {
    content: "''",
    height: 2,
    bottom: 0,
    position: "absolute",
    background: GREEN,
    transition: "all 0.2s ease",
    right: "50%",
    display: "block",
  },

  // highlight flash
  highlight: {
    position: "absolute",
    height: "60%",
    width: 80,
    top: "25%",
    left: 0,
    pointerEvents: "none",
    opacity: 0.45,
  },

  // button
  btn: {
    position: "relative",
    display: "block",
    width: "100%",
    padding: "12px 24px",
    margin: ".5rem 0 1rem",
    color: "#fff",
    fontSize: 15,
    letterSpacing: "0.8px",
    background: GREEN,
    border: 0,
    borderBottom: `2px solid ${GREEN_DARK}`,
    borderRadius: 4,
    cursor: "pointer",
    transition: "background 0.15s ease",
    overflow: "hidden",
    fontFamily: "Helvetica, sans-serif",
  },

  // ripple
  rippleWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "transparent",
  },
  rippleCircle: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    opacity: 0,
    width: 0,
    height: 0,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.28)",
  },

  // note
  note: {
    textAlign: "center",
    fontSize: 12,
    color: "#9e9e9e",
    marginTop: "0.25rem",
  },

  // footer
  footer: {
    textAlign: "center",
    marginTop: "1.5rem",
  },
  footerImg: {
    width: 60,
    opacity: 0.7,
    transition: "opacity .2s ease",
    display: "block",
    margin: "0 auto",
  },
  footerP: {
    color: "#9e9e9e",
    fontSize: 13,
    letterSpacing: "0.3px",
    marginTop: "0.5rem",
  },
};