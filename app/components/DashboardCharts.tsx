"use client";

import React, { useEffect, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("th-TH");

// ─── Types ───────────────────────────────────────────────────────────

type ChartData = {
  range: string;
  materialCostByMonth: { label: string; value: number }[];
  productsByMonth: { label: string; value: number }[];
  materialsByMonth: { label: string; value: number }[];
  summary: {
    periodMaterialCost: number;
    totalMaterialCostAll: number;
    totalProducts: number;
    totalMachines?: number;
    totalMaterialReceipts: number;
    totalGoodPcs: number;
    totalDefectPcs: number;
  };
  period: { start: string; end: string; points: number };
};

type ManHourJob = {
  id: string;
  name: string;
  orderNumber: string;
  targetHours: number;
  status: "active" | "done";
  createdAt: string;
};

type Props = {
  timeRange: "month" | "quarter" | "year";
  view?: "graph" | "numbers";
};

const COLORS = {
  green: "#2c9e6e",
  blue: "#2563eb",
  amber: "#f59e0b",
  purple: "#7c3aed",
  red: "#ef4444",
  teal: "#0d9488",
  gray: "#94a3b8",
  lightGreen: "rgba(44,158,110,0.12)",
  lightBlue: "rgba(37,99,235,0.12)",
  lightAmber: "rgba(245,158,11,0.12)",
  lightPurple: "rgba(124,58,237,0.12)",
};

// สถานะงาน Man Hour อยู่ใน localStorage ของฝั่งลูกค้า (CustomerView.tsx) ไม่มีใน DB
function readManHourJobs(): ManHourJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("customer_manhour_jobs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// เส้นโค้งนุ่ม ๆ แทนเส้นตรงหักมุม ให้กราฟดูพรีเมียมขึ้น
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function DashboardCharts({ timeRange, view = "graph" }: Props) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<ManHourJob[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/charts?range=${timeRange}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [timeRange]);

  useEffect(() => {
    setJobs(readManHourJobs());
    const refresh = () => setJobs(readManHourJobs());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="dashboard-charts-loading">
        <div className="spinner" />
        <span>กำลังโหลดข้อมูล...</span>
      </div>
    );
  }
  if (!data) return <div className="dashboard-charts-loading">ไม่สามารถโหลดข้อมูลได้</div>;

  const { materialCostByMonth, productsByMonth, materialsByMonth, summary } = data;

  const chartTitle =
    timeRange === "month" ? "ค่าใช้จ่ายวัสดุรายวัน (เดือนนี้)"
    : timeRange === "quarter" ? "ค่าใช้จ่ายวัสดุรายเดือน (ไตรมาสนี้)"
    : "ค่าใช้จ่ายวัสดุรายเดือน (ปีนี้)";

  // ---- Cost line chart ----
  const maxCost = Math.max(...materialCostByMonth.map((d) => d.value), 1);
  const lcH = 220, lcW = 560;
  const lp = { top: 24, right: 20, bottom: 34, left: 68 };
  const innerW = lcW - lp.left - lp.right;
  const innerH = lcH - lp.top - lp.bottom;

  const linePoints = materialCostByMonth.map((d, i) => ({
    x: lp.left + (i / Math.max(materialCostByMonth.length - 1, 1)) * innerW,
    y: lp.top + innerH - (d.value / maxCost) * innerH,
    ...d,
  }));
  const linePathD = smoothPath(linePoints);
  const areaPathD = `${linePathD} L ${linePoints[linePoints.length - 1]?.x ?? lp.left} ${lp.top + innerH} L ${linePoints[0]?.x ?? lp.left} ${lp.top + innerH} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxCost / yTicks) * i);
  const lastVal = materialCostByMonth[materialCostByMonth.length - 1]?.value ?? 0;
  const prevVal = materialCostByMonth[materialCostByMonth.length - 2]?.value ?? 0;
  const changePct = prevVal > 0 ? Math.round(((lastVal - prevVal) / prevVal) * 100) : null;
  const labelStep = Math.max(1, Math.ceil(linePoints.length / 10));

  // ---- Growth bar chart (สินค้าใหม่ vs ใบรับวัสดุใหม่) ----
  const barGroups = productsByMonth.map((p, i) => ({
    label: p.label,
    products: p.value,
    materials: materialsByMonth[i]?.value ?? 0,
  }));
  const maxBar = Math.max(...barGroups.flatMap((g) => [g.products, g.materials]), 1);
  const bcH = 200, bcW = 500;
  const bp = { top: 20, right: 20, bottom: 34, left: 44 };
  const bInnerW = bcW - bp.left - bp.right;
  const bInnerH = bcH - bp.top - bp.bottom;
  const groupWidth = bInnerW / Math.max(barGroups.length, 1);
  const barWidth = Math.min(groupWidth * 0.3, 20);
  const barLabelStep = Math.max(1, Math.ceil(barGroups.length / 8));

  // ---- Job status donut (จากหน้า Man Hour) ----
  const activeJobs = jobs.filter((j) => j.status === "active");
  const doneJobs = jobs.filter((j) => j.status === "done");
  const jobTotal = jobs.length || 1;
  const jr = 70, jStroke = 28, jCirc = 2 * Math.PI * jr;
  const jobSegments = [
    { key: "active", label: "กำลังทำ", value: activeJobs.length, color: COLORS.amber },
    { key: "done", label: "เสร็จแล้ว", value: doneJobs.length, color: COLORS.green },
  ].reduce<{ key: string; label: string; value: number; color: string; pct: number; offset: number; length: number }[]>((acc, seg) => {
    const pct = seg.value / jobTotal;
    const length = pct * jCirc;
    const offset = acc.reduce((s, a) => s + a.length, 0);
    acc.push({ ...seg, pct, offset, length });
    return acc;
  }, []);

  // ---- Production quality ----
  const totalPcs = summary.totalGoodPcs + summary.totalDefectPcs || 1;
  const goodPct = (summary.totalGoodPcs / totalPcs) * 100;
  const defectPct = (summary.totalDefectPcs / totalPcs) * 100;

  const periodLabel = timeRange === "month" ? "รายเดือน" : timeRange === "quarter" ? "รายไตรมาส" : "รายปี";

  // ═══════════════════ NUMBERS VIEW ═══════════════════
  if (view === "numbers") {
    const businessMetrics = [
      { label: "สินค้าใหม่", value: `${numberFormatter.format(summary.totalProducts)} รายการ`, icon: "bx bxs-package", accent: COLORS.lightAmber, color: COLORS.amber, note: "ในช่วงเวลานี้" },
      { label: "ใบรับวัสดุ", value: `${numberFormatter.format(summary.totalMaterialReceipts)} ใบ`, icon: "bx bxs-wrench", accent: "rgba(14,116,144,0.12)", color: COLORS.teal, note: "สะสมทั้งหมด" },
      { label: "เครื่องจักร", value: `${numberFormatter.format(summary.totalMachines ?? 0)} เครื่อง`, icon: "bx bxs-cog", accent: COLORS.lightBlue, color: COLORS.blue, note: "ในโรงงาน" },
      { label: "คุณภาพผลิต", value: `${Math.round(goodPct)}% ชิ้นดี`, icon: "bx bxs-check-circle", accent: "rgba(16,185,129,0.12)", color: COLORS.green, note: `${numberFormatter.format(summary.totalGoodPcs)} ชิ้นดี` },
    ];

    return (
      <div className="dashboard-charts-container">
        <div className="dashboard-chart-box">
          <div className="chart-box-header">
            <div>
              <h4>รายงานตัวเลขธุรกิจ</h4>
              <p>สรุปข้อมูลสำคัญในช่วง {periodLabel}</p>
            </div>
            <span className="chip chip-success">{timeRange === "month" ? "ช่วงสั้น" : timeRange === "quarter" ? "ช่วงกลาง" : "ช่วงยาว"}</span>
          </div>

          <div className="dashboard-business-hero">
            <div>
              <p className="dashboard-eyebrow">Executive summary</p>
              <h4>ภาพรวมต้นทุนและการดำเนินงานที่สื่อสารได้ทันที</h4>
              <p>มองเห็นค่าใช้จ่ายวัสดุ งานที่กำลังดำเนินการ สินค้า และคุณภาพการผลิตในมุมมองที่ทำงานได้จริงสำหรับทีมบริหาร</p>
              <div className="dashboard-business-badges">
                <span className="chip chip-success">{doneJobs.length} งานเสร็จแล้ว</span>
                <span className="chip">{activeJobs.length} งานกำลังทำ</span>
                <span className="chip">คุณภาพ {Math.round(goodPct)}%</span>
              </div>
            </div>
            <div className="dashboard-business-highlight">
              <span>ค่าใช้จ่ายวัสดุ ({periodLabel})</span>
              <strong>{currencyFormatter.format(summary.periodMaterialCost)}</strong>
              <small>สะสมทั้งหมด {currencyFormatter.format(summary.totalMaterialCostAll)}</small>
            </div>
          </div>

          <div className="dashboard-business-grid">
            {businessMetrics.map((metric) => (
              <div key={metric.label} className="dashboard-business-card">
                <div className="dashboard-business-icon" style={{ background: metric.accent, color: metric.color }}>
                  <i className={metric.icon} />
                </div>
                <div>
                  <p className="dashboard-business-label">{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="dashboard-business-analytics">
            <div className="dashboard-status-panel">
              <div className="dashboard-status-panel-header">
                <h5>สถานะงาน (Man Hour)</h5>
                <span className="dashboard-status-pill">{jobs.length} งานทั้งหมด</span>
              </div>
              <div className="dashboard-status-list">
                <div className="dashboard-status-row amber">
                  <span>กำลังทำ</span>
                  <strong>{activeJobs.length} งาน</strong>
                </div>
                <div className="dashboard-status-row green">
                  <span>เสร็จแล้ว</span>
                  <strong>{doneJobs.length} งาน</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-status-panel">
              <div className="dashboard-status-panel-header">
                <h5>คุณภาพการผลิต</h5>
                <span className="dashboard-status-pill success">{Math.round(goodPct)}% ชิ้นดี</span>
              </div>
              <div className="dashboard-quality-card">
                <div className="dashboard-quality-ring">
                  <span>{Math.round(goodPct)}%</span>
                </div>
                <div className="dashboard-quality-meta">
                  <div className="dashboard-quality-row">
                    <span>ชิ้นดี</span>
                    <strong>{numberFormatter.format(summary.totalGoodPcs)}</strong>
                  </div>
                  <div className="dashboard-quality-row">
                    <span>ชิ้นเสีย</span>
                    <strong>{numberFormatter.format(summary.totalDefectPcs)}</strong>
                  </div>
                  <div className="dashboard-quality-track">
                    <div className="dashboard-quality-fill good" style={{ width: `${goodPct}%` }} />
                    <div className="dashboard-quality-fill defect" style={{ width: `${defectPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════ GRAPH VIEW ═══════════════════
  return (
    <div className="dashboard-charts-container">
      {/* Row 1: Material Cost Line Chart + Job Status Donut */}
      <div className="dashboard-charts-row">
        <div className="dashboard-chart-box wide">
          <div className="chart-box-header">
            <div>
              <h4>{chartTitle}</h4>
              <p>ต้นทุนวัสดุจากใบรับวัสดุ (น้ำหนัก × ราคาต่อหน่วย)</p>
            </div>
            <div className="chart-box-total">
              <span className="chart-total-label">รวมช่วงนี้</span>
              <strong className="chart-total-value">{currencyFormatter.format(summary.periodMaterialCost)}</strong>
              {changePct !== null && (
                <span className={`chart-trend-badge ${changePct >= 0 ? "up" : "down"}`}>
                  <i className={`bx ${changePct >= 0 ? "bx-trending-up" : "bx-trending-down"}`} />
                  {Math.abs(changePct)}%
                </span>
              )}
            </div>
          </div>
          <svg viewBox={`0 0 ${lcW} ${lcH}`} className="chart-svg" role="img" aria-label="Material cost chart">
            {yTickValues.map((v, i) => {
              const y = lp.top + innerH - (v / maxCost) * innerH;
              return (
                <g key={i}>
                  <line x1={lp.left} y1={y} x2={lcW - lp.right} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <text x={lp.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{currencyFormatter.format(v)}</text>
                </g>
              );
            })}
            <path d={areaPathD} fill="url(#costGradient)" opacity="0.35" />
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity="0.45" />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={linePathD} fill="none" stroke={COLORS.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {linePoints.map((p, i) => (
              <g key={i}>
                {(i === linePoints.length - 1 || i % Math.max(1, Math.ceil(linePoints.length / 12)) === 0) && (
                  <circle cx={p.x} cy={p.y} r={i === linePoints.length - 1 ? 5.5 : 4} fill="white" stroke={COLORS.green} strokeWidth="2.5" />
                )}
                <title>{`${p.label}: ${currencyFormatter.format(p.value)}`}</title>
              </g>
            ))}
            {linePoints.map((p, i) => (
              (i % labelStep === 0 || i === linePoints.length - 1) && (
                <text key={i} x={p.x} y={lcH - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">{p.label}</text>
              )
            ))}
          </svg>
        </div>

        <div className="dashboard-chart-box">
          <div className="chart-box-header">
            <div>
              <h4>สถานะงาน (Man Hour)</h4>
              <p>ทั้งหมด {numberFormatter.format(jobs.length)} งาน</p>
            </div>
          </div>
          <div className="donut-container">
            {jobs.length === 0 ? (
              <div className="dashboard-empty-hint">ยังไม่มีงานในระบบ Man Hour</div>
            ) : (
              <>
                <svg viewBox="0 0 200 200" className="chart-svg donut-svg">
                  {jobSegments.map((seg) => (
                    <circle
                      key={seg.key} cx="100" cy="100" r={jr} fill="none" stroke={seg.color}
                      strokeWidth={jStroke}
                      strokeDasharray={`${seg.length} ${jCirc - seg.length}`}
                      strokeDashoffset={-seg.offset}
                      transform="rotate(-90 100 100)"
                      strokeLinecap="round"
                      className="donut-segment"
                    />
                  ))}
                  <text x="100" y="94" textAnchor="middle" fill="var(--dark)" fontSize="22" fontWeight="700">{jobs.length}</text>
                  <text x="100" y="112" textAnchor="middle" fill="#94a3b8" fontSize="10">งาน</text>
                </svg>
                <div className="donut-legend">
                  {jobSegments.map((seg) => (
                    <div key={seg.key} className="donut-legend-item">
                      <span className="donut-dot" style={{ background: seg.color }} />
                      <span className="donut-label">{seg.label}</span>
                      <span className="donut-value">{numberFormatter.format(seg.value)}</span>
                      <span className="donut-pct">({Math.round(seg.pct * 100)}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Growth Bar Chart + Production Quality */}
      <div className="dashboard-charts-row">
        <div className="dashboard-chart-box wide">
          <div className="chart-box-header">
            <div>
              <h4>สินค้าและใบรับวัสดุใหม่</h4>
              <p>จำนวนที่เพิ่มขึ้นในแต่ละช่วง</p>
            </div>
          </div>
          <svg viewBox={`0 0 ${bcW} ${bcH}`} className="chart-svg" role="img" aria-label="Growth bar chart">
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = bp.top + bInnerH - pct * bInnerH;
              return (
                <g key={i}>
                  <line x1={bp.left} y1={y} x2={bcW - bp.right} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <text x={bp.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{Math.round(pct * maxBar)}</text>
                </g>
              );
            })}
            {barGroups.map((g, gi) => {
              const gx = bp.left + gi * groupWidth;
              const h1 = (g.products / maxBar) * bInnerH;
              const h2 = (g.materials / maxBar) * bInnerH;
              return (
                <g key={gi}>
                  <rect x={gx + groupWidth * 0.18} y={bp.top + bInnerH - h1} width={barWidth} height={h1} rx="4" fill={COLORS.green} opacity="0.85"><title>{`สินค้า: ${g.products}`}</title></rect>
                  <rect x={gx + groupWidth * 0.18 + barWidth + 3} y={bp.top + bInnerH - h2} width={barWidth} height={h2} rx="4" fill={COLORS.amber} opacity="0.85"><title>{`ใบรับวัสดุ: ${g.materials}`}</title></rect>
                  {(gi % barLabelStep === 0 || gi === barGroups.length - 1) && (
                    <text x={gx + groupWidth * 0.5} y={bcH - 8} textAnchor="middle" fill="#94a3b8" fontSize="9">{g.label}</text>
                  )}
                </g>
              );
            })}
            <g transform={`translate(${bp.left}, 4)`}>
              <rect x="0" y="0" width="10" height="10" rx="2" fill={COLORS.green} />
              <text x="14" y="9" fill="#64748b" fontSize="10">สินค้า</text>
              <rect x="80" y="0" width="10" height="10" rx="2" fill={COLORS.amber} />
              <text x="94" y="9" fill="#64748b" fontSize="10">ใบรับวัสดุ</text>
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
                  cx="80" cy="80" r="60" fill="none" stroke={COLORS.green} strokeWidth="20"
                  strokeDasharray={`${(goodPct / 100) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`}
                  transform="rotate(-90 80 80)" strokeLinecap="round"
                />
                <text x="80" y="74" textAnchor="middle" fill="var(--dark)" fontSize="24" fontWeight="700">{numberFormatter.format(summary.totalGoodPcs)}</text>
                <text x="80" y="92" textAnchor="middle" fill="#94a3b8" fontSize="10">ชิ้นดี</text>
              </svg>
            </div>
            <div className="quality-stats">
              <div className="quality-stat-item good">
                <span className="quality-dot" /><span>ชิ้นดี</span>
                <strong>{numberFormatter.format(summary.totalGoodPcs)}</strong>
                <small>({Math.round(goodPct)}%)</small>
              </div>
              <div className="quality-stat-item defect">
                <span className="quality-dot" /><span>ชิ้นเสีย</span>
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

      {/* Row 3: KPI mini cards */}
      <div className="dashboard-charts-kpi-row">
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightGreen, color: COLORS.green }}><i className="bx bxs-package" /></div>
          <div className="kpi-info"><span className="kpi-label">สินค้าใหม่</span><strong className="kpi-value">{numberFormatter.format(summary.totalProducts)}</strong></div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightAmber, color: COLORS.amber }}><i className="bx bxs-wrench" /></div>
          <div className="kpi-info"><span className="kpi-label">ใบรับวัสดุ</span><strong className="kpi-value">{numberFormatter.format(summary.totalMaterialReceipts)}</strong></div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightBlue, color: COLORS.blue }}><i className="bx bxs-cog" /></div>
          <div className="kpi-info"><span className="kpi-label">เครื่องจักร</span><strong className="kpi-value">{numberFormatter.format(summary.totalMachines ?? 0)}</strong></div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: COLORS.lightPurple, color: COLORS.purple }}><i className="bx bxs-briefcase" /></div>
          <div className="kpi-info"><span className="kpi-label">งานกำลังทำ</span><strong className="kpi-value">{numberFormatter.format(activeJobs.length)}</strong></div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: "rgba(13,148,136,0.12)", color: COLORS.teal }}><i className="bx bxs-check-circle" /></div>
          <div className="kpi-info"><span className="kpi-label">งานเสร็จแล้ว</span><strong className="kpi-value">{numberFormatter.format(doneJobs.length)}</strong></div>
        </div>
        <div className="kpi-mini-card">
          <div className="kpi-icon" style={{ background: "rgba(239,68,68,0.12)", color: COLORS.red }}><i className="bx bxs-wallet" /></div>
          <div className="kpi-info"><span className="kpi-label">ค่าใช้จ่ายวัสดุรวม</span><strong className="kpi-value">{currencyFormatter.format(summary.totalMaterialCostAll)}</strong></div>
        </div>
      </div>

      {/* Row 4: Numbers summary */}
      <div className="dashboard-chart-box">
        <div className="chart-box-header">
          <div>
            <h4>รายงานตัวเลข ({periodLabel})</h4>
            <p>ข้อมูลสรุปตามช่วงเวลาที่เลือก</p>
          </div>
        </div>
        <div className="dashboard-report-list">
          <div className="dashboard-report-row"><span>ค่าใช้จ่ายวัสดุช่วงนี้</span><strong>{currencyFormatter.format(summary.periodMaterialCost)}</strong></div>
          <div className="dashboard-report-row"><span>สินค้าใหม่ในระบบ</span><strong>{summary.totalProducts} รายการ</strong></div>
          <div className="dashboard-report-row"><span>ใบรับวัสดุใหม่</span><strong>{materialsByMonth.reduce((s, m) => s + m.value, 0)} ใบ</strong></div>
          <div className="dashboard-report-row"><span>งานกำลังทำ</span><strong>{activeJobs.length} งาน</strong></div>
          <div className="dashboard-report-row"><span>งานเสร็จแล้ว</span><strong>{doneJobs.length} งาน</strong></div>
          <div className="dashboard-report-row"><span>ชิ้นดีจากการผลิต</span><strong>{numberFormatter.format(summary.totalGoodPcs)} ชิ้น</strong></div>
          <div className="dashboard-report-row"><span>ชิ้นเสียจากการผลิต</span><strong>{numberFormatter.format(summary.totalDefectPcs)} ชิ้น</strong></div>
        </div>
      </div>
    </div>
  );
}