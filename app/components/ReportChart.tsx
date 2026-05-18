"use client";

import React, { useEffect, useState } from "react";

type Point = { period: string; count: number };

export default function ReportChart() {
  const [interval, setInterval] = useState<string>("daily");
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?report=created&interval=${interval}`);
        const json = await res.json();
        if (!mounted) return;
        setData(json.map((r: any) => ({ period: r.period, count: Number(r.count) })));
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, [interval]);

  const max = data.reduce((m, p) => Math.max(m, p.count), 1);

  return (
    <div className="report-chart">
      <div className="report-controls">
        <label>ช่วงเวลา:</label>
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          <option value="daily">รายวัน</option>
          <option value="weekly">รายสัปดาห์</option>
          <option value="monthly">รายเดือน</option>
          <option value="quarterly">รายไตรมาส</option>
          <option value="yearly">รายปี</option>
        </select>
      </div>

      <div className="chart-area">
        {loading && <div className="chart-loading">กำลังโหลด...</div>}
        {!loading && data.length === 0 && <div className="chart-empty">ไม่มีข้อมูลสำหรับช่วงเวลานี้</div>}
        {!loading && data.length > 0 && (
          <div className="bars">
            {data.map((p, i) => (
              <div className="bar-wrap" key={i} title={`${p.period}: ${p.count}`}>
                <div className="bar" style={{ height: `${(p.count / (max || 1)) * 100}%` }} />
                <div className="bar-label">{new Date(p.period).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .report-chart { padding: 12px; }
        .report-controls { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
        .chart-area { min-height:120px; display:flex; align-items:center; }
        .chart-loading, .chart-empty { color:var(--dark); }
        .bars { display:flex; align-items:end; gap:8px; width:100%; overflow:auto; padding:8px 4px; }
        .bar-wrap { display:flex; flex-direction:column; align-items:center; width:48px; }
        .bar { width:100%; background:var(--green); border-radius:6px 6px 0 0; transition:height .3s ease; }
        .bar-label { font-size:12px; color:var(--dark); margin-top:6px; white-space:nowrap; }
      `}</style>
    </div>
  );
}
