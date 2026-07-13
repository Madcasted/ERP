"use client";

import React, { useEffect, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("th-TH");

type ChartData = {
  range: string;
  revenueByMonth: { label: string; value: number }[];
  productsByMonth: { label: string; value: number }[];
  customersByMonth: { label: string; value: number }[];
  materialsByMonth: { label: string; value: number }[];
  orderStatusCounts: Record<string, number>;
  orderStatusRevenue: Record<string, number>;
  summary: {
    totalRevenue: number;
    totalProducts: number;
    totalCustomers: number;
    totalMaterials: number;
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalGoodPcs: number;
    totalDefectPcs: number;
  };
  period: { start: string; end: string; months: number };
};

type Props = {
  timeRange: "month" | "quarter" | "year";
};

const COLORS = {
  green: "#2c9e6e",
  blue: "#2563eb",
  amber: "#f59e0b",
  purple: "#7c3aed",
  red: "#ef4444",
  teal: "#0d9488",
  pink: "#ec4899",
  orange: "#f97316",
  gray: "#94a3b8",
  lightGreen: "rgba(44,158,110,0.12)",
  lightBlue: "rgba(37,99,235,0.12)",
  lightAmber: "rgba(245,158,11,0.12)",
  lightPurple: "rgba(124,58,237,0.12)",
};

export default function DashboardCharts({ timeRange }: Props) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/charts?range=${timeRange}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [timeRange]);

  if (loading) {
    return (
      <div className="dashboard-charts-loading">
        <div className="spinner" />
        <span>กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="dashboard-charts-loading">ไม่สามารถโหลดข้อมูลได้</div>;
  }

  const { revenueByMonth, productsByMonth, customersByMonth, materialsByMonth, orderStatusCounts, orderStatusRevenue, summary } = data;

  // ---- Revenue Line Chart ----
  const maxRevenue = Math.max(...revenueByMonth.map((d) => d.value), 1);
  const lineChartHeight = 200;
  const lineChartWidth = 500;
  const linePadding = { top: 20, right: 20, bottom: 40, left: 60 };
  const lineInnerW = lineChartWidth - linePadding.left - linePadding.right;
  const lineInnerH = lineChartHeight - linePadding.top - linePadding.bottom;

  const linePoints = revenueByMonth.map((d, i) => {
    const x = linePadding.left + (i / Math.max(revenueByMonth.length - 1, 1)) * lineInnerW;
    const y = linePadding.top + lineInnerH - (d.value / maxRevenue) * lineInnerH;
    return { x, y, ...d };
  });

  const linePathD = linePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPathD = `${linePathD} L ${linePoints[linePoints.length - 1]?.x ?? linePadding.left} ${linePadding.top + lineInnerH} L ${linePoints[0]?.x ?? linePadding.left} ${linePadding.top + lineInnerH} Z`;

  // Y-axis ticks
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxRevenue / yTicks) * i);

  // ---- Bar Chart (Products, Customers, Materials) ----
  const barGroups = productsByMonth.map((p, i) => ({
    label: p.label,
    products: p.value,
    customers: customersByMonth[i]?.value ?? 0,
    materials: materialsByMonth[i]?.value ?? 0,
  }));
  const maxBar = Math.max(...barGroups.flatMap((g) => [g.products, g.customers, g.materials]), 1);
  const barChartHeight = 200;
  const barChartWidth = 500;
  const barPadding = { top: 20, right: 20, bottom: 40, left: 50 };
  const barInnerW = barChartWidth - barPadding.left - barPadding.right;
  const barInnerH = barChartHeight - barPadding.top - barPadding.bottom;
  const groupWidth = barInnerW / Math.max(barGroups.length, 1);
  const barWidth = Math.min(groupWidth * 0.22, 20);

  // ---- Donut Chart (Order Status) ----
  const statusLabels: Record<string, string> = {
    PENDING: "รอยืนยัน",
    CONFIRMED: "ยืนยันแล้ว",
    DELIVERED: "สำเร็จ",
    CANCELLED: "ยกเลิก",
  };
  const statusColors: Record<string, string> = {
    PENDING: COLORS.amber,
    CONFIRMED: COLORS.blue,
    DELIVERED: COLORS.green,
    CANCELLED: COLORS.red,
  };
  const statusTotal = Object.values(orderStatusCounts).reduce((s, v) => s + v, 0) || 1;
  const donutRadius = 70;
  const donutStroke = 28;
  const donutCirc = 2 * Math.PI * donutRadius;
  let donutOffset = 0;
  const donutSegments = Object.entries(orderStatusCounts).map(([key, value]) => {
    const pct = value / statusTotal;
    const length = pct * donutCirc;
    const seg = { key, label: statusLabels[key] || key, value, pct, color: statusColors[key] || COLORS.gray, offset: donutOffset, length };
    donutOffset += length;
    return seg;
  });

  // ---- Production Quality Mini Chart ----
  const totalPcs = summary.totalGoodPcs + summary.totalDefectPcs || 1;
  const goodPct = (summary.totalGoodPcs / totalPcs) * 100;
  const defectPct = (summary.totalDefectPcs / totalPcs) * 100;

  return (
    <div className="dashboard-charts-container">
      {/* Row 1: Revenue Line Chart + Donut */}
      <div className="dashboard-charts-row">
        <div className="dashboard-chart-box wide">
          <div className="chart-box-header">
            <div>
              <h4>รายได้ตามช่วงเวลา</h4>
              <p>รายได้จากคำสั่งซื้อที่สำเร็จแล้ว</p>
            </div>
            <div className="chart-box-total">
              <span className="chart-total-label">รวม</span>
              <strong className="chart-total-value">{currencyFormatter.format(summary.totalRevenue)}</strong>
            </div>
          </div>
          <svg viewBox={`0 0 ${lineChartWidth} ${lineChartHeight}`} className="chart-svg" role="img" aria-label="Revenue line chart">
            {/* Grid lines */}
            {yTickValues.map((v, i) => {
              const y = linePadding.top + lineInnerH - (v / maxRevenue) * lineInnerH;
              return (
                <g key={i}>
                  <line x1={linePadding.left} y1={y} x2={lineChartWidth - linePadding.right} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <text x={linePadding.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{currencyFormatter.format(v)}</text>
                </g>
              );
            })}
            {/* Area fill */}
            <path d={areaPathD} fill="url(#revenueGradient)" opacity="0.3" />
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity="0.4" />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Line */}
            <path d={linePathD} fill="none" stroke={COLORS.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* Dots */}
            {linePoints.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={COLORS.green} strokeWidth="2.5" />
                <title>{`${p.label}: ${currencyFormatter.format(p.value)}`}</title>
              </g>
            ))}
            {/* X-axis labels */}
            {linePoints.map((p, i) => (
              <text key={i} x={p.x} y={lineChartHeight - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">
                {p.label}
              </text>
            ))}
          </svg>
        </div>

        <div className="dashboard-chart-box">
          <div className="chart-box-header">
            <div>
              <h4>สถานะคำสั่งซื้อ</h4>
              <p>ทั้งหมด {numberFormatter.format(statusTotal)} ออเดอร์</p>
            </div>
          </div>
          <div className="donut-container">
            <svg viewBox="0 0 200 200" className="chart-svg donut-svg">
              {donutSegments.map((seg) => (
                <circle
                  key={seg.key}
                  cx="100"
                  cy="100"
                  r={donutRadius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={donutStroke}
                  strokeDasharray={`${seg.length} ${donutCirc - seg.length}`}
                  strokeDashoffset={-seg.offset}
                  transform="rotate(-90 100 100)"
                  strokeLinecap="round"
                  className="donut-segment"
                />
              ))}
              <text x="100" y="94" textAnchor="middle" fill="var(--dark)" fontSize="22" fontWeight="700">
                {statusTotal}
              </text>
              <text x="100" y="112" textAnchor="middle" fill="#94a3b8" fontSize="10">
                ออเดอร์
              </text>
            </svg>
            <div className="donut-legend">
              {donutSegments.map((seg) => (
                <div key={seg.key} className="donut-legend-item">
                  <span className="donut-dot" style={{ background: seg.color }} />
                  <span className="donut-label">{seg.label}</span>
                  <span className="donut-value">{numberFormatter.format(seg.value)}</span>
                  <span className="donut-pct">({Math.round(seg.pct * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Bar Chart + Production Quality */}
      <div className="dashboard-charts-row">
        <div className="dashboard-chart-box wide">
          <div className="chart-box-header">
            <div>
              <h4>สินค้า ลูกค้า และวัสดุใหม่</h4>
              <p>จำนวนที่เพิ่มขึ้นในแต่ละเดือน</p>
            </div>
          </div>
          <svg viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} className="chart-svg" role="img" aria-label="Growth bar chart">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = barPadding.top + barInnerH - pct * barInnerH;
              return (
                <g key={i}>
                  <line x1={barPadding.left} y1={y} x2={barChartWidth - barPadding.right} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <text x={barPadding.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{Math.round(pct * maxBar)}</text>
                </g>
              );
            })}
            {/* Bars */}
            {barGroups.map((g, gi) => {
              const gx = barPadding.left + gi * groupWidth;
              const barH1 = (g.products / maxBar) * barInnerH;
              const barH2 = (g.customers / maxBar) * barInnerH;
              const barH3 = (g.materials / maxBar) * barInnerH;
              return (
                <g key={gi}>
                  <rect x={gx + groupWidth * 0.08} y={barPadding.top + barInnerH - barH1} width={barWidth} height={barH1} rx="4" fill={COLORS.green} opacity="0.85">
                    <title>{`สินค้า: ${g.products}`}</title>
                  </rect>
                  <rect x={gx + groupWidth * 0.08 + barWidth + 2} y={barPadding.top + barInnerH - barH2} width={barWidth} height={barH2} rx="4" fill={COLORS.blue} opacity="0.85">
                    <title>{`ลูกค้า: ${g.customers}`}</title>
                  </rect>
                  <rect x={gx + groupWidth * 0.08 + (barWidth + 2) * 2} y={barPadding.top + barInnerH - barH3} width={barWidth} height={barH3} rx="4" fill={COLORS.amber} opacity="0.85">
                    <title>{`วัสดุ: ${g.materials}`}</title>
                  </rect>
                  <text x={gx + groupWidth * 0.5} y={barChartHeight - 8} textAnchor="middle" fill="#94a3b8" fontSize="9">{g.label}</text>
                </g>
              );
            })}
            {/* Legend */}
            <g transform={`translate(${barPadding.left}, 4)`}>
              <rect x="0" y="0" width="10" height="10" rx="2" fill={COLORS.green} />
              <text x="14" y="9" fill="#64748b" fontSize="10">สินค้า</text>
              <rect x="60" y="0" width="10" height="10" rx="2" fill={COLORS.blue} />
              <text x="74" y="9" fill="#64748b" fontSize="10">ลูกค้า</text>
              <rect x="120" y="0" width="10" height="10" rx="2" fill={COLORS.amber} />
              <text x="134" y="9" fill="#64748b" fontSize="10">วัสดุ</text>
            </g>
          </svg>
        </div>

        <div className="dashboard-chart-box">
          <div className="chart-box-header">
            <div>
              <h4>คุณภาพการผลิต</h4>
              <p>จากเครื่องจักรในระบบ</p>
            </div>
          </div>
          <div className="quality-container">
            <div className="quality-big-ring">
              <svg viewBox="0 0 160 160" className="chart-svg">
                <circle cx="80" cy="80" r="60" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                <circle
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  stroke={COLORS.green}
                  strokeWidth="20"
                  strokeDasharray={`${(goodPct / 100) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`}
                  transform="rotate(-90 80 80)"
                  strokeLinecap="round"
                />
                <text x="80" y="74" textAnchor="middle" fill="var(--dark)" fontSize="24" fontWeight="700">{numberFormatter.format(summary.totalGoodPcs)}</text>
                <text x="80" y="92" textAnchor="middle" fill="#94a3b8" fontSize="10">ชิ้นดี</text>
              </svg>
            </div>
            <div className="quality-stats">
              <div className="quality-stat-item good">
                <span className="quality-dot" />
                <span>ชิ้นดี</span>
                <strong>{numberFormatter.format(summary.totalGoodPcs)}</strong>
                <small>({Math.round(goodPct)}%)</small>
              </div>
              <div className="quality-stat-item defect">
                <span className="quality-dot" />
                <span>ชิ้นเสีย</span>
                <strong>{numberFormatter.format(summary.totalDefectPcs)}</strong>
                <small>({Math.round(defectPct)}%)</small>
              </div>
              <div className="quality-stat-bar">
                <div className="quality-bar-track">
                  <div className="quality-bar-fill good" style={{ width: `${goodPct}%` }} />
                  <div className="quality-bar-fill defect" style={{ width: `${defectPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Summary KPI Cards for the period */}
      <div className="dashboard-charts-kpi-row">
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightGreen, color: COLORS.green }}>
            <i className="bx bxs-package" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">สินค้าใหม่</span>
            <strong className="kpi-value">{numberFormatter.format(summary.totalProducts)}</strong>
          </div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightBlue, color: COLORS.blue }}>
            <i className="bx bxs-user-detail" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">ลูกค้าใหม่</span>
            <strong className="kpi-value">{numberFormatter.format(summary.totalCustomers)}</strong>
          </div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightAmber, color: COLORS.amber }}>
            <i className="bx bxs-wrench" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">รับวัสดุ</span>
            <strong className="kpi-value">{numberFormatter.format(summary.totalMaterials)}</strong>
          </div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightPurple, color: COLORS.purple }}>
            <i className="bx bxs-cart-alt" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">ออเดอร์ทั้งหมด</span>
            <strong className="kpi-value">{numberFormatter.format(summary.totalOrders)}</strong>
          </div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: "rgba(239,68,68,0.12)", color: COLORS.red }}>
            <i className="bx bxs-x-circle" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">ยกเลิก</span>
            <strong className="kpi-value">{numberFormatter.format(summary.cancelledOrders)}</strong>
          </div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: "rgba(13,148,136,0.12)", color: COLORS.teal }}>
            <i className="bx bxs-check-circle" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">สำเร็จ</span>
            <strong className="kpi-value">{numberFormatter.format(summary.deliveredOrders)}</strong>
          </div>
        </div>
      </div>

      {/* Row 4: Numbers View (time-sensitive) */}
      <div className="dashboard-chart-box">
        <div className="chart-box-header">
          <div>
            <h4>รายงานตัวเลข ({timeRange === "month" ? "รายเดือน" : timeRange === "quarter" ? "รายไตรมาส" : "รายปี"})</h4>
            <p>ข้อมูลสรุปตามช่วงเวลาที่เลือก</p>
          </div>
        </div>
        <div className="dashboard-report-list">
          <div className="dashboard-report-row">
            <span>รายได้รวม</span>
            <strong>{currencyFormatter.format(summary.totalRevenue)}</strong>
          </div>
          <div className="dashboard-report-row">
            <span>สินค้าใหม่ในระบบ</span>
            <strong>{summary.totalProducts} รายการ</strong>
          </div>
          <div className="dashboard-report-row">
            <span>ลูกค้าใหม่</span>
            <strong>{summary.totalCustomers} ราย</strong>
          </div>
          <div className="dashboard-report-row">
            <span>รับวัสดุเข้า</span>
            <strong>{summary.totalMaterials} รายการ</strong>
          </div>
          <div className="dashboard-report-row">
            <span>คำสั่งซื้อทั้งหมด</span>
            <strong>{summary.totalOrders} ออเดอร์</strong>
          </div>
          <div className="dashboard-report-row">
            <span>รอยืนยัน</span>
            <strong>{summary.pendingOrders} ออเดอร์</strong>
          </div>
          <div className="dashboard-report-row">
            <span>ยืนยันแล้ว</span>
            <strong>{summary.confirmedOrders} ออเดอร์</strong>
          </div>
          <div className="dashboard-report-row">
            <span>สำเร็จ</span>
            <strong>{summary.deliveredOrders} ออเดอร์</strong>
          </div>
          <div className="dashboard-report-row">
            <span>ยกเลิก</span>
            <strong>{summary.cancelledOrders} ออเดอร์</strong>
          </div>
          <div className="dashboard-report-row">
            <span>ชิ้นดีจากการผลิต</span>
            <strong>{numberFormatter.format(summary.totalGoodPcs)} ชิ้น</strong>
          </div>
          <div className="dashboard-report-row">
            <span>ชิ้นเสียจากการผลิต</span>
            <strong>{numberFormatter.format(summary.totalDefectPcs)} ชิ้น</strong>
          </div>
        </div>
      </div>
    </div>
  );
}