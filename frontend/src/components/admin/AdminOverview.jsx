import React, { useState } from 'react';
import { 
  Users, 
  DollarSign, 
  Activity, 
  FileCheck, 
  TrendingUp, 
  Sparkles, 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  Calendar,
  RefreshCw
} from 'lucide-react';

export default function AdminOverview({ stats, onRefresh, loading }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  if (!stats) return null;

  const dailyData = stats.daily_scans || [];
  const maxScans = Math.max(1, ...dailyData.map((d) => d.scans));

  // Compute SVG dimensions for the 30-day line chart
  const chartWidth = 720;
  const chartHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const points = dailyData.map((d, index) => {
    const x = paddingX + (index / Math.max(1, dailyData.length - 1)) * innerWidth;
    const y = chartHeight - paddingY - (d.scans / maxScans) * innerHeight;
    return { ...d, x, y };
  });

  const linePath = points.length > 0 
    ? `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
    : '';

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)},${chartHeight - paddingY} L ${points[0].x.toFixed(1)},${chartHeight - paddingY} Z`
    : '';

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Users</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total_users}</h3>
            <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{stats.active_pro_users} Pro Subscribers</span>
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* MRR Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Recurring (MRR)</p>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mt-1">${stats.mrr_usd.toFixed(2)}</h3>
            <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{stats.stripe_synced ? 'Synced with Stripe' : 'Estimated Base'}</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Scans Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Scans Today</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total_scans_today}</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              <span>{stats.total_scans_month} scans this month</span>
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* All-Time Scans */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">All-Time Scans</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total_scans_all_time}</h3>
            <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Vector DB Indexed</span>
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 30-Day Daily Scan Volume Trend Chart */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-extrabold text-slate-900">Daily Scan Volume (Last 30 Days)</h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Audits / Day
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily plagiarism detection pipeline activity and submission load.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Line / Area Chart Viewport */}
        <div className="mt-6 relative overflow-x-auto">
          <div className="min-w-[680px]">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-56 select-none overflow-visible"
            >
              <defs>
                <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Guide Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const yPos = chartHeight - paddingY - pct * innerHeight;
                const value = Math.round(pct * maxScans);
                return (
                  <g key={i}>
                    <line
                      x1={paddingX}
                      y1={yPos}
                      x2={chartWidth - paddingX}
                      y2={yPos}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX - 10}
                      y={yPos + 3}
                      fill="#94a3b8"
                      fontSize="9"
                      textAnchor="end"
                      fontFamily="sans-serif"
                    >
                      {value}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Area Under Curve */}
              {areaPath && (
                <path d={areaPath} fill="url(#scanGradient)" />
              )}

              {/* Main Line Plot */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Data Point Dots */}
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoveredDay?.date === p.date ? 6 : 3.5}
                  className="cursor-pointer transition-all duration-150"
                  fill={hoveredDay?.date === p.date ? '#4338ca' : '#4f46e5'}
                  stroke="#ffffff"
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredDay(p)}
                  onMouseLeave={() => setHoveredDay(null)}
                />
              ))}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredDay && (
              <div 
                className="absolute z-20 bg-slate-900 text-white text-[11px] font-semibold py-1.5 px-3 rounded-xl shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${(hoveredDay.x / chartWidth) * 100}%`,
                  top: `${(hoveredDay.y / chartHeight) * 100}%`,
                  marginTop: '-10px'
                }}
              >
                <div className="font-extrabold text-indigo-300">{hoveredDay.scans} Scans</div>
                <div className="text-[10px] text-slate-400">{hoveredDay.date}</div>
              </div>
            )}
          </div>

          {/* Date Axis Labels */}
          <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-10">
            <span>{dailyData[0]?.date}</span>
            <span>{dailyData[Math.floor(dailyData.length / 2)]?.date}</span>
            <span>{dailyData[dailyData.length - 1]?.date}</span>
          </div>
        </div>
      </div>

      {/* System Health Diagnostics */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Server className="w-5 h-5 text-slate-600" />
          <h4 className="text-sm font-extrabold text-slate-900">Infrastructure & System Diagnostics</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-xs">
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-slate-500 font-medium">PostgreSQL Engine</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-slate-500 font-medium">Vector DB (Qdrant)</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-slate-500 font-medium">OCR Engine (Tesseract)</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Ready
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
            <span className="text-slate-500 font-medium">Stripe Webhooks</span>
            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              {stats.stripe_synced ? 'Active' : 'Standby'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
