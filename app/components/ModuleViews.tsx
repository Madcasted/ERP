"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import ReportChart from "./ReportChart";
import { MaterialReceivingTable } from "./MaterialReceivingTable";
import { MaterialWIPView } from "./MaterialWIPView";

// ─── Responsive Hook ──────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LabelLot = { id: string; lot: string; qty: number; date: string };
type SignatureMode = "text" | "image";

type Product = {
  id: string;
  name: string;
  sku: string;
  qrCode?: string | null;
  qrColor?: string | null;
  image?: string | null;
  labelCompany?: string | null;
  labelSize?: string | null;
  labelLot?: string | null;
  labelDate?: string | null;
  labelQty?: number | null;
  labelPcs?: string | null;
  labelInspector?: string | null;
  labelQc1?: string | null;
  labelQc1Mode?: SignatureMode | null;
  labelQc1Image?: string | null;
  labelQc2?: string | null;
  labelQc2Mode?: SignatureMode | null;
  labelQc2Image?: string | null;
  labelWarning?: string | null;
  labelLots?: LabelLot[] | null;
  printCount?: number | null;
  type: string;
  stock: number;
  price: number;
  description?: string | null;
  details?: string | null;
  warehouseId?: string | null;
  warehouse?: Warehouse | null;
  materials?: ProductMaterialDetail[];
  createdAt?: string;
  updatedAt: string;
};

type ProductMaterialDetail = {
  id: string;
  material: Material;
  quantity: number;
  unitPrice: number;
};

type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  customer?: { name: string };
  items?: Array<{ product?: { name: string }; quantity: number; price: number }>;
};

type TransactionType = "TRANSFER" | "SHIP";

type TransactionHistoryItem = {
  id: string;
  type: TransactionType;
  productName: string;
  sku: string;
  quantity: number;
  from: string;
  to: string;
  timestamp: string;
  note: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Material = {
  id: string;
  name: string;
  unit: string | null;
  unitPrice: number;
  description?: string | null;
  supplier?: string | null;
  invoiceNo?: string | null;
  productCode?: string | null;
  weight?: number | null;
  receivingDate?: string | null;
  lotNumber?: string | null;
  receivingLots?: MaterialReceiving[];
};

type MaterialReceiving = {
  id: string;
  supplier: string;
  invoiceNo: string;
  lotNumber: string;
  productCode?: string | null;
  weight: number;
  quantity: number;
  unit: string;
  receivingDate: string;
  qcStatus?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Warehouse = {
  id: string;
  name: string;
  location?: string | null;
  image?: string | null;
};

type ProductForm = {
  id?: string;
  name: string;
  sku: string;
  type: string;
  stock: number;
  price: number;
  warehouseId: string;
  qrCode: string;
  qrColor: string;
  image: string | null;
  description: string;
  details: string;
  // Excel-label extra fields
  labelCompany: string;
  labelSize: string;
  labelLot: string;
  labelDate: string;
  labelQty: number;
  labelPcs: string;
  labelInspector: string;
  labelQc1: string;
  labelQc1Mode: SignatureMode;
  labelQc1Image: string | null;
  labelQc2: string;
  labelQc2Mode: SignatureMode;
  labelQc2Image: string | null;
  labelWarning: string;
  // Multi-lot: array of { lot, qty, date } entries
  labelLots: LabelLot[];
  // How many copies to print
  printCount: number;
};

type MaterialForm = {
  id?: string;
  name: string;
  unit: string;
  unitPrice: number;
  description: string;
  supplier?: string;
  invoiceNo?: string;
  productCode?: string;
  weight?: number;
  lotNumber?: string;
  receivingDate?: string;
};

type WarehouseForm = {
  id?: string;
  name: string;
  location: string;
  image: string | null;
};

// ─── QR Color Options ─────────────────────────────────────────────────────────

const QR_COLORS = [
  { label: "ดำ",     value: "#000000" },
  { label: "เขียว",  value: "#16a34a" },
  { label: "แดง",    value: "#dc2626" },
  { label: "เหลือง", value: "#ca8a04" },
  { label: "น้ำเงิน",value: "#1d4ed8" },
];

function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ─── drawLabelOnCanvas ────────────────────────────────────────────────────────
// 80×50 mm → canvas 960×600 @2×
// Layout:
//  [header]
//  LEFT: NAME/SIZE/LOT/DATE/QTY | RIGHT-TOP: badge
//  LEFT: QC row                 | RIGHT-BOT: QR + small ↑ beside it
//  LEFT: warning

function drawLabelOnCanvas(
  canvas: HTMLCanvasElement,
  opts: {
    company: string; name: string; size: string; lot: string;
    date: string; qty: number | string; pcs: string;
    inspector: string; qc1: string; qc2: string;
    qc1Mode?: SignatureMode; qc2Mode?: SignatureMode;
    warning: string; qrCode: string; color: string;
    qrImg?: HTMLImageElement | null;
    qc1Img?: HTMLImageElement | null;
    qc2Img?: HTMLImageElement | null;
  }
): void {
  const { company, name, size, lot, date, qty, pcs,
          inspector, qc1, qc2, qc1Mode = "text", qc2Mode = "text",
          warning, qrCode, color, qrImg, qc1Img, qc2Img } = opts;

  // ── ctx guard — TypeScript-safe, no "!" needed anywhere ──
  const maybeCtx = canvas.getContext("2d");
  if (maybeCtx === null) return;
  const ctx: CanvasRenderingContext2D = maybeCtx;   // narrowed — non-null

  const W = 960, H = 600;
  canvas.width = W; canvas.height = H;

  // Parse color once
  const hex = color.replace("#", "");
  const cR = parseInt(hex.slice(0, 2), 16) || 0;
  const cG = parseInt(hex.slice(2, 4), 16) || 0;
  const cB = parseInt(hex.slice(4, 6), 16) || 0;

  // ── tintQR — recolor dark pixels to `color` ──
  function tintAndDraw(img: HTMLImageElement, sz: number, x: number, y: number): void {
    const off = document.createElement("canvas");
    off.width = img.width; off.height = img.height;
    const maybeOc = off.getContext("2d");
    if (maybeOc === null) return;
    const oc: CanvasRenderingContext2D = maybeOc;   // narrowed
    oc.drawImage(img, 0, 0);
    const id = oc.getImageData(0, 0, off.width, off.height);
    for (let i = 0; i < id.data.length; i += 4) {
      const br = (id.data[i] + id.data[i + 1] + id.data[i + 2]) / 3;
      if (br < 128) { id.data[i] = cR; id.data[i + 1] = cG; id.data[i + 2] = cB; }
      else          { id.data[i] = 255; id.data[i + 1] = 255; id.data[i + 2] = 255; }
    }
    oc.putImageData(id, 0, 0);
    ctx.drawImage(off, x, y, sz, sz);
  }

  // ── Background + border ──
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  // ── Header ──
  const hH = 44;
  ctx.fillStyle = color; ctx.fillRect(1.5, 1.5, W - 3, hH);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(company || "T SIAMPACK CO., LTD.", W / 2, 1.5 + hH / 2);

  // ── Columns ──
  const bodyY = 1.5 + hH;
  const bodyH = H - bodyY - 1.5;
  const leftW = Math.round(W * 0.575);
  const rightX = leftW;
  const rightW = W - leftW - 1.5;

  ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(leftW, bodyY); ctx.lineTo(leftW, H - 1.5); ctx.stroke();

  // ── LEFT: info rows ──
  const px = 12, lblW = 72, fs = 17;
  const rH = Math.floor(bodyH / 7.2);
  const valX = px + lblW + 6;
  const maxValW = leftW - valX - 10;
  let ry = bodyY + rH * 0.55;

  function infoRow(lbl: string, val: string): void {
    ctx.fillStyle = "#111";
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(lbl, px + lblW, ry);
    ctx.font = `${fs}px Arial, sans-serif`;
    ctx.textAlign = "left";
    let v = val || "-";
    while (ctx.measureText(v).width > maxValW && v.length > 1) v = v.slice(0, -1);
    if (v !== (val || "-")) v += "…";
    ctx.fillText(v, valX, ry);
    ry += rH;
  }

  infoRow("NAME :", name || "-");
  infoRow("SIZE :", size || "-");
  infoRow("LOT. :", lot  || "-");
  infoRow("DATE :", date || "-");

  // QTY
  ctx.fillStyle = "#111"; ctx.font = `bold ${fs}px Arial, sans-serif`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText("QTY :", px + lblW, ry);
  ctx.font = `bold ${fs + 2}px Arial, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = "left";
  ctx.fillText(`${qty ?? 0}`, valX, ry);
  ctx.font = `${fs}px Arial, sans-serif`; ctx.fillStyle = "#333";
  ctx.fillText(`   ${pcs || "PCS."}`, valX + 34, ry);
  ry += rH;

  function drawSignatureSlot(label: string, value: string, mode: SignatureMode, img: HTMLImageElement | null | undefined, x: number, y: number, w: number): void {
    ctx.fillStyle = "#333";
    ctx.font = `bold ${fs - 2}px Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    const contentX = x + 66;
    const contentW = w - 72;
    const contentH = 52;
    if (mode === "image" && img) {
      const scale = Math.min(contentW / img.width, contentH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      ctx.drawImage(img, contentX, y - drawH / 2, drawW, drawH);
      return;
    }
    ctx.font = `${fs - 2}px Arial, sans-serif`;
    ctx.fillText(value || "…………………………", contentX, y);
  }

  // divider + QC
  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, ry - rH * 0.45); ctx.lineTo(leftW - 8, ry - rH * 0.45); ctx.stroke();
  const slotW = (leftW - px * 2) / 2;
  drawSignatureSlot("QC (1)", qc1, qc1Mode, qc1Img, px, ry, slotW);
  drawSignatureSlot("QC (2)", qc2, qc2Mode, qc2Img, px + slotW + 8, ry, slotW);
  ry += rH - 6;

  // divider + warning
  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, ry - rH * 0.45); ctx.lineTo(leftW - 8, ry - rH * 0.45); ctx.stroke();
  ctx.fillStyle = "#555"; ctx.font = `bold ${fs - 3}px Arial, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const warnTxt = warning || "เก็บไว้ในที่ร่ม ห้ามโดนแสงแดด อุณหภูมิไม่เกิน 38 องศา";
  let wt = warnTxt;
  while (ctx.measureText(wt).width > leftW - px * 2 && wt.length > 1) wt = wt.slice(0, -1);
  if (wt !== warnTxt) wt += "…";
  ctx.fillText(wt, leftW / 2, ry + (H - 1.5 - ry) / 2);

  // ── RIGHT: badge (top half) ──
  const rPad = 10;
  const badgeAreaH = Math.round(bodyH * 0.50);
  const qrAreaTopY = bodyY + badgeAreaH;

  ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rightX + 8, qrAreaTopY); ctx.lineTo(W - 8, qrAreaTopY); ctx.stroke();

  const badgeCX = rightX + rightW / 2;
  const badgeCY = bodyY + badgeAreaH / 2;
  const bR = Math.min(rightW / 2 - 12, badgeAreaH / 2 - 10);

  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(badgeCX, badgeCY, bR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color + "15";
  ctx.beginPath(); ctx.arc(badgeCX, badgeCY, bR, 0, Math.PI * 2); ctx.fill();

  const bfs = Math.round(bR * 0.30);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `bold ${bfs + 2}px Arial, sans-serif`;
  ctx.fillText("QC", badgeCX, badgeCY - bR * 0.50);
  ctx.font = `bold ${bfs}px Arial, sans-serif`;
  ctx.fillText("RoHS", badgeCX, badgeCY - bR * 0.17);
  ctx.fillStyle = "#e53e3e";
  ctx.font = `bold ${bfs + 4}px Arial, sans-serif`;
  ctx.fillText("PASS", badgeCX, badgeCY + bR * 0.17);
  ctx.fillStyle = "#444";
  ctx.font = `${bfs - 2}px Arial, sans-serif`;
  ctx.fillText("INSPECTOR", badgeCX, badgeCY + bR * 0.52);
  if (inspector) {
    ctx.fillStyle = "#222";
    ctx.font = `bold ${bfs - 2}px Arial, sans-serif`;
    ctx.fillText(inspector, badgeCX, badgeCY + bR * 0.74);
  }

  // ── RIGHT: QR code (bottom half) + small arrow to its right ──
  const qrAreaH  = H - 1.5 - qrAreaTopY;
  // Arrow column: fixed 32 px on the far right of the QR area
  const arColW   = 32;
  const qrAvailW = rightW - rPad * 2 - arColW;
  const qrAvailH = qrAreaH - rPad * 2;
  const qrSz     = Math.min(qrAvailW, qrAvailH);
  const qrX      = rightX + rPad;
  const qrY      = qrAreaTopY + rPad + (qrAvailH - qrSz) / 2;

  if (qrImg) {
    tintAndDraw(qrImg, qrSz, qrX, qrY);
  } else if (qrCode) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { tintAndDraw(img, qrSz, qrX, qrY); };
    img.src = qrCode;
  } else {
    ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(qrX, qrY, qrSz, qrSz);
    ctx.setLineDash([]);
    ctx.fillStyle = "#bbb"; ctx.font = `${fs - 2}px Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("QR CODE", qrX + qrSz / 2, qrY + qrSz / 2);
  }

  // ── Arrow ↑ — compact, beside QR on the right ──
  // height = 40 px total, centred vertically in QR area
  const arCX    = qrX + qrSz + arColW / 2;
  const arMidY  = qrAreaTopY + qrAreaH / 2;
  const arHalf  = 20;          // half-height → total 40 px
  const arTop   = arMidY - arHalf;
  const arBot   = arMidY + arHalf;
  const arHW    = 11;           // half-width of arrowhead
  const arSW    = 5;            // half-width of stem

  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(arCX,          arTop);              // tip
  ctx.lineTo(arCX + arHW,   arTop + arHW);       // right head
  ctx.lineTo(arCX + arSW,   arTop + arHW);       // right shoulder
  ctx.lineTo(arCX + arSW,   arBot);              // right stem bottom
  ctx.lineTo(arCX - arSW,   arBot);              // left stem bottom
  ctx.lineTo(arCX - arSW,   arTop + arHW);       // left shoulder
  ctx.lineTo(arCX - arHW,   arTop + arHW);       // left head
  ctx.closePath();
  ctx.fill();
}

// ─── QRLabel React component (live preview) ──────────────────────────────────
function QRLabel({
  company, name, size, lot, date, qty, pcs,
  inspector, qc1, qc1Mode = "text", qc1Image, qc2, qc2Mode = "text", qc2Image, warning, qrCode, color,
  canvasRef: externalRef,
}: {
  company: string; name: string; size: string; lot: string;
  date: string; qty: number | string; pcs: string;
  inspector: string; qc1: string; qc1Mode?: SignatureMode; qc1Image?: string | null; qc2: string; qc2Mode?: SignatureMode; qc2Image?: string | null;
  warning: string; qrCode: string; color: string;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalRef ?? internalRef;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetCanvas = canvas;
    async function render() {
      const [qc1Img, qc2Img] = await Promise.all([
        qc1Mode === "image" ? loadImage(qc1Image) : Promise.resolve(null),
        qc2Mode === "image" ? loadImage(qc2Image) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      drawLabelOnCanvas(targetCanvas, {
        company, name, size, lot, date, qty, pcs,
        inspector, qc1, qc1Mode, qc1Img, qc2, qc2Mode, qc2Img, warning, qrCode, color,
      });
    }
    render();
    return () => { cancelled = true; };
  }, [company, name, size, lot, date, qty, pcs, inspector, qc1, qc1Mode, qc1Image, qc2, qc2Mode, qc2Image, warning, qrCode, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "320px", height: "200px",
        display: "block",
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        imageRendering: "crisp-edges",
      }}
    />
  );
}

function TintedQRCode({ src, color, size = 88 }: { src: string; color: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelSize = Math.round(size * dpr);
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const hex = color.replace("#", "");
    const tint = {
      r: parseInt(hex.slice(0, 2), 16) || 0,
      g: parseInt(hex.slice(2, 4), 16) || 0,
      b: parseInt(hex.slice(4, 6), 16) || 0,
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      try {
        const imageData = ctx.getImageData(0, 0, pixelSize, pixelSize);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const alpha = imageData.data[i + 3];
          const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
          if (alpha > 0 && brightness < 180) {
            imageData.data[i] = tint.r;
            imageData.data[i + 1] = tint.g;
            imageData.data[i + 2] = tint.b;
          } else {
            imageData.data[i] = 255;
            imageData.data[i + 1] = 255;
            imageData.data[i + 2] = 255;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      } catch {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
      }
    };
    img.onerror = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#d1d5db";
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    };
    img.src = src;
  }, [src, color, size]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="QR"
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        display: "block",
        background: "#ffffff",
        imageRendering: "pixelated",
      }}
    />
  );
}

// ─── Global Data Cache ────────────────────────────────────────────────────────

type CacheState = {
  products: Product[];
  warehouses: Warehouse[];
  materials: Material[];
  orders: Order[];
  users: User[];
  loaded: boolean;
  loading: boolean;
};

type CacheListener = () => void;

const cache: CacheState = {
  products: [],
  warehouses: [],
  materials: [],
  orders: [],
  users: [],
  loaded: false,
  loading: false,
};

const cacheListeners = new Set<CacheListener>();

function notifyListeners() {
  cacheListeners.forEach((fn) => fn());
}

async function loadAllData() {
  if (cache.loaded || cache.loading) return;
  cache.loading = true;
  notifyListeners();
  try {
    const [pr, wr, mr, or_, ur] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/warehouses"),
      fetch("/api/materials"),
      fetch("/api/orders"),
      fetch("/api/users"),
    ]);
    const [pd, wd, md, od, ud] = await Promise.all([
      pr.json(), wr.json(), mr.json(), or_.json(), ur.json(),
    ]);
    cache.products = pd;
    cache.warehouses = wd;
    cache.materials = md;
    cache.orders = od;
    cache.users = ud;
    cache.loaded = true;
  } catch (e) {
    console.error("Cache load error:", e);
  } finally {
    cache.loading = false;
    notifyListeners();
  }
}

async function refreshCache() {
  cache.loading = true;
  notifyListeners();
  try {
    const [pr, wr, mr, or_, ur] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/warehouses"),
      fetch("/api/materials"),
      fetch("/api/orders"),
      fetch("/api/users"),
    ]);
    const [pd, wd, md, od, ud] = await Promise.all([
      pr.json(), wr.json(), mr.json(), or_.json(), ur.json(),
    ]);
    cache.products = pd;
    cache.warehouses = wd;
    cache.materials = md;
    cache.orders = od;
    cache.users = ud;
    cache.loaded = true;
  } catch (e) {
    console.error("Cache refresh error:", e);
  } finally {
    cache.loading = false;
    notifyListeners();
  }
}

function useCache() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    cacheListeners.add(listener);
    loadAllData();
    return () => { cacheListeners.delete(listener); };
  }, []);

  return {
    products: cache.products,
    warehouses: cache.warehouses,
    materials: cache.materials,
    orders: cache.orders,
    users: cache.users,
    loaded: cache.loaded,
    loading: cache.loading,
    refresh: refreshCache,
  };
}

// ─── Toast Notification ───────────────────────────────────────────────────────

type ToastItem = { id: number; message: string; type: "success" | "error" };

const toastListeners = new Set<(toasts: ToastItem[]) => void>();
let toastQueue: ToastItem[] = [];
let toastCounter = 0;

function showToast(message: string, type: "success" | "error" = "success") {
  const id = ++toastCounter;
  toastQueue = [...toastQueue, { id, message, type }];
  toastListeners.forEach((fn) => fn(toastQueue));
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    toastListeners.forEach((fn) => fn(toastQueue));
  }, 3500);
}

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (t: ToastItem[]) => setToasts([...t]);
    toastListeners.add(listener);
    return () => { toastListeners.delete(listener); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      top: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      pointerEvents: "none",
      alignItems: "center",
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 24px",
            borderRadius: 16,
            background: t.type === "success"
              ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
              : "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
            color: "white",
            fontWeight: 700,
            fontSize: 15,
            boxShadow: t.type === "success"
              ? "0 8px 32px rgba(22,163,74,0.45)"
              : "0 8px 32px rgba(220,38,38,0.45)",
            whiteSpace: "nowrap",
            animation: "toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
            minWidth: 240,
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 20 }}>{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-18px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── Saving Overlay ───────────────────────────────────────────────────────────

function SavingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 8000,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(3px)",
      WebkitBackdropFilter: "blur(3px)",
    }}>
      <div style={{
        background: "white",
        borderRadius: 20,
        padding: "32px 48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
      }}>
        <div style={{
          width: 48, height: 48,
          border: "4px solid #e2e8f0",
          borderTop: "4px solid #16a34a",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1a202c" }}>กำลังบันทึก...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Shared Modal Overlay ─────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "16px",
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "12px",
  maxWidth: "640px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "32px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: "400px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: 20 }}>ยืนยันการลบ</h3>
        <p style={{ color: "#555", marginBottom: 28 }}>{message}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={onConfirm}
            style={{
              padding: "10px 32px",
              backgroundColor: "#e53e3e",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ใช่ ลบเลย
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 32px",
              backgroundColor: "#e2e8f0",
              color: "#333",
              border: "none",
              borderRadius: "8px",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ไม่
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transaction Confirm Modal ────────────────────────────────────────────────

function TransactionConfirmModal({
  transactionType,
  product,
  quantity,
  sourceWarehouse,
  destinationWarehouse,
  customerName,
  onConfirm,
  onCancel,
}: {
  transactionType: TransactionType;
  product: Product;
  quantity: number;
  sourceWarehouse: string;
  destinationWarehouse?: string;
  customerName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isTransfer = transactionType === "TRANSFER";

  return (
    <div style={overlayStyle}>
      <div
        style={{
          ...modalStyle,
          maxWidth: "460px",
          textAlign: "center",
          padding: "40px 36px",
          borderRadius: "20px",
          background: "linear-gradient(160deg, #ffffff 0%, #f8fbff 100%)",
          border: "1px solid #e2eaf4",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            background: isTransfer
              ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            boxShadow: isTransfer
              ? "0 8px 24px rgba(102,126,234,0.4)"
              : "0 8px 24px rgba(245,87,108,0.4)",
          }}
        >
          {isTransfer ? "🔄" : "📦"}
        </div>
        <h3 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 700, color: "#1a202c", letterSpacing: "-0.3px" }}>
          {isTransfer ? "ยืนยันการโอนสินค้า" : "ยืนยันการส่งสินค้า"}
        </h3>
        <p style={{ color: "#718096", fontSize: 14, margin: "0 0 28px 0" }}>กรุณาตรวจสอบข้อมูลก่อนดำเนินการ</p>
        <div style={{ background: "#fff", border: "1px solid #e8edf5", borderRadius: "14px", padding: "16px 20px", marginBottom: 20, textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {product.image ? (
              <img src={product.image} alt={product.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 10, background: "linear-gradient(135deg, #e8edf5, #d1dce8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📦</div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1a202c" }}>{product.name}</div>
              <div style={{ color: "#718096", fontSize: 13, marginTop: 2 }}>SKU: {product.sku}</div>
            </div>
          </div>
        </div>
        <div style={{ background: "#f7fafc", borderRadius: "12px", padding: "14px 18px", marginBottom: 28, textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#718096", fontSize: 13 }}>จำนวน</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1a202c" }}>{quantity} ชิ้น</span>
          </div>
          <div style={{ height: 1, background: "#e2e8f0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#718096", fontSize: 13 }}>จาก</span>
            <span style={{ fontWeight: 600, color: "#2d3748", fontSize: 14 }}>{sourceWarehouse}</span>
          </div>
          <div style={{ height: 1, background: "#e2e8f0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#718096", fontSize: 13 }}>{isTransfer ? "ถึงคลัง" : "ถึงลูกค้า"}</span>
            <span style={{ fontWeight: 600, color: "#2d3748", fontSize: 14 }}>{isTransfer ? destinationWarehouse : customerName}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "14px",
              background: isTransfer
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              color: "white", border: "none", borderRadius: "12px",
              fontSize: 15, cursor: "pointer", fontWeight: 700,
              boxShadow: isTransfer ? "0 4px 15px rgba(102,126,234,0.4)" : "0 4px 15px rgba(245,87,108,0.4)",
              letterSpacing: "0.2px",
            }}
          >
            ✓ ใช่ ดำเนินการ
          </button>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "14px", background: "#edf2f7", color: "#4a5568", border: "none", borderRadius: "12px", fontSize: 15, cursor: "pointer", fontWeight: 600 }}
          >
            ✕ ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Scan Action Sheet ────────────────────────────────────────────────────────

function ScanActionSheet({
  product,
  warehouses,
  onTransfer,
  onShip,
  onClose,
}: {
  product: Product;
  warehouses: Warehouse[];
  onTransfer: (destWarehouseId: string, qty: number) => void;
  onShip: (customerName: string, qty: number) => void;
  onClose: () => void;
}) {
  const [action, setAction] = useState<"choose" | "transfer" | "ship">("choose");
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const warehouseName = warehouses.find((w) => w.id === product.warehouseId)?.name || "-";
  const availableDest = warehouses.filter((w) => w.id !== product.warehouseId);

  const stockColor = product.stock === 0 ? "#ef4444" : product.stock < 10 ? "#f59e0b" : "#10b981";
  const stockLabel = product.stock === 0 ? "หมดสต็อก" : product.stock < 10 ? "สต็อกต่ำ" : "พร้อมจัดส่ง";

  const sheetOverlay: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex", justifyContent: "center", alignItems: "flex-end",
    zIndex: 3000, backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
  };

  const sheetModal: React.CSSProperties = {
    backgroundColor: "white", borderRadius: "24px 24px 0 0",
    width: "100%", maxHeight: "92vh", overflowY: "auto",
    padding: "20px 20px 40px", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
  };

  function handleTransferSubmit() {
    if (!destWarehouseId) { setError("กรุณาเลือกคลังปลายทาง"); return; }
    if (quantity < 1) { setError("จำนวนต้องมากกว่า 0"); return; }
    onTransfer(destWarehouseId, quantity);
  }

  function handleShipSubmit() {
    if (!customerName.trim()) { setError("กรุณาระบุชื่อลูกค้า"); return; }
    if (quantity < 1) { setError("จำนวนต้องมากกว่า 0"); return; }
    if (product.stock < quantity) { setError("สต็อกไม่เพียงพอ"); return; }
    onShip(customerName, quantity);
  }

  return (
    <div style={sheetOverlay}>
      <div style={sheetModal}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#d1d5db" }} />
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 16px", borderRadius: 16, background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", border: "1px solid #d1fae5", marginBottom: 20 }}>
          {product.image ? (
            <img src={product.image} alt={product.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 12, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📦</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#064e3b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{product.name}</div>
            <div style={{ color: "#059669", fontSize: 13, marginTop: 2 }}>SKU: {product.sku}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#374151" }}>📍 {warehouseName}</span>
              <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: stockColor, background: `${stockColor}18`, border: `1px solid ${stockColor}40` }}>{product.stock} ชิ้น · {stockLabel}</span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>⚠️ {error}</div>
        )}

        {action === "choose" && (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 14 }}>เลือกการดำเนินการ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { setAction("transfer"); setError(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)", border: "1px solid #c4b5fd", borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 28 }}>🔄</span>
                <div>
                  <div style={{ fontWeight: 700, color: "#4c1d95", fontSize: 15 }}>โอนข้ามคลัง</div>
                  <div style={{ color: "#7c3aed", fontSize: 13, marginTop: 2 }}>ย้ายสินค้าไปยังคลังอื่น</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#7c3aed", fontSize: 20 }}>›</span>
              </button>
              <button onClick={() => { setAction("ship"); setError(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", background: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)", border: "1px solid #f9a8d4", borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 28 }}>🚚</span>
                <div>
                  <div style={{ fontWeight: 700, color: "#831843", fontSize: 15 }}>ส่งให้ลูกค้า</div>
                  <div style={{ color: "#db2777", fontSize: 13, marginTop: 2 }}>ตัดสต็อกส่งออกให้ลูกค้า</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#db2777", fontSize: 20 }}>›</span>
              </button>
            </div>
            <button onClick={onClose} style={{ width: "100%", marginTop: 16, padding: "14px", background: "#f3f4f6", border: "none", borderRadius: 12, fontSize: 15, color: "#6b7280", cursor: "pointer", fontWeight: 600 }}>ปิด</button>
          </>
        )}

        {action === "transfer" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <button onClick={() => { setAction("choose"); setError(null); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", padding: 0 }}>←</button>
              <div style={{ fontWeight: 700, fontSize: 16 }}>โอนข้ามคลัง</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>คลังปลายทาง</label>
                <select value={destWarehouseId} onChange={(e) => { setDestWarehouseId(e.target.value); setError(null); }} style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #d1d5db", fontSize: 15, background: "white" }}>
                  <option value="">เลือกคลังปลายทาง</option>
                  {availableDest.map((w) => <option key={w.id} value={w.id}>{w.name}{w.location ? ` · ${w.location}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>จำนวน (มีในสต็อก {product.stock} ชิ้น)</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 48, height: 48, background: "#f9fafb", border: "none", fontSize: 20, cursor: "pointer", color: "#374151", flexShrink: 0 }}>−</button>
                  <input type="number" min={1} max={product.stock} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} style={{ flex: 1, border: "none", textAlign: "center", fontSize: 18, fontWeight: 700, outline: "none", padding: "10px 0", background: "white" }} />
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} style={{ width: 48, height: 48, background: "#f9fafb", border: "none", fontSize: 20, cursor: "pointer", color: "#374151", flexShrink: 0 }}>+</button>
                </div>
              </div>
              <button onClick={handleTransferSubmit} style={{ width: "100%", padding: "15px", marginTop: 4, background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(22,163,74,0.35)" }}>ยืนยันการโอน →</button>
            </div>
          </>
        )}

        {action === "ship" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <button onClick={() => { setAction("choose"); setError(null); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", padding: 0 }}>←</button>
              <div style={{ fontWeight: 700, fontSize: 16 }}>ส่งให้ลูกค้า</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>ชื่อลูกค้า / ปลายทาง</label>
                <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setError(null); }} placeholder="เช่น บริษัท ABC จำกัด" style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid #d1d5db", fontSize: 15, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: 14, color: "#374151", marginBottom: 6 }}>จำนวน (มีในสต็อก {product.stock} ชิ้น)</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 48, height: 48, background: "#f9fafb", border: "none", fontSize: 20, cursor: "pointer", color: "#374151", flexShrink: 0 }}>−</button>
                  <input type="number" min={1} max={product.stock} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} style={{ flex: 1, border: "none", textAlign: "center", fontSize: 18, fontWeight: 700, outline: "none", padding: "10px 0", background: "white" }} />
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} style={{ width: 48, height: 48, background: "#f9fafb", border: "none", fontSize: 20, cursor: "pointer", color: "#374151", flexShrink: 0 }}>+</button>
                </div>
              </div>
              <button onClick={handleShipSubmit} style={{ width: "100%", padding: "15px", marginTop: 4, background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(22,163,74,0.35)" }}>ยืนยันการส่ง →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Full-Screen Scanner ───────────────────────────────────────────────

function MobileScannerView({
  products,
  warehouses,
  onClose,
  onSuccess,
}: {
  products: Product[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: TransactionType;
    destWarehouseId?: string;
    customerName?: string;
    quantity: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const productsRef = useRef<Product[]>([]);
  useEffect(() => { productsRef.current = products; }, [products]);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  function stopCamera() {
    if (scanLoopRef.current !== null) { window.cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setIsCameraActive(false);
  }

  function findProduct(code: string) {
    const trimmed = code.trim().toLowerCase();
    return productsRef.current.find((p) =>
      p.sku.toLowerCase() === trimmed ||
      p.name.toLowerCase().includes(trimmed) ||
      p.qrCode?.toLowerCase() === trimmed ||
      p.qrCode?.toLowerCase().includes(trimmed)
    );
  }

  function onCodeFound(raw: string) {
    stopCamera();
    const product = findProduct(raw);
    if (product) { setScannedProduct(product); setShowActionSheet(true); }
    else { setCameraError(`ไม่พบสินค้าจากรหัส: "${raw}"`); }
  }

  function scanWithCanvas() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { scanLoopRef.current = requestAnimationFrame(scanWithCanvas); return; }
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) { onCodeFound(code.data); return; }
    scanLoopRef.current = requestAnimationFrame(scanWithCanvas);
  }

  function scanFrame(detector: any) {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      scanLoopRef.current = requestAnimationFrame(() => scanFrame(detector)); return;
    }
    detector.detect(videoRef.current).then((codes: any[]) => {
      if (codes?.length && codes[0].rawValue) { onCodeFound(codes[0].rawValue); return; }
      scanLoopRef.current = requestAnimationFrame(() => scanFrame(detector));
    }).catch(() => { scanLoopRef.current = requestAnimationFrame(() => scanFrame(detector)); });
  }

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับกล้อง"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setIsCameraActive(true);
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanFrame(detector);
      } else { scanWithCanvas(); }
    } catch { setCameraError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตให้เว็บนี้ใช้กล้อง"); }
  }

  function handleTransfer(destWarehouseId: string, quantity: number) {
    setShowActionSheet(false);
    setPendingAction({ type: "TRANSFER", destWarehouseId, quantity });
    setShowConfirm(true);
  }

  function handleShip(customerName: string, quantity: number) {
    setShowActionSheet(false);
    setPendingAction({ type: "SHIP", customerName, quantity });
    setShowConfirm(true);
  }

  async function handleConfirm() {
    if (!scannedProduct || !pendingAction) return;
    setShowConfirm(false);
    try {
      if (pendingAction.type === "TRANSFER") {
        const res = await fetch(`/api/products/${scannedProduct.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scannedProduct, warehouseId: pendingAction.destWarehouseId }),
        });
        if (!res.ok) throw new Error();
        await refreshCache();
        onSuccess(`โอนสินค้า "${scannedProduct.name}" เรียบร้อยแล้ว ✓`);
      } else {
        const res = await fetch(`/api/products/${scannedProduct.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...scannedProduct, stock: scannedProduct.stock - pendingAction.quantity }),
        });
        if (!res.ok) throw new Error();
        await refreshCache();
        onSuccess(`ส่งสินค้า "${scannedProduct.name}" ให้ ${pendingAction.customerName} เรียบร้อยแล้ว ✓`);
      }
      onClose();
    } catch { setCameraError("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
  }

  const srcWarehouseName = warehouses.find((w) => w.id === scannedProduct?.warehouseId)?.name || "คลัง";
  const destWarehouseName = warehouses.find((w) => w.id === pendingAction?.destWarehouseId)?.name || "";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000" }}>
      <video ref={videoRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 20px 16px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}>
          <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.18)", border: "none", color: "white", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 17 }}>สแกน QR สินค้า</span>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 240, height: 240 }}>
            {([
              { top: 0, left: 0, borderTop: "3px solid white", borderLeft: "3px solid white" },
              { top: 0, right: 0, borderTop: "3px solid white", borderRight: "3px solid white" },
              { bottom: 0, left: 0, borderBottom: "3px solid white", borderLeft: "3px solid white" },
              { bottom: 0, right: 0, borderBottom: "3px solid white", borderRight: "3px solid white" },
            ] as React.CSSProperties[]).map((style, i) => (
              <div key={i} style={{ position: "absolute", width: 32, height: 32, borderRadius: 4, ...style }} />
            ))}
            {isCameraActive && (
              <div style={{ position: "absolute", left: 8, right: 8, height: 2, background: "linear-gradient(90deg, transparent, #22c55e, transparent)", animation: "scanLine 2s ease-in-out infinite", borderRadius: 1 }} />
            )}
          </div>
        </div>
        <div style={{ padding: "20px 20px 48px", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)", textAlign: "center" }}>
          {cameraError ? (
            <>
              <div style={{ color: "#fca5a5", fontSize: 14, marginBottom: 16 }}>{cameraError}</div>
              <button onClick={() => { setCameraError(null); startCamera(); }} style={{ padding: "12px 28px", background: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>ลองอีกครั้ง</button>
            </>
          ) : isCameraActive ? (
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, margin: 0 }}>เล็งกล้องไปที่ QR Code บนสินค้า</p>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0 }}>กำลังเปิดกล้อง...</p>
          )}
        </div>
      </div>
      <style>{`@keyframes scanLine { 0% { top: 8px; } 50% { top: calc(100% - 10px); } 100% { top: 8px; } }`}</style>
      {showActionSheet && scannedProduct && (
        <ScanActionSheet product={scannedProduct} warehouses={warehouses} onTransfer={handleTransfer} onShip={handleShip} onClose={() => { setShowActionSheet(false); startCamera(); }} />
      )}
      {showConfirm && scannedProduct && pendingAction && (
        <TransactionConfirmModal
          transactionType={pendingAction.type}
          product={scannedProduct}
          quantity={pendingAction.quantity}
          sourceWarehouse={srcWarehouseName}
          destinationWarehouse={destWarehouseName}
          customerName={pendingAction.customerName}
          onConfirm={handleConfirm}
          onCancel={() => { setShowConfirm(false); setShowActionSheet(true); }}
        />
      )}
    </div>
  );
}

// ─── ProductSearchTab ─────────────────────────────────────────────────────────

function ProductSearchTab({ products, warehouses }: { products: Product[]; warehouses: Warehouse[] }) {
  const isMobile = useIsMobile();
  const [searchMode, setSearchMode] = useState<"scan" | "manual">("scan");
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const productsRef = useRef<Product[]>([]);

  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCameraSupported(!!navigator.mediaDevices?.getUserMedia);
      setScannerSupported("BarcodeDetector" in window);
    }
  }, []);
  useEffect(() => { if (searchMode !== "scan") stopCamera(); return () => { stopCamera(); }; }, [searchMode]);

  function stopCamera() {
    if (scanLoopRef.current !== null) { window.cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null); setIsCameraActive(false);
  }

  function findProduct(code: string) {
    const trimmed = code.trim().toLowerCase();
    return productsRef.current.find((p) =>
      p.sku.toLowerCase() === trimmed || p.name.toLowerCase().includes(trimmed) ||
      p.qrCode?.toLowerCase() === trimmed || p.qrCode?.toLowerCase().includes(trimmed)
    );
  }

  function handleFoundCode(raw: string) {
    setScanResult(raw);
    const result = findProduct(raw);
    if (result) { setFoundProduct(result); setSearchError(null); setSearchMessage(`พบสินค้า ${result.name} เรียบร้อยแล้ว`); }
    else { setFoundProduct(null); setSearchError("ไม่พบสินค้าจากรหัสนี้ กรุณาลองใหม่"); setSearchMessage(null); }
  }

  function handleManualSearch() {
    const trimmed = manualCode.trim();
    if (!trimmed) { setSearchError("กรุณากรอกรหัสสินค้า หรือ SKU ก่อน"); return; }
    handleFoundCode(trimmed);
  }

  function scanWithCanvas() {
    if (!videoRef.current) { scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas); return; }
    const video = videoRef.current;
    if (video.readyState < 2) { scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas); return; }
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCameraError("ไม่สามารถประมวลผลภาพจากกล้องได้"); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) { stopCamera(); handleFoundCode(code.data); return; }
    scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas);
  }

  function scanFrame(detector: any) {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector)); return;
    }
    detector.detect(videoRef.current).then((codes: any[]) => {
      if (codes?.length > 0) {
        const raw = codes[0].rawValue || codes[0].displayValue || "";
        if (raw) { stopCamera(); handleFoundCode(raw); return; }
      }
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector));
    }).catch((e: any) => { console.error(e); scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector)); });
  }

  async function startCamera() {
    setSearchError(null); setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("ไม่สามารถเข้าถึงกล้องได้บนอุปกรณ์หรือเบราว์เซอร์นี้"); return; }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(mediaStream);
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; await videoRef.current.play(); }
      setIsCameraActive(true);
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanFrame(detector);
      } else { scanWithCanvas(); }
    } catch { setCameraError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตให้เว็บนี้ใช้กล้อง"); }
  }

  function resetSearch() {
    setSearchMode("scan"); setScanResult(""); setManualCode(""); setFoundProduct(null);
    setSearchError(null); setSearchMessage(null); setCameraError(null); stopCamera();
  }

  const warehouseName = foundProduct?.warehouseId ? warehouses.find((w) => w.id === foundProduct.warehouseId)?.name : null;

  return (
    <div>
      {(searchMessage || searchError) && (
        <div className={`alert ${searchError ? "" : "success"}`}>{searchError || searchMessage}</div>
      )}
      <div className={isMobile ? "mobile-stack" : "form-grid"}>
        <div className="card form-card">
          <h3 style={{ marginTop: 0 }}>ค้นหาสินค้า</h3>
          <div className="field-group">
            <label>โหมด</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className={searchMode === "scan" ? "btn" : "btn btn-secondary"} onClick={() => setSearchMode("scan")}>สแกน QR</button>
              <button type="button" className={searchMode === "manual" ? "btn" : "btn btn-secondary"} onClick={() => setSearchMode("manual")}>พิมพ์รหัส</button>
            </div>
          </div>
          {searchMode === "scan" && (
            <div className="field-group">
              <label>สแกน QR ด้วยกล้อง</label>
              {cameraError && <div className="alert">{cameraError}</div>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" className={isCameraActive ? "btn btn-secondary" : "btn"} onClick={startCamera} disabled={isCameraActive}>เริ่มสแกน</button>
                {isCameraActive && <button type="button" className="btn btn-secondary" onClick={stopCamera}>หยุดสแกน</button>}
              </div>
              <small className="sub-text">เล็งกล้องไปที่ QR code เพื่อสแกน</small>
              {cameraSupported
                ? scannerSupported
                  ? <small className="sub-text">หากเบราว์เซอร์รองรับ ระบบจะสแกน QR อัตโนมัติ</small>
                  : <small className="sub-text">ใช้โหมดสแกนสำรองด้วยภาพจากกล้อง</small>
                : <small className="sub-text">อุปกรณ์นี้ไม่รองรับกล้องเพื่อสแกน QR</small>}
              <div style={{ marginTop: 16, borderRadius: 18, overflow: "hidden", background: "#000" }}>
                <video ref={videoRef} style={{ width: "100%", minHeight: 220, objectFit: "cover" }} muted playsInline />
              </div>
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          )}
          {searchMode === "manual" && (
            <div className="field-group">
              <label>ป้อนชื่อสินค้า / SKU / รหัส</label>
              <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleManualSearch()} placeholder="เช่น ERP-PC-001 หรือ ชื่อสินค้า" />
              <div className="form-actions" style={{ padding: 0, marginTop: 4 }}>
                <button type="button" className="btn" onClick={handleManualSearch}>ค้นหา</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setManualCode(""); setFoundProduct(null); setSearchError(null); setSearchMessage(null); }}>ล้าง</button>
              </div>
            </div>
          )}
          <div className="field-group">
            <label>รหัสที่อ่านได้</label>
            <input value={scanResult || manualCode} disabled />
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={resetSearch}>รีเซ็ต</button>
          </div>
        </div>

        <div className="card form-card">
          <h3 style={{ marginTop: 0 }}>ข้อมูลสินค้า</h3>
          {foundProduct ? (
            <div>
              {foundProduct.image && <img src={foundProduct.image} alt={foundProduct.name} style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, marginBottom: 16 }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 17 }}>{foundProduct.name}</strong>
                  <p style={{ margin: "4px 0 0", color: "#5f6f63", fontSize: 13 }}>{foundProduct.sku}</p>
                </div>
                {(() => {
                  const s = foundProduct.stock === 0 ? { label: "หมดสต็อก", color: "#e53e3e", bg: "#fff5f5" } : foundProduct.stock < 10 ? { label: "สต็อกต่ำ", color: "#dd6b20", bg: "#fffaf0" } : { label: "พร้อมจัดส่ง", color: "#38a169", bg: "#f0fff4" };
                  return <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}30` }}>{s.label}</span>;
                })()}
              </div>
              <div style={{ padding: 16, borderRadius: 14, background: "#f8fff7", border: "1px solid #d8efda", marginBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "สต็อก", value: `${foundProduct.stock} ชิ้น` },
                    { label: "ราคา", value: foundProduct.price?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-" },
                    { label: "ประเภท", value: foundProduct.type === "COMPOSITE" ? "สินค้าประกอบ" : "สินค้าเดี่ยว" },
                    { label: "คลัง", value: warehouseName || "-" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: "#5f6f63" }}>{label}</span>
                      <span style={{ fontWeight: 600, color: "#2d4a30" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {foundProduct.description && <div className="field-group" style={{ marginBottom: 10 }}><label>คำอธิบาย</label><p style={{ margin: 0, fontSize: 13, color: "#4a5568", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{foundProduct.description}</p></div>}
              {foundProduct.qrCode && <div className="field-group"><label>QR Code</label><img src={foundProduct.qrCode} alt="QR" style={{ maxWidth: 80, borderRadius: 4 }} /></div>}
            </div>
          ) : (
            <div style={{ padding: 18, borderRadius: 22, background: "#fff7f5", border: "1px solid #f2d8d4", color: "#8a4f45" }}>กรุณาสแกน QR หรือป้อนรหัสสินค้าเพื่อดูข้อมูล</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── InventoryView ────────────────────────────────────────────────────────────

export function InventoryView() {
  const isMobile = useIsMobile();
  const { products: cachedProducts, warehouses: cachedWarehouses, materials: cachedMaterials, loading: cacheLoading, refresh } = useCache();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"products" | "materials" | "warehouses">("products");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setProducts(cachedProducts); }, [cachedProducts]);
  useEffect(() => { setWarehouses(cachedWarehouses); }, [cachedWarehouses]);
  useEffect(() => { setMaterials(cachedMaterials); }, [cachedMaterials]);

  const defaultProductForm: ProductForm = {
    name: "", sku: "", type: "SINGLE", stock: 0, price: 0,
    warehouseId: "", qrCode: "", qrColor: "#000000",
    image: null, description: "", details: "",
    labelCompany: "T SIAMPACK CO., LTD.",
    labelSize: "",
    labelLot: "",
    labelDate: new Date().toLocaleDateString("th-TH"),
    labelQty: 0,
    labelPcs: "PCS.",
    labelInspector: "",
    labelQc1: "",
    labelQc1Mode: "text",
    labelQc1Image: null,
    labelQc2: "",
    labelQc2Mode: "text",
    labelQc2Image: null,
    labelWarning: "เก็บไว้ในที่ร่ม ห้ามโดนแสงแดด อุณหภูมิไม่เกิน 38 องศา",
    labelLots: [{ id: "lot-1", lot: "", qty: 0, date: new Date().toLocaleDateString("th-TH") }],
    printCount: 1,
  };

  const [productForm, setProductForm] = useState<ProductForm>(defaultProductForm);
  const [selectedProductMaterials, setSelectedProductMaterials] = useState<Array<{ materialId: string; quantity: number; unitPrice: number }>>([]);
  const [materialForm, setMaterialForm] = useState<MaterialForm>({ 
    name: "", 
    unit: "", 
    unitPrice: 0, 
    description: "",
    supplier: "",
    invoiceNo: "",
    productCode: "",
    weight: 0,
    lotNumber: "",
    receivingDate: new Date().toISOString().split('T')[0]
  });
  const [warehouseForm, setWarehouseForm] = useState<WarehouseForm>({ name: "", location: "", image: null });

  const [showProductEditModal, setShowProductEditModal] = useState(false);
  const [showProductDetailModal, setShowProductDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailPrintCount, setDetailPrintCount] = useState(1);
  const [showMaterialEditModal, setShowMaterialEditModal] = useState(false);
  const [showMaterialDetailModal, setShowMaterialDetailModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [showWarehouseEditModal, setShowWarehouseEditModal] = useState(false);
  const [showWarehouseDetailModal, setShowWarehouseDetailModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; message: string; onConfirm: () => void }>({ show: false, message: "", onConfirm: () => {} });

  // Tab inside product modal: "info" | "label"
  const [productModalTab, setProductModalTab] = useState<"info" | "label">("info");

  // QR Label canvas ref for print
  const qrPrintRef = useRef<HTMLCanvasElement>(null);

  const filteredProducts = useMemo(() => products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.qrCode?.toLowerCase().includes(search.toLowerCase())
  ), [products, search]);

  function confirmDelete(message: string, action: () => void) {
    setDeleteConfirm({ show: true, message, onConfirm: action });
  }

  function openProductEdit(product: Product) {
    const fallbackDate = new Date().toLocaleDateString("th-TH");
    const savedLots = Array.isArray(product.labelLots) && product.labelLots.length > 0
      ? product.labelLots
      : [{ id: "lot-1", lot: product.labelLot || "", qty: product.labelQty ?? product.stock, date: product.labelDate || fallbackDate }];

    setSelectedProduct(product);
    setProductForm({
      id: product.id,
      name: product.name,
      sku: product.sku,
      type: product.type,
      stock: product.stock,
      price: product.price || 0,
      warehouseId: product.warehouseId || "",
      qrCode: product.qrCode || "",
      qrColor: product.qrColor || "#000000",
      image: product.image || null,
      description: product.description || "",
      details: product.details || "",
      labelCompany: product.labelCompany || "T SIAMPACK CO., LTD.",
      labelSize: product.labelSize || "",
      labelLot: product.labelLot || savedLots[0]?.lot || "",
      labelDate: product.labelDate || savedLots[0]?.date || fallbackDate,
      labelQty: product.labelQty ?? savedLots[0]?.qty ?? product.stock,
      labelPcs: product.labelPcs || "PCS.",
      labelInspector: product.labelInspector || "",
      labelQc1: product.labelQc1 || "",
      labelQc1Mode: product.labelQc1Mode || "text",
      labelQc1Image: product.labelQc1Image || null,
      labelQc2: product.labelQc2 || "",
      labelQc2Mode: product.labelQc2Mode || "text",
      labelQc2Image: product.labelQc2Image || null,
      labelWarning: product.labelWarning || "เก็บไว้ในที่ร่ม ห้ามโดนแสงแดด อุณหภูมิไม่เกิน 38 องศา",
      labelLots: savedLots,
      printCount: product.printCount || 1,
    });
    setSelectedProductMaterials(product.materials?.map((m) => ({ materialId: m.material.id, quantity: m.quantity, unitPrice: m.unitPrice })) ?? []);
    setProductModalTab("info");
    setShowProductEditModal(true);
  }

  function openProductAdd() {
    setSelectedProduct(null);
    setProductForm(defaultProductForm);
    setSelectedProductMaterials([]);
    setProductModalTab("info");
    setShowProductEditModal(true);
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEdit = !!productForm.id;
    setSaving(true);
    setShowProductEditModal(false);
    try {
      const payload = {
        name: productForm.name,
        sku: productForm.sku,
        type: productForm.type,
        price: productForm.price,
        stock: productForm.stock,
        warehouseId: productForm.warehouseId || null,
        qrCode: productForm.qrCode,
        qrColor: productForm.qrColor,
        image: productForm.image,
        description: productForm.description,
        details: productForm.details,
        labelCompany: productForm.labelCompany,
        labelSize: productForm.labelSize,
        labelLot: productForm.labelLots[0]?.lot || productForm.labelLot,
        labelDate: productForm.labelLots[0]?.date || productForm.labelDate,
        labelQty: productForm.labelLots[0]?.qty ?? productForm.labelQty,
        labelPcs: productForm.labelPcs,
        labelInspector: productForm.labelInspector,
        labelQc1: productForm.labelQc1,
        labelQc1Mode: productForm.labelQc1Mode,
        labelQc1Image: productForm.labelQc1Mode === "image" ? productForm.labelQc1Image : null,
        labelQc2: productForm.labelQc2,
        labelQc2Mode: productForm.labelQc2Mode,
        labelQc2Image: productForm.labelQc2Mode === "image" ? productForm.labelQc2Image : null,
        labelWarning: productForm.labelWarning,
        labelLots: productForm.labelLots,
        printCount: productForm.printCount,
        materials: productForm.type === "COMPOSITE" ? selectedProductMaterials : [],
      };
      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/api/products/${productForm.id}` : "/api/products";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        await refresh();
        showToast(isEdit ? "✓ แก้ไขสินค้าสำเร็จแล้ว" : "✓ เพิ่มสินค้าสำเร็จแล้ว");
      } else {
        showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleProductDelete(id: string, name: string) {
    confirmDelete(`คุณแน่ใจที่จะลบสินค้า "${name}" ใช่ไหม?`, async () => {
      setDeleteConfirm((d) => ({ ...d, show: false }));
      setSaving(true);
      try {
        const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
        if (res.ok) {
          await refresh();
          showToast("✓ ลบสินค้าเรียบร้อยแล้ว");
        }
      } finally { setSaving(false); }
    });
  }

  function handleProductImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setProductForm({ ...productForm, image: ev.target?.result as string }); reader.readAsDataURL(file); }
  }

  function addMaterialToProduct(materialId: string) {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;
    if (selectedProductMaterials.find((m) => m.materialId === materialId)) { showToast("วัตสดุนี้มีในรายการแล้ว", "error"); return; }
    setSelectedProductMaterials([...selectedProductMaterials, { materialId, quantity: 1, unitPrice: material.unitPrice }]);
  }

  function removeMaterialFromProduct(materialId: string) { setSelectedProductMaterials((c) => c.filter((m) => m.materialId !== materialId)); }
  function updateMaterialQuantity(materialId: string, quantity: number) { setSelectedProductMaterials((c) => c.map((m) => m.materialId === materialId ? { ...m, quantity: Math.max(0.1, quantity) } : m)); }

  function openMaterialEdit(material: Material) {
    setSelectedMaterial(material);
    setMaterialForm({ 
      id: material.id, 
      name: material.name, 
      unit: material.unit || "", 
      unitPrice: material.unitPrice, 
      description: material.description || "",
      supplier: material.supplier || "",
      invoiceNo: material.invoiceNo || "",
      productCode: material.productCode || "",
      weight: material.weight || 0,
      lotNumber: material.lotNumber || "",
      receivingDate: material.receivingDate ? new Date(material.receivingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowMaterialEditModal(true);
  }

  function openMaterialAdd() {
    setSelectedMaterial(null);
    setMaterialForm({ 
      name: "", 
      unit: "", 
      unitPrice: 0, 
      description: "",
      supplier: "",
      invoiceNo: "",
      productCode: "",
      weight: 0,
      lotNumber: "",
      receivingDate: new Date().toISOString().split('T')[0]
    });
    setShowMaterialEditModal(true);
  }

  async function handleMaterialSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEdit = !!materialForm.id;
    setSaving(true);
    setShowMaterialEditModal(false);
    try {
      const payload = { 
        name: materialForm.name, 
        unit: materialForm.unit, 
        unitPrice: materialForm.unitPrice, 
        description: materialForm.description,
        supplier: materialForm.supplier || "",
        invoiceNo: materialForm.invoiceNo || "",
        productCode: materialForm.productCode || "",
        weight: materialForm.weight || 0,
        lotNumber: materialForm.lotNumber || "",
        receivingDate: materialForm.receivingDate ? new Date(materialForm.receivingDate).toISOString() : null
      };
      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/api/materials/${materialForm.id}` : "/api/materials";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        await refresh();
        showToast(isEdit ? "✓ แก้ไขวัสดุสำเร็จแล้ว" : "✓ เพิ่มวัสดุสำเร็จแล้ว");
      } else { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error"); }
    } catch { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error"); }
    finally { setSaving(false); }
  }

  function handleMaterialDelete(id: string, name: string) {
    confirmDelete(`คุณแน่ใจที่จะลบวัตสดุ "${name}" ใช่ไหม?`, async () => {
      setDeleteConfirm((d) => ({ ...d, show: false }));
      setSaving(true);
      try {
        const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
        if (res.ok) { await refresh(); showToast("✓ ลบวัตสดุเรียบร้อยแล้ว"); }
      } finally { setSaving(false); }
    });
  }

  function openWarehouseEdit(warehouse: Warehouse) {
    setSelectedWarehouse(warehouse);
    setWarehouseForm({ id: warehouse.id, name: warehouse.name, location: warehouse.location || "", image: warehouse.image || null });
    setShowWarehouseEditModal(true);
  }

  function openWarehouseAdd() {
    setSelectedWarehouse(null);
    setWarehouseForm({ name: "", location: "", image: null });
    setShowWarehouseEditModal(true);
  }

  async function handleWarehouseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isEdit = !!warehouseForm.id;
    setSaving(true);
    setShowWarehouseEditModal(false);
    try {
      const payload = { name: warehouseForm.name, location: warehouseForm.location, image: warehouseForm.image };
      const method = isEdit ? "PUT" : "POST";
      const url = isEdit ? `/api/warehouses/${warehouseForm.id}` : "/api/warehouses";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        await refresh();
        showToast(isEdit ? "✓ แก้ไขคลังสำเร็จแล้ว" : "✓ เพิ่มคลังสำเร็จแล้ว");
      } else { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error"); }
    } catch { showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error"); }
    finally { setSaving(false); }
  }

  function handleWarehouseDelete(id: string, name: string) {
    confirmDelete(`คุณแน่ใจที่จะลบคลัง "${name}" ใช่ไหม?`, async () => {
      setDeleteConfirm((d) => ({ ...d, show: false }));
      setSaving(true);
      try {
        const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
        if (res.ok) { await refresh(); showToast("✓ ลบคลังเรียบร้อยแล้ว"); }
      } finally { setSaving(false); }
    });
  }

  function handleWarehouseImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setWarehouseForm({ ...warehouseForm, image: ev.target?.result as string }); reader.readAsDataURL(file); }
  }

  function handleQcSignatureImageChange(field: "labelQc1Image" | "labelQc2Image", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProductForm((f) => ({ ...f, [field]: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  // ── Print QR Labels — multi-lot × printCount each, 2-up grid on A4 ──
  function handlePrintQR() {
    // Build list of label configs: for each lot × printCount copies
    const lots = productForm.labelLots.filter(l => l.lot || l.qty > 0);
    if (lots.length === 0) {
      // fallback: single label from main fields
      lots.push({ id: "fallback", lot: productForm.labelLot, qty: productForm.labelQty, date: productForm.labelDate });
    }

    // Each lot → printCount copies
    const entries: Array<{ lot: string; qty: number; date: string }> = [];
    lots.forEach(l => {
      for (let i = 0; i < Math.max(1, productForm.printCount); i++) {
        entries.push({ lot: l.lot, qty: l.qty, date: l.date });
      }
    });

    // Load QR image once, then draw all labels
    const doRender = (qrImg: HTMLImageElement | null, qc1Img: HTMLImageElement | null, qc2Img: HTMLImageElement | null) => {
      // Each label canvas: 960×600
      const LW = 960, LH = 600;
      const dataUrls = entries.map(e => {
        const c = document.createElement("canvas");
        drawLabelOnCanvas(c, {
          company: productForm.labelCompany,
          name: productForm.name,
          size: productForm.labelSize,
          lot: e.lot,
          date: e.date,
          qty: e.qty,
          pcs: productForm.labelPcs,
          inspector: productForm.labelInspector,
          qc1: productForm.labelQc1,
          qc1Mode: productForm.labelQc1Mode,
          qc1Img,
          qc2: productForm.labelQc2,
          qc2Mode: productForm.labelQc2Mode,
          qc2Img,
          warning: productForm.labelWarning,
          qrCode: productForm.qrCode,
          color: productForm.qrColor,
          qrImg,
        });
        return c.toDataURL("image/png");
      });

      const win = window.open("", "_blank");
      if (!win) return;

      // 2-up layout: 2 labels per row on A4 landscape
      // A4 landscape = 297×210 mm, each label 80×50 mm with 5mm gap
      const imgTags = dataUrls.map((url, i) => {
        const br = (i % 2 === 1) ? "<br/>" : "";
        return `<img src="${url}" class="label-img" />${br}`;
      }).join("\n");

      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>พิมพ์ Label — ${productForm.name}</title>
            <style>
              @page { margin: 5mm; size: A4 landscape; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { background: white; font-family: Arial, sans-serif; }
              .grid { display: flex; flex-wrap: wrap; gap: 4mm; align-content: flex-start; }
              .label-img {
                width: 80mm; height: 50mm;
                display: block;
                page-break-inside: avoid;
              }
              @media print {
                body { margin: 0; }
                .grid { gap: 3mm; }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${dataUrls.map(url => `<img src="${url}" class="label-img" />`).join("\n")}
            </div>
            <script>
              window.addEventListener("load", () => {
                setTimeout(() => { window.print(); window.close(); }, 600);
              });
            </script>
          </body>
        </html>
      `);
      win.document.close();
    };

    Promise.all([
      loadImage(productForm.qrCode),
      productForm.labelQc1Mode === "image" ? loadImage(productForm.labelQc1Image) : Promise.resolve(null),
      productForm.labelQc2Mode === "image" ? loadImage(productForm.labelQc2Image) : Promise.resolve(null),
    ]).then(([qrImg, qc1Img, qc2Img]) => doRender(qrImg, qc1Img, qc2Img));
  }

  const warehouseOptions = [{ id: "", name: "- เลือกคลัง -" }, ...warehouses];
  const loading = cacheLoading && products.length === 0;

  // ── Reusable small label style for form ──
  const fl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: "#475569", marginBottom: 4, letterSpacing: "0.3px",
  };
  const fi: React.CSSProperties = {
    width: "100%", padding: "8px 10px",
    borderRadius: 8, border: "1.5px solid #d1d5db",
    fontSize: 13, boxSizing: "border-box", outline: "none",
  };

  // ── Mobile card renderers ──
  function renderProductCard(product: Product) {
    return (
      <div key={product.id} onClick={() => { setSelectedProduct(product); setShowProductDetailModal(true); }} style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #e8f0e9", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", gap: 14, alignItems: "center" }}>
        {product.image ? <img src={product.image} alt={product.name} style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 60, height: 60, borderRadius: 12, background: "#f0f4f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📦</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2e1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{product.sku}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#374151" }}>📍 {product.warehouse?.name || "-"}</span>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: product.stock === 0 ? "#e53e3e" : product.stock < 10 ? "#dd6b20" : "#38a169", background: product.stock === 0 ? "#fff5f5" : product.stock < 10 ? "#fffaf0" : "#f0fff4" }}>{product.stock} ชิ้น</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); openProductEdit(product); }} style={{ fontSize: 12, padding: "6px 12px" }}>แก้ไข</button>
          <button className="btn btn-small btn-danger" onClick={(e) => { e.stopPropagation(); handleProductDelete(product.id, product.name); }} style={{ fontSize: 12, padding: "6px 12px" }}>ลบ</button>
        </div>
      </div>
    );
  }

  function renderMaterialCard(material: Material) {
    return (
      <div key={material.id} onClick={() => { setSelectedMaterial(material); setShowMaterialDetailModal(true); }} style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #d8efda", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0, border: "2px solid #d8efda" }}>📦</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a2e1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{material.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
            <span style={{ marginRight: 10 }}>📏 {material.unit || "-"}</span>
            <span style={{ fontWeight: 600, color: "#16a34a" }}>฿ {material.unitPrice.toLocaleString("th-TH")}</span>
          </div>
          {material.description && <div style={{ fontSize: 12, color: "#7c4a2c", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💡 {material.description}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); openMaterialEdit(material); }} style={{ fontSize: 12, padding: "6px 12px" }}>แก้ไข</button>
          <button className="btn btn-small btn-danger" onClick={(e) => { e.stopPropagation(); handleMaterialDelete(material.id, material.name); }} style={{ fontSize: 12, padding: "6px 12px" }}>ลบ</button>
        </div>
      </div>
    );
  }

  function renderWarehouseCard(warehouse: Warehouse) {
    const count = products.filter((p) => p.warehouseId === warehouse.id).length;
    return (
      <div key={warehouse.id} onClick={() => { setSelectedWarehouse(warehouse); setShowWarehouseDetailModal(true); }} style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #e8f0e9", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        {warehouse.image ? <img src={warehouse.image} alt={warehouse.name} style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 60, height: 60, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🏭</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2e1c" }}>{warehouse.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{warehouse.location || "-"}</div>
          <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 4, fontWeight: 600 }}>{count} รายการสินค้า</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); openWarehouseEdit(warehouse); }} style={{ fontSize: 12, padding: "6px 12px" }}>แก้ไข</button>
          <button className="btn btn-small btn-danger" onClick={(e) => { e.stopPropagation(); handleWarehouseDelete(warehouse.id, warehouse.name); }} style={{ fontSize: 12, padding: "6px 12px" }}>ลบ</button>
        </div>
      </div>
    );
  }

  return (
    <section className="module-panel">
      <SavingOverlay visible={saving} />

      {deleteConfirm.show && (
        <DeleteConfirmModal message={deleteConfirm.message} onConfirm={deleteConfirm.onConfirm} onCancel={() => setDeleteConfirm((d) => ({ ...d, show: false }))} />
      )}

      {/* ── Product Edit Modal ── */}
      {showProductEditModal && (
        <div style={overlayStyle}>
          <div style={{
            ...modalStyle,
            maxWidth: isMobile ? "100%" : "860px",
            padding: isMobile ? "20px 16px" : "28px 32px",
            margin: isMobile ? "0" : undefined,
            borderRadius: isMobile ? "20px 20px 0 0" : "16px",
            alignSelf: isMobile ? "flex-end" : "center",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 20 }}>
                {productForm.id ? "✏️ แก้ไขสินค้า" : "➕ เพิ่มสินค้าใหม่"}
              </h2>
              <button onClick={() => setShowProductEditModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>✕</button>
            </div>

            {/* Inner Tabs: ข้อมูลสินค้า | Label & QR */}
            <div style={{ display: "flex", gap: 4, marginBottom: 22, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
              {(["info", "label"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setProductModalTab(t)}
                  style={{
                    flex: 1, padding: "9px 14px", borderRadius: 8, border: "none",
                    fontWeight: productModalTab === t ? 700 : 400,
                    fontSize: 13,
                    background: productModalTab === t ? "white" : "transparent",
                    color: productModalTab === t ? "#1a202c" : "#64748b",
                    cursor: "pointer",
                    boxShadow: productModalTab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "info" ? "📦 ข้อมูลสินค้า" : "🏷️ Label & QR"}
                </button>
              ))}
            </div>

            <form onSubmit={handleProductSubmit}>
              {/* ── Tab: ข้อมูลสินค้า ── */}
              {productModalTab === "info" && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <div className="field-group"><label>ชื่อสินค้า</label><input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></div>
                  <div className="field-group"><label>SKU</label><input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} required /></div>
                  <div className="field-group"><label>ประเภท</label><select value={productForm.type} onChange={(e) => setProductForm({ ...productForm, type: e.target.value })}><option value="SINGLE">สินค้าเดี่ยว</option><option value="COMPOSITE">สินค้าประกอบ</option></select></div>
                  <div className="field-group"><label>คลัง</label><select value={productForm.warehouseId} onChange={(e) => setProductForm({ ...productForm, warehouseId: e.target.value })}>{warehouseOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
                  <div className="field-group"><label>สต็อก</label><input type="number" min="0" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })} /></div>
                  <div className="field-group"><label>ราคา</label><input type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} /></div>
                  <div className="field-group" style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label>ภาพสินค้า</label><input type="file" accept="image/*" onChange={handleProductImageChange} />{productForm.image && <img src={productForm.image} alt="preview" style={{ maxWidth: 120, marginTop: 8, borderRadius: 4 }} />}</div>
                  <div className="field-group" style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label>คำอธิบาย</label><textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} style={{ width: "100%", boxSizing: "border-box" }} /></div>
                  <div className="field-group" style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label>รายละเอียดเพิ่มเติม</label><textarea value={productForm.details} onChange={(e) => setProductForm({ ...productForm, details: e.target.value })} rows={2} style={{ width: "100%", boxSizing: "border-box" }} /></div>

                  {productForm.type === "COMPOSITE" && (
                    <div className="field-group" style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
                      <label>วัสดุที่ใช้</label>
                      <select onChange={(e) => { addMaterialToProduct(e.target.value); e.target.value = ""; }} defaultValue="">
                        <option value="">- เลือกวัสดุ -</option>
                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit}) - {m.unitPrice} บาท</option>)}
                      </select>
                      {selectedProductMaterials.length > 0 && (
                        <div style={{ marginTop: 10, padding: 10, background: "#f5f5f5", borderRadius: 4 }}>
                          {selectedProductMaterials.map((pm) => {
                            const mat = materials.find((m) => m.id === pm.materialId);
                            return (
                              <div key={pm.materialId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: 8, background: "white", borderRadius: 4, flexWrap: "wrap", gap: 8 }}>
                                <strong style={{ fontSize: 14 }}>{mat?.name} ({mat?.unit})</strong>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <input type="number" min="0.1" step="0.1" value={pm.quantity} onChange={(e) => updateMaterialQuantity(pm.materialId, Number(e.target.value))} style={{ width: 60, padding: 4 }} />
                                  <span>{mat?.unit}</span>
                                  <button type="button" onClick={() => removeMaterialFromProduct(pm.materialId)} style={{ padding: "4px 8px", background: "#ff6b6b", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>ลบ</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Label & QR ── */}
              {productModalTab === "label" && (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px 20px" }}>

                  {/* ── Left: form fields ── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                    {/* Color picker */}
                    <div>
                      <label style={fl}>สีกรอบ / QR Code</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {QR_COLORS.map((c) => (
                          <button key={c.value} type="button" title={c.label}
                            onClick={() => setProductForm({ ...productForm, qrColor: c.value })}
                            style={{
                              width: 32, height: 32, borderRadius: "50%", background: c.value,
                              border: "none", cursor: "pointer", position: "relative",
                              boxShadow: productForm.qrColor === c.value
                                ? `0 0 0 2.5px white, 0 0 0 4.5px ${c.value}` : "0 2px 4px rgba(0,0,0,0.2)",
                              transform: productForm.qrColor === c.value ? "scale(1.15)" : "scale(1)",
                              transition: "all 0.15s",
                            }}
                          >
                            {productForm.qrColor === c.value && (
                              <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: c.value === "#ca8a04" ? "#000" : "white", fontSize: 14, fontWeight: 700 }}>✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* QR URL */}
                    <div>
                      <label style={fl}>URL / ข้อมูล QR Code</label>
                      <input style={fi} value={productForm.qrCode} onChange={(e) => setProductForm({ ...productForm, qrCode: e.target.value })} placeholder="https://... หรือ SKU" />
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, letterSpacing: "0.5px", textTransform: "uppercase" }}>ข้อมูล Label</div>
                    </div>

                    {/* Company + SIZE */}
                    <div>
                      <label style={fl}>ชื่อบริษัท</label>
                      <input style={fi} value={productForm.labelCompany} onChange={(e) => setProductForm({ ...productForm, labelCompany: e.target.value })} />
                    </div>
                    <div>
                      <label style={fl}>NAME (ชื่อบน Label)</label>
                      <input style={fi} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label style={fl}>SIZE</label>
                      <input style={fi} value={productForm.labelSize} onChange={(e) => setProductForm({ ...productForm, labelSize: e.target.value })} placeholder="เช่น 255x340x13mm." />
                    </div>

                    {/* INSPECTOR + QC */}
                    <div>
                      <label style={fl}>INSPECTOR</label>
                      <input style={fi} value={productForm.labelInspector} onChange={(e) => setProductForm({ ...productForm, labelInspector: e.target.value })} placeholder="ชื่อผู้ตรวจ" />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <label style={fl}>QC (1)</label>
                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                          {(["text", "image"] as const).map((mode) => (
                            <button key={mode} type="button" onClick={() => setProductForm({ ...productForm, labelQc1Mode: mode })} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: productForm.labelQc1Mode === mode ? "#dcfce7" : "white", color: productForm.labelQc1Mode === mode ? "#166534" : "#475569", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{mode === "text" ? "พิมพ์" : "รูปภาพ"}</button>
                          ))}
                        </div>
                        {productForm.labelQc1Mode === "text" ? (
                          <input style={fi} value={productForm.labelQc1} onChange={(e) => setProductForm({ ...productForm, labelQc1: e.target.value })} placeholder="ลายเซ็น" />
                        ) : (
                          <div>
                            <input style={fi} type="file" accept="image/*" onChange={(e) => handleQcSignatureImageChange("labelQc1Image", e)} />
                            {productForm.labelQc1Image && <img src={productForm.labelQc1Image} alt="QC 1 signature" style={{ maxWidth: "100%", maxHeight: 44, marginTop: 6, objectFit: "contain", background: "white", border: "1px solid #e5e7eb", borderRadius: 6 }} />}
                          </div>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={fl}>QC (2)</label>
                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                          {(["text", "image"] as const).map((mode) => (
                            <button key={mode} type="button" onClick={() => setProductForm({ ...productForm, labelQc2Mode: mode })} style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: productForm.labelQc2Mode === mode ? "#dcfce7" : "white", color: productForm.labelQc2Mode === mode ? "#166534" : "#475569", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{mode === "text" ? "พิมพ์" : "รูปภาพ"}</button>
                          ))}
                        </div>
                        {productForm.labelQc2Mode === "text" ? (
                          <input style={fi} value={productForm.labelQc2} onChange={(e) => setProductForm({ ...productForm, labelQc2: e.target.value })} placeholder="ลายเซ็น" />
                        ) : (
                          <div>
                            <input style={fi} type="file" accept="image/*" onChange={(e) => handleQcSignatureImageChange("labelQc2Image", e)} />
                            {productForm.labelQc2Image && <img src={productForm.labelQc2Image} alt="QC 2 signature" style={{ maxWidth: "100%", maxHeight: 44, marginTop: 6, objectFit: "contain", background: "white", border: "1px solid #e5e7eb", borderRadius: 6 }} />}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label style={fl}>คำเตือน (footer)</label>
                      <input style={fi} value={productForm.labelWarning} onChange={(e) => setProductForm({ ...productForm, labelWarning: e.target.value })} />
                    </div>

                    {/* ── LOT MANAGER ── */}
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          🗂️ Lots ({productForm.labelLots.length})
                        </div>
                        <button type="button"
                          onClick={() => setProductForm(f => ({ ...f, labelLots: [...f.labelLots, { id: `lot-${Date.now()}`, lot: "", qty: 0, date: new Date().toLocaleDateString("th-TH") }] }))}
                          style={{ fontSize: 12, padding: "4px 10px", background: "#16a34a", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
                        >+ เพิ่ม Lot</button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                        {productForm.labelLots.map((lt, idx) => (
                          <div key={lt.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Lot #{idx + 1}</span>
                              {productForm.labelLots.length > 1 && (
                                <button type="button"
                                  onClick={() => setProductForm(f => ({ ...f, labelLots: f.labelLots.filter(l => l.id !== lt.id) }))}
                                  style={{ fontSize: 11, padding: "2px 8px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 5, cursor: "pointer" }}
                                >ลบ</button>
                              )}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div>
                                <label style={{ ...fl, marginBottom: 4, fontSize: 13, fontWeight: 700 }}>LOT. เลขล็อต</label>
                                <input style={{ ...fi, padding: "8px 10px", fontSize: 14 }}
                                  value={lt.lot}
                                  onChange={(e) => setProductForm(f => ({ ...f, labelLots: f.labelLots.map(l => l.id === lt.id ? { ...l, lot: e.target.value } : l) }))}
                                  placeholder="เช่น 04-290526-RO-05"
                                />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div>
                                  <label style={{ ...fl, marginBottom: 4, fontSize: 13, fontWeight: 700 }}>QTY</label>
                                  <input style={{ ...fi, padding: "8px 10px", fontSize: 14 }} type="number" min={0}
                                    value={lt.qty}
                                    onChange={(e) => setProductForm(f => ({ ...f, labelLots: f.labelLots.map(l => l.id === lt.id ? { ...l, qty: Number(e.target.value) } : l) }))}
                                  />
                                </div>
                                <div>
                                  <label style={{ ...fl, marginBottom: 4, fontSize: 13, fontWeight: 700 }}>DATE</label>
                                  <input style={{ ...fi, padding: "8px 10px", fontSize: 14 }}
                                    value={lt.date}
                                    onChange={(e) => setProductForm(f => ({ ...f, labelLots: f.labelLots.map(l => l.id === lt.id ? { ...l, date: e.target.value } : l) }))}
                                    placeholder="DD/MM/YYYY"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PCS unit */}
                    <div>
                      <label style={fl}>หน่วย (PCS.)</label>
                      <input style={fi} value={productForm.labelPcs} onChange={(e) => setProductForm({ ...productForm, labelPcs: e.target.value })} placeholder="PCS." />
                    </div>

                    {/* Print count */}
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 10 }}>
                      <label style={fl}>🖨️ จำนวนสำเนาต่อ Lot</label>
                      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", width: 140 }}>
                        <button type="button" onClick={() => setProductForm(f => ({ ...f, printCount: Math.max(1, f.printCount - 1) }))}
                          style={{ width: 36, height: 36, background: "#f1f5f9", border: "none", fontSize: 18, cursor: "pointer", color: "#374151", flexShrink: 0 }}>−</button>
                        <input type="number" min={1} max={200} value={productForm.printCount}
                          onChange={(e) => setProductForm(f => ({ ...f, printCount: Math.max(1, Number(e.target.value)) }))}
                          style={{ flex: 1, border: "none", textAlign: "center", fontSize: 15, fontWeight: 700, outline: "none", padding: "6px 0", background: "white" }} />
                        <button type="button" onClick={() => setProductForm(f => ({ ...f, printCount: Math.min(200, f.printCount + 1) }))}
                          style={{ width: 36, height: 36, background: "#f1f5f9", border: "none", fontSize: 18, cursor: "pointer", color: "#374151", flexShrink: 0 }}>+</button>
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        รวม {productForm.labelLots.length} lots × {productForm.printCount} สำเนา = {productForm.labelLots.length * productForm.printCount} labels
                      </div>
                    </div>
                  </div>

                  {/* ── Right: preview + print ── */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase", alignSelf: "flex-start" }}>
                      ตัวอย่าง (Lot #1)
                    </div>

                    <QRLabel
                      company={productForm.labelCompany}
                      name={productForm.name}
                      size={productForm.labelSize}
                      lot={productForm.labelLots[0]?.lot || productForm.labelLot}
                      date={productForm.labelLots[0]?.date || productForm.labelDate}
                      qty={productForm.labelLots[0]?.qty ?? productForm.labelQty}
                      pcs={productForm.labelPcs}
                      inspector={productForm.labelInspector}
                      qc1={productForm.labelQc1}
                      qc1Mode={productForm.labelQc1Mode}
                      qc1Image={productForm.labelQc1Image}
                      qc2={productForm.labelQc2}
                      qc2Mode={productForm.labelQc2Mode}
                      qc2Image={productForm.labelQc2Image}
                      warning={productForm.labelWarning}
                      qrCode={productForm.qrCode}
                      color={productForm.qrColor}
                      canvasRef={qrPrintRef}
                    />

                    <button type="button" onClick={handlePrintQR}
                      style={{
                        width: "100%", padding: "13px 16px",
                        background: `linear-gradient(135deg, ${productForm.qrColor} 0%, ${productForm.qrColor}cc 100%)`,
                        color: productForm.qrColor === "#ca8a04" ? "#000" : "white",
                        border: "none", borderRadius: 12, fontSize: 14,
                        fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        boxShadow: `0 4px 14px ${productForm.qrColor}55`,
                      }}
                    >
                      🖨️ พิมพ์ {productForm.labelLots.length * productForm.printCount} Labels (80×50 mm)
                    </button>

                    <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                      A4 landscape · 2 labels/row · ประหยัดกระดาษ
                    </div>

                    {/* Lot summary chips */}
                    <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {productForm.labelLots.map((lt, i) => (
                        <div key={lt.id} style={{ padding: "4px 10px", borderRadius: 20, background: productForm.qrColor + "22", border: `1px solid ${productForm.qrColor}66`, fontSize: 11, color: "#374151" }}>
                          <span style={{ fontWeight: 700 }}>Lot {i + 1}:</span> {lt.lot || "(ว่าง)"} · {lt.qty} {productForm.labelPcs} · {lt.date}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                <button type="submit" className="btn" style={{ minWidth: 140 }}>
                  {productForm.id ? "💾 บันทึกการแก้ไข" : "💾 บันทึกสินค้า"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductEditModal(false)}>ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProductDetailModal && selectedProduct && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, padding: isMobile ? "20px 16px" : "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22 }}>{selectedProduct.name}</h2>
              <button onClick={() => setShowProductDetailModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>✕</button>
            </div>
            {selectedProduct.image && <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 20 }} />}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div><strong>SKU:</strong> {selectedProduct.sku}</div>
              <div><strong>ประเภท:</strong> {selectedProduct.type === "COMPOSITE" ? "สินค้าประกอบ" : "สินค้าเดี่ยว"}</div>
              <div><strong>คลัง:</strong> {selectedProduct.warehouse?.name || "-"}</div>
              <div><strong>สต็อก:</strong> {selectedProduct.stock} ชิ้น</div>
              <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><strong>ราคา:</strong> {selectedProduct.price?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}</div>
            </div>

            {/* ── QR section with saved color ── */}
            {selectedProduct.qrCode && (() => {
              const product = selectedProduct;
              const qrCode = product.qrCode || "";
              if (!qrCode) return null;
              const savedColor = product.qrColor || "#000000";

              function printLabels(copies: number) {
                const entries = Array.from({ length: copies }, (_, i) => i);
                const doRender = (qrImg: HTMLImageElement | null, qc1Img: HTMLImageElement | null, qc2Img: HTMLImageElement | null) => {
                  const dataUrls = entries.map(() => {
                    const c = document.createElement("canvas");
                    drawLabelOnCanvas(c, {
                      company: product.labelCompany || "T SIAMPACK CO., LTD.",
                      name: product.name,
                      size: product.labelSize || "",
                      lot: product.labelLot || "",
                      date: product.labelDate || new Date().toLocaleDateString("th-TH"),
                      qty: product.labelQty ?? product.stock,
                      pcs: product.labelPcs || "PCS.",
                      inspector: product.labelInspector || "",
                      qc1: product.labelQc1 || "",
                      qc1Mode: product.labelQc1Mode as SignatureMode || "text",
                      qc1Img,
                      qc2: product.labelQc2 || "",
                      qc2Mode: product.labelQc2Mode as SignatureMode || "text",
                      qc2Img,
                      warning: product.labelWarning || "เก็บไว้ในที่ร่ม ห้ามโดนแสงแดด อุณหภูมิไม่เกิน 38 องศา",
                      qrCode,
                      color: savedColor,
                      qrImg,
                    });
                    return c.toDataURL("image/png");
                  });
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(`<!DOCTYPE html><html><head><title>Label — ${product.name}</title><style>@page{margin:5mm;size:A4 landscape;}*{box-sizing:border-box;margin:0;padding:0;}body{background:white;}.grid{display:flex;flex-wrap:wrap;gap:3mm;align-content:flex-start;}.lbl{width:80mm;height:50mm;display:block;page-break-inside:avoid;}</style></head><body><div class="grid">${dataUrls.map(u => `<img src="${u}" class="lbl"/>`).join("")}</div><script>window.addEventListener("load",()=>{setTimeout(()=>{window.print();window.close();},500);});<\/script></body></html>`);
                  win.document.close();
                };
                Promise.all([
                  loadImage(qrCode),
                  product.labelQc1Mode === "image" ? loadImage(product.labelQc1Image) : Promise.resolve(null),
                  product.labelQc2Mode === "image" ? loadImage(product.labelQc2Image) : Promise.resolve(null),
                ]).then(([qrImg, qc1Img, qc2Img]) => doRender(qrImg, qc1Img, qc2Img));
              }

              return (
                <div style={{ marginBottom: 16, padding: 14, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10 }}>QR Code</div>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* QR preview: tint only the QR pixels, not the white background. */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <TintedQRCode
                        src={qrCode}
                        color={savedColor}
                        size={88}
                      />
                      {/* color dot */}
                      <div style={{
                        position: "absolute", bottom: -5, right: -5,
                        width: 16, height: 16, borderRadius: "50%",
                        background: savedColor, border: "2px solid white",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Color label */}
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                        สี:{" "}
                        <span style={{ fontWeight: 700, color: savedColor }}>
                          {QR_COLORS.find(c => c.value === savedColor)?.label || savedColor}
                        </span>
                      </div>

                      {/* Copy count row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>สำเนา</span>
                        <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
                          <button type="button"
                            onClick={() => setDetailPrintCount(n => Math.max(1, n - 1))}
                            style={{ width: 30, height: 30, background: "#f1f5f9", border: "none", fontSize: 16, cursor: "pointer", color: "#374151" }}>−</button>
                          <input type="number" min={1} max={200} value={detailPrintCount}
                            onChange={e => setDetailPrintCount(Math.max(1, Number(e.target.value)))}
                            style={{ width: 40, border: "none", textAlign: "center", fontSize: 14, fontWeight: 700, outline: "none", padding: "4px 0", background: "white" }} />
                          <button type="button"
                            onClick={() => setDetailPrintCount(n => Math.min(200, n + 1))}
                            style={{ width: 30, height: 30, background: "#f1f5f9", border: "none", fontSize: 16, cursor: "pointer", color: "#374151" }}>+</button>
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>labels</span>
                      </div>

                      {/* Print button */}
                      <button type="button"
                        onClick={() => printLabels(detailPrintCount)}
                        style={{
                          padding: "8px 16px", borderRadius: 8, border: "none",
                          background: savedColor,
                          color: savedColor === "#ca8a04" ? "#000" : "#fff",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                          boxShadow: `0 2px 8px ${savedColor}55`,
                        }}
                      >
                        🖨️ พิมพ์ {detailPrintCount} Label{detailPrintCount > 1 ? "s" : ""} (80×50 mm)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedProduct.description && <div style={{ marginBottom: 12 }}><strong>คำอธิบาย:</strong><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{selectedProduct.description}</p></div>}
            {selectedProduct.details && <div style={{ marginBottom: 12 }}><strong>รายละเอียด:</strong><p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{selectedProduct.details}</p></div>}
            {selectedProduct.type === "COMPOSITE" && selectedProduct.materials && selectedProduct.materials.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <strong>วัตถุดิบที่ใช้:</strong>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedProduct.materials.map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8f8f8", borderRadius: 8 }}>
                      <span>{m.material.name} ({m.material.unit}) × {m.quantity}</span>
                      <span style={{ fontWeight: 600 }}>{m.unitPrice.toLocaleString("th-TH", { style: "currency", currency: "THB" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setShowProductDetailModal(false); openProductEdit(selectedProduct); }}>แก้ไข</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowProductDetailModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {showMaterialEditModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: "600px", maxHeight: "80vh", overflowY: "auto", padding: isMobile ? "20px 16px" : "32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22 }}>{materialForm.id ? "แก้ไขวัสดุ" : "เพิ่มวัสดุใหม่"}</h2>
              <button onClick={() => setShowMaterialEditModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>✕</button>
            </div>
            <form onSubmit={handleMaterialSubmit}>
              {/* ส่วนที่ 1: ข้อมูลวัสดุพื้นฐาน */}
              <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700, color: "#1a2e1c" }}>ข้อมูลวัสดุ</h3>
                <div className="field-group"><label>ชื่อวัสดุ *</label><input value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} placeholder="เช่น เหล็กสแตนเลส, พลาสติก PET" required /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field-group"><label>หน่วย</label><input value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} placeholder="เช่น กก., ม., ชิ้น" /></div>
                  <div className="field-group"><label>ราคาต่อหน่วย (฿) *</label><input type="number" min="0" step="0.01" value={materialForm.unitPrice} onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: Number(e.target.value) })} required /></div>
                </div>
              </div>

              {/* ส่วนที่ 2: ข้อมูลการรับเข้า */}
              <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #e5e7eb" }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700, color: "#1a2e1c" }}>ข้อมูลการรับเข้า</h3>
                <div className="field-group"><label>ผู้จัดจำหน่าย (Supplier)</label><input value={materialForm.supplier} onChange={(e) => setMaterialForm({ ...materialForm, supplier: e.target.value })} placeholder="เช่น บ.เอิกศรีหริม" /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field-group"><label>เลขที่ Invoice</label><input value={materialForm.invoiceNo} onChange={(e) => setMaterialForm({ ...materialForm, invoiceNo: e.target.value })} placeholder="เช่น EPC15915" /></div>
                  <div className="field-group"><label>เลขที่ Lot / Batch</label><input value={materialForm.lotNumber} onChange={(e) => setMaterialForm({ ...materialForm, lotNumber: e.target.value })} placeholder="เช่น LOT-2025-001" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field-group"><label>รหัสสินค้า</label><input value={materialForm.productCode} onChange={(e) => setMaterialForm({ ...materialForm, productCode: e.target.value })} placeholder="เช่น PP-0.9x440" /></div>
                  <div className="field-group"><label>น้ำหนัก</label><input type="number" min="0" step="0.01" value={materialForm.weight} onChange={(e) => setMaterialForm({ ...materialForm, weight: Number(e.target.value) })} placeholder="เช่น 102.20" /></div>
                </div>
                <div className="field-group"><label>วันที่รับเข้า</label><input type="date" value={materialForm.receivingDate} onChange={(e) => setMaterialForm({ ...materialForm, receivingDate: e.target.value })} /></div>
              </div>

              {/* ส่วนที่ 3: หมายเหตุ */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 700, color: "#1a2e1c" }}>หมายเหตุ / ข้อมูลเพิ่มเติม</h3>
                <div className="field-group"><label>คำอธิบาย</label><textarea value={materialForm.description} onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })} rows={4} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 14, borderRadius: 8, border: "1.5px solid #d1d5db", fontFamily: "inherit" }} placeholder="เช่น ข้อมูลเทคนิค, ที่มา, ข้อจำกัด, เงื่อนไขการเก็บรักษา เป็นต้น" /></div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 16, borderTop: "2px solid #e5e7eb" }}>
                <button type="submit" className="btn">{materialForm.id ? "บันทึกการแก้ไข" : "เพิ่มวัสดุ"}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMaterialEditModal(false)}>ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMaterialDetailModal && selectedMaterial && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: "720px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, color: "#1a2e1c" }}>📦 {selectedMaterial.name}</h2>
              <button onClick={() => setShowMaterialDetailModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>✕</button>
            </div>
            
            {/* ส่วนที่ 1: ข้อมูลพื้นฐาน */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>ชื่อวัสดุ</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2e1c" }}>{selectedMaterial.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>หน่วย</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2e1c" }}>{selectedMaterial.unit || "-"}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>ราคาต่อหน่วย</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>฿ {selectedMaterial.unitPrice.toLocaleString("th-TH")}</div>
              </div>
            </div>

            {/* ส่วนที่ 2: ข้อมูลการรับเข้า */}
            {(selectedMaterial.supplier || selectedMaterial.invoiceNo || selectedMaterial.lotNumber) && (
              <div style={{ marginBottom: 24, padding: 16, background: "#f0fdf4", borderRadius: 12, border: "1px solid #d8efda" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#1a2e1c", borderBottom: "2px solid #d8efda", paddingBottom: 10 }}>📋 ข้อมูลการรับเข้า</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {selectedMaterial.supplier && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>ผู้จัดจำหน่าย</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1c" }}>{selectedMaterial.supplier}</div>
                    </div>
                  )}
                  {selectedMaterial.invoiceNo && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>เลขที่ Invoice</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1c", fontFamily: "monospace" }}>{selectedMaterial.invoiceNo}</div>
                    </div>
                  )}
                  {selectedMaterial.lotNumber && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>เลขที่ Lot / Batch</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1c", fontFamily: "monospace" }}>{selectedMaterial.lotNumber}</div>
                    </div>
                  )}
                  {selectedMaterial.productCode && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>รหัสสินค้า</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1c", fontFamily: "monospace" }}>{selectedMaterial.productCode}</div>
                    </div>
                  )}
                  {selectedMaterial.weight && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>น้ำหนัก</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1c" }}>{selectedMaterial.weight.toLocaleString("th-TH")} kg</div>
                    </div>
                  )}
                  {selectedMaterial.receivingDate && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>วันที่รับเข้า</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a2e1c" }}>{new Date(selectedMaterial.receivingDate).toLocaleDateString("th-TH")}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ส่วนที่ 3: คำอธิบาย */}
            {selectedMaterial.description && (
              <div style={{ marginBottom: 20, padding: 14, background: "#fff8f0", borderRadius: 10, border: "1px solid #fde2d3" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7c4a2c", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>📝 คำอธิบาย / หมายเหตุ</div>
                <p style={{ margin: 0, fontSize: 14, color: "#4a5568", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selectedMaterial.description}</p>
              </div>
            )}

            {/* ปุ่มพิมพ์ */}
            <div style={{ marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (!win) return;
                  const today = new Date().toLocaleDateString("th-TH");
                  win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="UTF-8">
                      <title>วัสดุ - ${selectedMaterial.name}</title>
                      <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Courier New', monospace; padding: 20px; background: #f5f5f5; }
                        .page { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border: 2px solid #333; }
                        .header { display: grid; grid-template-columns: auto 1fr; gap: 20px; margin-bottom: 30px; }
                        .company-info { text-align: center; }
                        .company-name { font-size: 18px; font-weight: bold; color: #1a2e1c; }
                        .table-header { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding: 12px; background: #e5e7eb; border: 1px solid #333; font-weight: bold; text-align: center; font-size: 12px; }
                        .table-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding: 10px; border: 1px solid #999; border-top: none; font-size: 12px; }
                        .table-row div { min-height: 20px; display: flex; align-items: center; }
                        .label { font-weight: bold; font-size: 13px; margin-bottom: 2px; }
                        .value { font-size: 14px; margin-bottom: 10px; }
                        .invoice-box { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
                        .invoice-item { border: 1px solid #d1d5db; padding: 10px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 11px; border-top: 1px solid #333; padding-top: 10px; }
                        @media print { body { background: white; } }
                      </style>
                    </head>
                    <body>
                      <div class="page">
                        <div class="header">
                          <div class="company-info">
                            <div class="company-name">T SIAMPACK CO., LTD.</div>
                            <div style="font-size: 12px; color: #666;">เอกสารรับรองวัสดุ</div>
                          </div>
                        </div>

                        <div class="invoice-box">
                          <div class="invoice-item">
                            <div class="label">ชื่อวัสดุ</div>
                            <div class="value">${selectedMaterial.name}</div>
                          </div>
                          <div class="invoice-item">
                            <div class="label">หน่วย</div>
                            <div class="value">${selectedMaterial.unit || "-"}</div>
                          </div>
                          <div class="invoice-item">
                            <div class="label">ราคา/หน่วย</div>
                            <div class="value">฿${selectedMaterial.unitPrice.toLocaleString("th-TH")}</div>
                          </div>
                        </div>

                        ${selectedMaterial.supplier || selectedMaterial.invoiceNo || selectedMaterial.lotNumber ? `
                          <div class="invoice-box">
                            ${selectedMaterial.supplier ? `<div class="invoice-item"><div class="label">ผู้จัดจำหน่าย</div><div class="value">${selectedMaterial.supplier}</div></div>` : ""}
                            ${selectedMaterial.invoiceNo ? `<div class="invoice-item"><div class="label">Invoice No.</div><div class="value">${selectedMaterial.invoiceNo}</div></div>` : ""}
                            ${selectedMaterial.lotNumber ? `<div class="invoice-item"><div class="label">Lot Number</div><div class="value">${selectedMaterial.lotNumber}</div></div>` : ""}
                          </div>
                        ` : ""}

                        ${selectedMaterial.description ? `
                          <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-left: 4px solid #16a34a;">
                            <div class="label">หมายเหตุ / คำอธิบาย</div>
                            <div class="value" style="white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">${selectedMaterial.description}</div>
                          </div>
                        ` : ""}

                        <div class="table-row" style="border: none; margin-top: 30px; padding-top: 30px; border-top: 1px solid #333;">
                          <div style="grid-column: 1 / 2;">
                            <div style="font-size: 12px;">วันที่: ${today}</div>
                          </div>
                          <div style="grid-column: 3 / 4; text-align: center;">
                            <div style="border-top: 1px solid #000; width: 150px; margin: 0 auto; font-size: 11px; padding-top: 3px;">ลายเซ็น</div>
                          </div>
                        </div>

                        <div class="footer">
                          <p>เอกสารนี้ออกโดย T SIAMPACK CO., LTD.</p>
                          <p>This document is issued by T SIAMPACK CO., LTD.</p>
                        </div>
                      </div>
                      <script>
                        window.addEventListener("load", () => {
                          setTimeout(() => { window.print(); window.close(); }, 600);
                        });
                      </script>
                    </body>
                    </html>
                  `);
                  win.document.close();
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "linear-gradient(135deg, #16a34a 0%, #16a34a99 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(22, 163, 74, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(22, 163, 74, 0.3)";
                }}
              >
                🖨️ พิมพ์เอกสาร (Print Document)
              </button>
            </div>

            {/* ปุ่มจัดการ */}
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setShowMaterialDetailModal(false); openMaterialEdit(selectedMaterial); }}>แก้ไข</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMaterialDetailModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {showWarehouseEditModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>{warehouseForm.id ? "แก้ไขคลัง" : "เพิ่มคลังใหม่"}</h2>
              <button onClick={() => setShowWarehouseEditModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>✕</button>
            </div>
            <form onSubmit={handleWarehouseSubmit}>
              <div className="field-group"><label>ชื่อคลัง</label><input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} required /></div>
              <div className="field-group"><label>ตำแหน่ง</label><input value={warehouseForm.location} onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })} placeholder="เช่น อาคาร A ชั้น 2" /></div>
              <div className="field-group"><label>ภาพคลัง</label><input type="file" accept="image/*" onChange={handleWarehouseImageChange} />{warehouseForm.image && <img src={warehouseForm.image} alt="preview" style={{ maxWidth: 120, marginTop: 8, borderRadius: 4 }} />}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "flex-end" }}>
                <button type="submit" className="btn">{warehouseForm.id ? "บันทึกการแก้ไข" : "บันทึกคลัง"}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowWarehouseEditModal(false)}>ยกเลิก</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWarehouseDetailModal && selectedWarehouse && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>{selectedWarehouse.name}</h2>
              <button onClick={() => setShowWarehouseDetailModal(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#666" }}>✕</button>
            </div>
            {selectedWarehouse.image && <img src={selectedWarehouse.image} alt={selectedWarehouse.name} style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, marginBottom: 16 }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><strong>ชื่อคลัง:</strong> {selectedWarehouse.name}</div>
              <div><strong>ตำแหน่ง:</strong> {selectedWarehouse.location || "-"}</div>
              <div>
                <strong>สินค้าในคลังนี้:</strong>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                  {products.filter((p) => p.warehouseId === selectedWarehouse.id).length === 0
                    ? <li style={{ color: "#888" }}>ยังไม่มีสินค้า</li>
                    : products.filter((p) => p.warehouseId === selectedWarehouse.id).map((p) => <li key={p.id}>{p.name} — สต็อก {p.stock} ชิ้น</li>)}
                </ul>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setShowWarehouseDetailModal(false); openWarehouseEdit(selectedWarehouse); }}>แก้ไข</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowWarehouseDetailModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      <div className="module-header">
        <div><h2>คลังสินค้า</h2><p>จัดการสินค้า วัสดุ และคลังเก็บ</p></div>
      </div>

      <div className="module-tabs">
        <button type="button" className={activeTab === "products" ? "tab active" : "tab"} onClick={() => setActiveTab("products")}>สินค้า</button>
        <button type="button" className={activeTab === "materials" ? "tab active" : "tab"} onClick={() => setActiveTab("materials")}>วัสดุ</button>
        <button type="button" className={activeTab === "warehouses" ? "tab active" : "tab"} onClick={() => setActiveTab("warehouses")}>คลัง</button>
      </div>

      {activeTab === "products" && (
        <div className="card">
          <div className="section-header" style={{ flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 12 : 0 }}>
            <h3>สินค้าทั้งหมด</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสินค้า, SKU หรือ QR" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="btn" onClick={openProductAdd}>+ เพิ่มสินค้า</button>
            </div>
          </div>
          {isMobile ? (
            <div style={{ padding: "4px 0" }}>
              {loading && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลดข้อมูล...</div>}
              {!loading && filteredProducts.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>ไม่พบสินค้า</div>}
              {!loading && filteredProducts.map(renderProductCard)}
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>ภาพ</th><th>ชื่อ</th><th>SKU / QR Code</th><th>ประเภท</th><th>คลัง</th><th>สต็อก</th><th>ราคา</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={8} className="text-center">กำลังโหลดข้อมูล...</td></tr>}
                  {!loading && filteredProducts.length === 0 && <tr><td colSpan={8} className="text-center">ไม่พบสินค้า</td></tr>}
                  {!loading && filteredProducts.map((product) => (
                    <tr key={product.id} style={{ cursor: "pointer" }} onClick={() => { setSelectedProduct(product); setShowProductDetailModal(true); }}>
                      <td>{product.image ? <img src={product.image} alt={product.name} style={{ maxWidth: 60, maxHeight: 60, borderRadius: 4 }} /> : <span className="text-muted">ไม่มีภาพ</span>}</td>
                      <td>{product.name}</td>
                      <td>
                        <div>{product.sku}</div>
                        {product.qrCode && (
                          <img
                            src={product.qrCode}
                            alt="QR"
                            style={{
                              maxWidth: 60,
                              marginTop: 5,
                              borderRadius: 2,
                              filter: product.qrColor && product.qrColor !== "#000000"
                                ? `drop-shadow(0 0 3px ${product.qrColor})`
                                : undefined,
                            }}
                          />
                        )}
                        {!product.qrCode && <small className="sub-text">-</small>}
                      </td>
                      <td>{product.type === "COMPOSITE" ? "ประกอบ" : "เดี่ยว"}</td>
                      <td>{product.warehouse?.name || "-"}</td>
                      <td>{product.stock}</td>
                      <td>{product.price?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}</td>
                      <td className="table-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-small" type="button" onClick={() => openProductEdit(product)}>แก้ไข</button>
                        <button className="btn btn-small btn-danger" type="button" onClick={() => handleProductDelete(product.id, product.name)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "materials" && (
        <MaterialWIPView />
      )}

      {activeTab === "warehouses" && (
        <div className="card">
          <div className="section-header" style={{ flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 12 : 0 }}>
            <h3>คลังทั้งหมด</h3>
            <button type="button" className="btn" onClick={openWarehouseAdd}>+ เพิ่มคลัง</button>
          </div>
          {isMobile ? (
            <div style={{ padding: "4px 0" }}>
              {loading && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลดข้อมูล...</div>}
              {!loading && warehouses.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>ยังไม่มีคลัง</div>}
              {!loading && warehouses.map(renderWarehouseCard)}
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead><tr><th>ภาพ</th><th>ชื่อคลัง</th><th>ตำแหน่ง</th><th>สินค้าในคลัง</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={5} className="text-center">กำลังโหลดข้อมูล...</td></tr>}
                  {!loading && warehouses.length === 0 && <tr><td colSpan={5} className="text-center">ยังไม่มีคลัง</td></tr>}
                  {!loading && warehouses.map((warehouse) => (
                    <tr key={warehouse.id} style={{ cursor: "pointer" }} onClick={() => { setSelectedWarehouse(warehouse); setShowWarehouseDetailModal(true); }}>
                      <td>{warehouse.image ? <img src={warehouse.image} alt={warehouse.name} style={{ maxWidth: 60, maxHeight: 60, borderRadius: 4 }} /> : <span className="text-muted">ไม่มีภาพ</span>}</td>
                      <td>{warehouse.name}</td>
                      <td>{warehouse.location || "-"}</td>
                      <td>{products.filter((p) => p.warehouseId === warehouse.id).length} รายการ</td>
                      <td className="table-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-small" type="button" onClick={() => openWarehouseEdit(warehouse)}>แก้ไข</button>
                        <button className="btn btn-small btn-danger" type="button" onClick={() => handleWarehouseDelete(warehouse.id, warehouse.name)}>ลบ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── TransactionView ──────────────────────────────────────────────────────────

export function TransactionView() {
  const isMobile = useIsMobile();
  const { orders: cachedOrders, warehouses: cachedWarehouses, products: cachedProducts, loading: cacheLoading, refresh } = useCache();

  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const loading = cacheLoading && orders.length === 0;

  useEffect(() => { setOrders(cachedOrders); }, [cachedOrders]);
  useEffect(() => { setWarehouses(cachedWarehouses); }, [cachedWarehouses]);
  useEffect(() => { setProducts(cachedProducts); }, [cachedProducts]);

  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [activeTab, setActiveTab] = useState<"transaction" | "search">("transaction");
  const [transactionType, setTransactionType] = useState<TransactionType>("TRANSFER");
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [scanResult, setScanResult] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [history, setHistory] = useState<TransactionHistoryItem[]>([]);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showTransactionConfirm, setShowTransactionConfirm] = useState(false);
  const [showMobileScanner, setShowMobileScanner] = useState(false);
  const [scannerSuccess, setScannerSuccess] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const productsRef = useRef<Product[]>([]);
  useEffect(() => { productsRef.current = products; }, [products]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCameraSupported(!!navigator.mediaDevices?.getUserMedia);
      setScannerSupported("BarcodeDetector" in window);
    }
  }, []);

  useEffect(() => { if (selectedProduct?.warehouseId) setSourceWarehouseId(selectedProduct.warehouseId); }, [selectedProduct]);
  useEffect(() => { if (mode !== "scan") stopCamera(); return () => { stopCamera(); }; }, [mode]);

  function stopCamera() {
    if (scanLoopRef.current !== null) { window.cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
    setCameraStream(null); setIsCameraActive(false);
  }

  function findProductByCodeFromRef(code: string): Product | undefined {
    return productsRef.current.find((p) =>
      p.sku.toLowerCase() === code.toLowerCase() ||
      p.qrCode?.toLowerCase() === code.toLowerCase() ||
      p.qrCode?.toLowerCase().includes(code.toLowerCase())
    );
  }

  function handleScannedCode(raw: string) {
    setScanResult(raw);
    const trimmed = raw.trim();
    if (!trimmed) { setFormError("กรุณากรอกรหัสสินค้า หรือสแกน QR ก่อน"); setFormMessage(null); return; }
    const product = findProductByCodeFromRef(trimmed);
    if (!product) { setFormError("ไม่พบสินค้าจากรหัสนี้ กรุณาลองใหม่"); setFormMessage(null); setSelectedProduct(null); return; }
    setSelectedProduct(product); setFormError(null);
    setFormMessage(`เลือกสินค้า ${product.name} เรียบร้อยแล้ว`);
  }

  function scanWithCanvas() {
    if (!videoRef.current) { scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas); return; }
    const video = videoRef.current;
    if (video.readyState < 2) { scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas); return; }
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCameraError("ไม่สามารถประมวลผลภาพจากกล้องได้"); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) { stopCamera(); handleScannedCode(code.data); return; }
    scanLoopRef.current = window.requestAnimationFrame(scanWithCanvas);
  }

  function scanFrame(detector: any) {
    if (!videoRef.current || videoRef.current.readyState < 2) {
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector)); return;
    }
    detector.detect(videoRef.current).then((codes: any[]) => {
      if (codes?.length > 0) {
        const raw = codes[0].rawValue || codes[0].displayValue || "";
        if (raw) { stopCamera(); handleScannedCode(raw); return; }
      }
      scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector));
    }).catch((e: any) => { console.error(e); scanLoopRef.current = window.requestAnimationFrame(() => scanFrame(detector)); });
  }

  async function startCamera() {
    setFormError(null); setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("ไม่สามารถเข้าถึงกล้องได้บนอุปกรณ์หรือเบราว์เซอร์นี้"); return; }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(mediaStream);
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; await videoRef.current.play(); }
      setIsCameraActive(true);
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        scanFrame(detector);
      } else { scanWithCanvas(); }
    } catch { setCameraError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตให้เว็บนี้ใช้กล้อง"); }
  }

  function resetTransactionForm() {
    setMode("scan"); setScanResult(""); setManualCode(""); setSelectedProduct(null);
    setSourceWarehouseId(""); setDestinationWarehouseId(""); setCustomerName("");
    setQuantity(1); setFormMessage(null); setFormError(null); setCameraError(null); stopCamera();
  }

  function showFormMessage(text: string) { setFormMessage(text); setFormError(null); window.setTimeout(() => setFormMessage(null), 4000); }
  function showFormError(text: string) { setFormError(text); setFormMessage(null); }

  function findProductByCode(code: string) {
    return products.find((p) =>
      p.sku.toLowerCase() === code.toLowerCase() ||
      p.qrCode?.toLowerCase() === code.toLowerCase() ||
      p.qrCode?.toLowerCase().includes(code.toLowerCase())
    );
  }

  async function handleProductCodeLookup(code: string) {
    const trimmed = code.trim();
    if (!trimmed) { showFormError("กรุณากรอกรหัสสินค้า หรือสแกน QR ก่อน"); return; }
    const product = findProductByCode(trimmed);
    if (!product) { showFormError("ไม่พบสินค้าจากรหัสนี้ กรุณาลองใหม่"); setSelectedProduct(null); return; }
    setSelectedProduct(product); setScanResult(trimmed);
    setFormMessage(`เลือกสินค้า ${product.name} เรียบร้อยแล้ว`);
  }

  function handleRequestConfirm() {
    if (!selectedProduct) { showFormError("กรุณาเลือกสินค้าก่อนดำเนินการ"); return; }
    if (quantity < 1) { showFormError("ปริมาณต้องมากกว่า 0"); return; }
    if (transactionType === "TRANSFER") {
      if (!sourceWarehouseId || !destinationWarehouseId) { showFormError("กรุณาเลือกทั้งคลังต้นทางและปลายทาง"); return; }
      if (sourceWarehouseId === destinationWarehouseId) { showFormError("ไม่สามารถเลือกคลังต้นทางและปลายทางเหมือนกันได้"); return; }
      if (selectedProduct.warehouseId && selectedProduct.warehouseId !== sourceWarehouseId) { showFormError("สินค้าไม่อยู่ในคลังต้นทางที่เลือก กรุณาตรวจสอบ"); return; }
    }
    if (transactionType === "SHIP") {
      if (!sourceWarehouseId) { showFormError("กรุณาเลือกคลังต้นทาง"); return; }
      if (!customerName.trim()) { showFormError("กรุณาระบุชื่อลูกค้า"); return; }
      if (selectedProduct.stock < quantity) { showFormError("สต็อกไม่เพียงพอ"); return; }
      if (selectedProduct.warehouseId && selectedProduct.warehouseId !== sourceWarehouseId) { showFormError("สินค้าไม่อยู่ในคลังต้นทางที่เลือก กรุณาตรวจสอบ"); return; }
    }
    setShowTransactionConfirm(true);
  }

  async function handleConfirmTransaction() {
    setShowTransactionConfirm(false);
    if (!selectedProduct) return;

    if (transactionType === "TRANSFER") {
      try {
        const res = await fetch(`/api/products/${selectedProduct.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selectedProduct, stock: selectedProduct.stock, warehouseId: destinationWarehouseId }) });
        if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");
        const updated = await res.json();
        await refresh();
        const sn = warehouses.find((w) => w.id === sourceWarehouseId)?.name || "คลังต้นทาง";
        const dn = warehouses.find((w) => w.id === destinationWarehouseId)?.name || "คลังปลายทาง";
        setHistory((c) => [{ id: `${Date.now()}`, type: "TRANSFER", productName: updated.name, sku: updated.sku, quantity, from: sn, to: dn, timestamp: new Date().toLocaleString("th-TH"), note: "โอนสินค้าไปยังคลังปลายทาง" }, ...c]);
        showToast("✓ โอนสินค้าข้ามคลังเรียบร้อยแล้ว");
        resetTransactionForm();
      } catch { showFormError("เกิดข้อผิดพลาดขณะโอนสินค้า"); }
      return;
    }

    if (transactionType === "SHIP") {
      try {
        const res = await fetch(`/api/products/${selectedProduct.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selectedProduct, stock: selectedProduct.stock - quantity, warehouseId: sourceWarehouseId }) });
        if (!res.ok) throw new Error("อัปเดตไม่สำเร็จ");
        const updated = await res.json();
        await refresh();
        const sn = warehouses.find((w) => w.id === sourceWarehouseId)?.name || "คลังต้นทาง";
        setHistory((c) => [{ id: `${Date.now()}`, type: "SHIP", productName: updated.name, sku: updated.sku, quantity, from: sn, to: customerName, timestamp: new Date().toLocaleString("th-TH"), note: "ส่งสินค้าให้ลูกค้า" }, ...c]);
        showToast("✓ ส่งสินค้าถึงลูกค้าเรียบร้อยแล้ว");
        resetTransactionForm();
      } catch { showFormError("เกิดข้อผิดพลาดขณะส่งสินค้า"); }
      return;
    }
  }

  const destinationOptions = warehouses.filter((w) => w.id !== sourceWarehouseId);
  const sourceWarehouseName = warehouses.find((w) => w.id === sourceWarehouseId)?.name || "";
  const destWarehouseName = warehouses.find((w) => w.id === destinationWarehouseId)?.name || "";

  return (
    <section className="module-panel">
      {showMobileScanner && (
        <MobileScannerView
          products={products}
          warehouses={warehouses}
          onClose={() => setShowMobileScanner(false)}
          onSuccess={(msg) => {
            setScannerSuccess(msg);
            window.setTimeout(() => setScannerSuccess(null), 4000);
            refresh();
          }}
        />
      )}

      {showTransactionConfirm && selectedProduct && (
        <TransactionConfirmModal
          transactionType={transactionType}
          product={selectedProduct}
          quantity={quantity}
          sourceWarehouse={sourceWarehouseName}
          destinationWarehouse={destWarehouseName}
          customerName={customerName}
          onConfirm={handleConfirmTransaction}
          onCancel={() => setShowTransactionConfirm(false)}
        />
      )}

      <div className="module-header">
        <div><h2>ระบบรับเข้า-ส่งสินค้า</h2><p>สแกน QR บนมือถือหรือพิมพ์รหัสสินค้าในคอม เพื่อโอนคลังหรือส่งให้ลูกค้า</p></div>
      </div>

      <button
        onClick={() => setShowMobileScanner(true)}
        style={{ width: "100%", padding: "16px", marginBottom: 16, background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "white", border: "none", borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}
      >
        <span style={{ fontSize: 22 }}>📷</span>
        สแกน QR บนมือถือ (ง่ายที่สุด)
      </button>

      {scannerSuccess && (
        <div className="alert success" style={{ marginBottom: 14 }}>✓ {scannerSuccess}</div>
      )}

      <div className="module-tabs" style={{ marginBottom: 18 }}>
        <button type="button" className={activeTab === "transaction" ? "tab active" : "tab"} onClick={() => setActiveTab("transaction")}>🔄 ย้าย / ส่งสินค้า</button>
        <button type="button" className={activeTab === "search" ? "tab active" : "tab"} onClick={() => setActiveTab("search")}>🔍 ค้นหาสินค้า</button>
      </div>

      {activeTab === "search" && <ProductSearchTab products={products} warehouses={warehouses} />}

      {activeTab === "transaction" && (
        <>
          <div className="module-tabs" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === "scan" ? "tab active" : "tab"} onClick={() => setMode("scan")}>สแกน QR</button>
            <button type="button" className={mode === "manual" ? "tab active" : "tab"} onClick={() => setMode("manual")}>พิมพ์รหัส</button>
          </div>
          <div className="module-tabs" style={{ marginBottom: 18 }}>
            <button type="button" className={transactionType === "TRANSFER" ? "tab active" : "tab"} onClick={() => setTransactionType("TRANSFER")}>โอนข้ามคลัง</button>
            <button type="button" className={transactionType === "SHIP" ? "tab active" : "tab"} onClick={() => setTransactionType("SHIP")}>ส่งลูกค้า</button>
          </div>

          {(formMessage || formError) && <div className={`alert ${formError ? "" : "success"}`}>{formError || formMessage}</div>}

          <div className={isMobile ? "mobile-stack" : "form-grid"}>
            <div className="card form-card">
              <h3 style={{ marginTop: 0 }}>เลือกสินค้า</h3>
              {mode === "scan" && (
                <div className="field-group">
                  <label>สแกน QR ด้วยกล้อง</label>
                  {cameraError && <div className="alert">{cameraError}</div>}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" className={isCameraActive ? "btn btn-secondary" : "btn"} onClick={startCamera} disabled={isCameraActive}>เริ่มสแกน</button>
                    {isCameraActive && <button type="button" className="btn btn-secondary" onClick={stopCamera}>หยุดสแกน</button>}
                  </div>
                  <small className="sub-text">เล็งกล้องไปที่ QR code เพื่อสแกน</small>
                  <div style={{ marginTop: 16, borderRadius: 18, overflow: "hidden", background: "#000" }}>
                    <video ref={videoRef} style={{ width: "100%", minHeight: 220, objectFit: "cover" }} muted playsInline />
                  </div>
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                </div>
              )}
              {mode === "manual" && (
                <div className="field-group">
                  <label>ป้อน SKU / รหัสสินค้า</label>
                  <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="เช่น ERP-PC-001" />
                  <div className="form-actions" style={{ padding: 0, marginTop: 4 }}>
                    <button type="button" className="btn" onClick={() => handleProductCodeLookup(manualCode)}>ค้นหา</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setManualCode(""); setSelectedProduct(null); setFormError(null); setFormMessage(null); }}>ล้าง</button>
                  </div>
                </div>
              )}
              <div className="field-group">
                <label>รหัสที่อ่านได้</label>
                <input value={scanResult || manualCode} disabled />
              </div>
              {selectedProduct ? (
                <div style={{ padding: 18, borderRadius: 22, background: "#f8fff7", border: "1px solid #d8efda" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    {selectedProduct.image ? <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 14 }} /> : <div style={{ width: 72, height: 72, borderRadius: 14, background: "#e7f0e3", display: "flex", alignItems: "center", justifyContent: "center", color: "#66776b" }}>รูป</div>}
                    <div>
                      <strong>{selectedProduct.name}</strong>
                      <p style={{ margin: "6px 0 0 0", color: "#5f6f63" }}>{selectedProduct.sku}</p>
                      <p style={{ margin: "4px 0 0 0", color: "#5f6f63" }}>สต็อก {selectedProduct.stock} ชิ้น</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 18, borderRadius: 22, background: "#fff7f5", border: "1px solid #f2d8d4", color: "#8a4f45" }}>กรุณาสแกน QR หรือป้อนรหัสสินค้าเพื่อเริ่มต้น</div>
              )}
            </div>

            <div className="card form-card">
              <h3 style={{ marginTop: 0 }}>{transactionType === "TRANSFER" ? "โอนข้ามคลัง" : "ส่งสินค้าให้ลูกค้า"}</h3>
              <div className="field-group">
                <label>คลังต้นทาง</label>
                <select value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)}>
                  <option value="">- เลือกคลังต้นทาง -</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              {transactionType === "TRANSFER" && (
                <div className="field-group">
                  <label>คลังปลายทาง</label>
                  <select value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>
                    <option value="">- เลือกคลังปลายทาง -</option>
                    {destinationOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
              {transactionType === "SHIP" && (
                <div className="field-group">
                  <label>ชื่อลูกค้า</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="เช่น บริษัท ลูกค้า จำกัด" />
                </div>
              )}
              <div className="field-group">
                <label>จำนวน</label>
                {isMobile ? (
                  <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #d1d5db", borderRadius: 12, overflow: "hidden" }}>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: 48, height: 48, background: "#f9fafb", border: "none", fontSize: 20, cursor: "pointer", color: "#374151", flexShrink: 0 }}>−</button>
                    <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} style={{ flex: 1, border: "none", textAlign: "center", fontSize: 18, fontWeight: 700, outline: "none", padding: "10px 0", background: "white" }} />
                    <button onClick={() => setQuantity(quantity + 1)} style={{ width: 48, height: 48, background: "#f9fafb", border: "none", fontSize: 20, cursor: "pointer", color: "#374151", flexShrink: 0 }}>+</button>
                  </div>
                ) : (
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={handleRequestConfirm} style={{ flex: isMobile ? 1 : undefined }}>บันทึกการเคลื่อนย้าย</button>
                <button type="button" className="btn btn-secondary" onClick={resetTransactionForm} style={{ flex: isMobile ? 1 : undefined }}>รีเซ็ต</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>ประวัติการเคลื่อนย้ายล่าสุด</h3>
            {isMobile ? (
              <div>
                {history.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888", background: "white", borderRadius: 16 }}>ยังไม่มีรายการเคลื่อนย้าย</div>}
                {history.map((item) => (
                  <div key={item.id} style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e8f0e9", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{item.productName}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: item.type === "TRANSFER" ? "#ede9fe" : "#fce7f3", color: item.type === "TRANSFER" ? "#6d28d9" : "#be185d" }}>{item.type === "TRANSFER" ? "โอนคลัง" : "ส่งลูกค้า"}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      <div>{item.from} → {item.to}</div>
                      <div style={{ marginTop: 4 }}>{item.quantity} ชิ้น · {item.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th>จำนวน</th><th>จาก</th><th>ถึง</th><th>บันทึก</th></tr></thead>
                  <tbody>
                    {history.length === 0 && <tr><td colSpan={7} className="text-center">ยังไม่มีรายการเคลื่อนย้าย</td></tr>}
                    {history.map((item) => (
                      <tr key={item.id}><td>{item.timestamp}</td><td>{item.productName}</td><td>{item.type === "TRANSFER" ? "โอนคลัง" : "ส่งลูกค้า"}</td><td>{item.quantity}</td><td>{item.from}</td><td>{item.to}</td><td>{item.note}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <h3>รายการคำสั่งซื้อ</h3>
            {isMobile ? (
              <div>
                {loading && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลดคำสั่งซื้อ...</div>}
                {!loading && orders.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888", background: "white", borderRadius: 16 }}>ไม่มีรายการคำสั่งซื้อ</div>}
                {orders.map((order) => (
                  <div key={order.id} style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e8f0e9", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{order.customer?.name ?? "ลูกค้า"}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>{order.total?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>#{order.id.slice(0, 8)} · {new Date(order.createdAt).toLocaleDateString("th-TH")} · {order.status}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>รหัสคำสั่งซื้อ</th><th>ลูกค้า</th><th>วันที่</th><th>สถานะ</th><th>ยอดรวม</th></tr></thead>
                  <tbody>
                    {loading && <tr><td colSpan={5} className="text-center">กำลังโหลดคำสั่งซื้อ...</td></tr>}
                    {!loading && orders.length === 0 && <tr><td colSpan={5} className="text-center">ไม่มีรายการคำสั่งซื้อ</td></tr>}
                    {orders.map((order) => (
                      <tr key={order.id}><td>{order.id}</td><td>{order.customer?.name ?? "ลูกค้า"}</td><td>{new Date(order.createdAt).toLocaleDateString()}</td><td>{order.status}</td><td>{order.total?.toLocaleString("th-TH", { style: "currency", currency: "THB" }) ?? "-"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ─── ProductionView ───────────────────────────────────────────────────────────

export function ProductionView() {
  const isMobile = useIsMobile();
  const { products, materials, loading: cacheLoading } = useCache();
  const loading = cacheLoading && products.length === 0;
  const compositeProducts = products.filter((p) => p.type === "COMPOSITE");

  return (
    <section className="module-panel">
      <div className="module-header"><div><h2>การผลิต</h2><p>วางแผน BOM และจัดการผลิตสินค้าประกอบ</p></div></div>
      <div className="card-grid">
        <div className="card small-card"><h3>สินค้าเชิงประกอบ</h3><p>{compositeProducts.length} รายการ</p></div>
        <div className="card small-card"><h3>วัสดุที่มีอยู่</h3><p>{materials.length} รายการ</p></div>
      </div>
      {isMobile ? (
        <div>
          {loading && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลด...</div>}
          {!loading && compositeProducts.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888", background: "white", borderRadius: 16 }}>ยังไม่มีสินค้าประกอบในระบบ</div>}
          {compositeProducts.map((p) => (
            <div key={p.id} style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e8f0e9" }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{p.sku} · สต็อก {p.stock} · {materials.length} วัตถุดิบ</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead><tr><th>ชื่อสินค้า</th><th>SKU</th><th>สต็อก</th><th>วัตถุดิบที่เกี่ยวข้อง</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="text-center">กำลังโหลดข้อมูลการผลิต...</td></tr>}
              {!loading && compositeProducts.length === 0 && <tr><td colSpan={4} className="text-center">ยังไม่มีสินค้าประกอบในระบบ</td></tr>}
              {compositeProducts.map((p) => (
                <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.stock}</td><td>{materials.length} รายการ</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── MachineView ──────────────────────────────────────────────────────────────

export function MachineView() {
  const isMobile = useIsMobile();
  const machines = [
    { id: "MC-001", name: "เครื่องพิมพ์อิงค์เจ็ต", status: "พร้อมใช้งาน", mode: "Auto", lastActive: "2026-05-20" },
    { id: "MC-002", name: "เครื่องตัดเลเซอร์", status: "รอซ่อม", mode: "Manual", lastActive: "2026-05-19" },
    { id: "MC-003", name: "หุ่นยนต์ประกอบ", status: "กำลังทำงาน", mode: "Auto", lastActive: "2026-05-21" },
  ];
  const statusColor: Record<string, string> = { "พร้อมใช้งาน": "#16a34a", "รอซ่อม": "#dc2626", "กำลังทำงาน": "#2563eb" };

  return (
    <section className="module-panel">
      <div className="module-header"><div><h2>เครื่องจักร</h2><p>ตรวจสอบสถานะและบันทึกการทำงานของเครื่องจักร</p></div></div>
      {isMobile ? (
        <div>
          {machines.map((m) => (
            <div key={m.id} style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid #e8f0e9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>⚙️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{m.id} · {m.mode} · {m.lastActive}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, color: statusColor[m.status] || "#374151", background: `${statusColor[m.status] || "#374151"}18` }}>{m.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead><tr><th>รหัสเครื่อง</th><th>ชื่อเครื่อง</th><th>สถานะ</th><th>โหมด</th><th>วันที่ใช้งานล่าสุด</th></tr></thead>
            <tbody>
              {machines.map((m) => <tr key={m.id}><td>{m.id}</td><td>{m.name}</td><td>{m.status}</td><td>{m.mode}</td><td>{m.lastActive}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── ReportView ───────────────────────────────────────────────────────────────

export function ReportView() {
  return (
    <section className="module-panel">
      <div className="module-header"><div><h2>รายงาน</h2><p>ดูภาพรวมสถิติ รายงานสินค้าคงคลัง และผลการผลิต</p></div></div>
      <ReportChart />
    </section>
  );
}

// ─── SystemView ───────────────────────────────────────────────────────────────

export function SystemView() {
  const isMobile = useIsMobile();
  const { users, loading: cacheLoading } = useCache();
  const loading = cacheLoading && users.length === 0;

  return (
    <section className="module-panel">
      <div className="module-header"><div><h2>ระบบ</h2><p>จัดการผู้ใช้งาน สิทธิ์ และตั้งค่าระบบพื้นฐาน</p></div></div>
      {isMobile ? (
        <div>
          {loading && <div style={{ textAlign: "center", padding: 24, color: "#888" }}>กำลังโหลดข้อมูลผู้ใช้...</div>}
          {!loading && users.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#888", background: "white", borderRadius: 16 }}>ยังไม่มีผู้ใช้งานในระบบ</div>}
          {users.map((user) => (
            <div key={user.id} style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 10, border: "1px solid #e8f0e9", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{user.name?.charAt(0)?.toUpperCase() || "?"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "#f0f4ff", color: "#4338ca" }}>{user.role}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-responsive">
          <table>
            <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>วันที่สร้าง</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="text-center">กำลังโหลดข้อมูลผู้ใช้...</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={4} className="text-center">ยังไม่มีผู้ใช้งานในระบบ</td></tr>}
              {users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>---</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

type NavItem = {
  key: string;
  label: string;
  icon: string;
  component: React.FC;
};

const NAV_ITEMS: NavItem[] = [
  { key: "inventory", label: "คลังสินค้า", icon: "📦", component: InventoryView },
  { key: "transaction", label: "รับเข้า-ส่งออก", icon: "🔄", component: TransactionView },
  { key: "production", label: "การผลิต", icon: "🏭", component: ProductionView },
  { key: "machine", label: "เครื่องจักร", icon: "⚙️", component: MachineView },
  { key: "report", label: "รายงาน", icon: "📊", component: ReportView },
  { key: "system", label: "ระบบ", icon: "🛠️", component: SystemView },
];

export function AppLayout() {
  const isMobile = useIsMobile();
  const [activeKey, setActiveKey] = useState("inventory");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeItem = NAV_ITEMS.find((n) => n.key === activeKey) ?? NAV_ITEMS[0];
  const ActiveComponent = activeItem.component;

  function handleNavClick(key: string) {
    setActiveKey(key);
    if (isMobile) setSidebarOpen(false);
  }

  useEffect(() => { if (!isMobile) setSidebarOpen(false); }, [isMobile]);

  useEffect(() => {
    if (isMobile && sidebarOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, sidebarOpen]);

  const SIDEBAR_W = 240;

  const sidebarContent = (
    <div style={{ width: isMobile ? "100vw" : SIDEBAR_W, height: "100%", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #1a2e1c 0%, #16251a 100%)", color: "white", overflowY: "auto" }}>
      <div style={{ padding: isMobile ? "48px 24px 20px" : "28px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: isMobile ? 22 : 18, letterSpacing: "-0.3px", color: "#fff" }}>📦 WMS</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>ระบบจัดการคลังสินค้า</div>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "white", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        )}
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button key={item.key} onClick={() => handleNavClick(item.key)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: isMobile ? "16px 24px" : "13px 20px", background: isActive ? "linear-gradient(90deg, rgba(34,197,94,0.22) 0%, rgba(34,197,94,0.06) 100%)" : "transparent", border: "none", borderLeft: isActive ? "3px solid #22c55e" : "3px solid transparent", color: isActive ? "#4ade80" : "rgba(255,255,255,0.65)", cursor: "pointer", textAlign: "left", fontSize: isMobile ? 16 : 14, fontWeight: isActive ? 700 : 400, transition: "all 0.15s ease", borderRadius: "0 8px 8px 0", marginRight: 8 }}>
              <span style={{ fontSize: isMobile ? 22 : 18, flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
              {isActive && <span style={{ marginLeft: "auto", fontSize: 14, opacity: 0.6 }}>›</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>WMS v1.0 · {new Date().getFullYear()}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f4f7f4" }}>
      <ToastContainer />

      {!isMobile && (
        <div style={{ width: SIDEBAR_W, flexShrink: 0, height: "100vh", position: "sticky", top: 0, boxShadow: "2px 0 16px rgba(0,0,0,0.12)", zIndex: 100 }}>
          {sidebarContent}
        </div>
      )}

      {isMobile && sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 400, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
          <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 500, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)" }}>
            {sidebarContent}
          </div>
        </>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {isMobile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "linear-gradient(135deg, #1a2e1c 0%, #16251a 100%)", boxShadow: "0 2px 12px rgba(0,0,0,0.15)", flexShrink: 0, zIndex: 10 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }} aria-label="เปิดเมนู">
              <div style={{ width: 20, height: 2, background: "white", borderRadius: 1 }} />
              <div style={{ width: 16, height: 2, background: "white", borderRadius: 1 }} />
              <div style={{ width: 20, height: 2, background: "white", borderRadius: 1 }} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{activeItem.icon}</span>
              <span style={{ color: "white", fontWeight: 700, fontSize: 16 }}>{activeItem.label}</span>
            </div>
            <div style={{ width: 44 }} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "24px" }}>
          <ActiveComponent />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .form-grid { display: flex !important; flex-direction: column !important; gap: 16px !important; }
          .module-panel { padding: 0 !important; }
          .card { border-radius: 16px !important; }
          .module-header h2 { font-size: 20px !important; }
          .module-header p { font-size: 13px !important; margin-bottom: 12px !important; }
          .module-tabs { gap: 6px !important; overflow-x: auto; flex-wrap: nowrap !important; padding-bottom: 4px; }
          .tab { font-size: 13px !important; padding: 8px 14px !important; white-space: nowrap; flex-shrink: 0; }
          .section-header { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
          table { font-size: 13px !important; }
          .btn { font-size: 14px !important; }
          .card-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
        }
        .mobile-stack { display: flex; flex-direction: column; gap: 16px; }
      `}</style>
    </div>
  );
}
