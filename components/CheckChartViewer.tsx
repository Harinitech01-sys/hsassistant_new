"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from "recharts";

interface ChartViewerProps {
  checkId: string;
  sheets: any; // Raw dynamic sheets data passed from frontend upload state
  check: any;  // Anomaly check payload metadata
}

export default function CheckChartViewer({ checkId, sheets, check }: ChartViewerProps) {
  
  // Dynamic safe wrapper to catch alternative naming styles on uploaded sheets
  const getSheetRows = (names: string[]): any[] => {
    if (!sheets) return [];
    for (const name of names) {
      if (sheets[name] && Array.isArray(sheets[name])) return sheets[name];
    }
    return [];
  };

  const oliRows = getSheetRows(["Order_line_item", "Order_Line_Item", "order_line_item"]);
  const mpcRows = getSheetRows(["mpc", "MPC"]);
  const schedRows = getSheetRows(["schedular logs", "Scheduler_logs", "scheduler_logs"]);

  if (!oliRows.length) {
    return (
      <div className="text-xs text-neutral-400 p-4 italic bg-neutral-50 rounded-xl border border-neutral-200">
        📊 Waiting for data parsing stream to populate dynamic layout metrics...
      </div>
    );
  }

  switch (checkId) {
    case "C1": {
      const keys = ["order_line_number", "order_line_step_code", "points_left_to_redeem", "total_redeemable_points", "load_date"];
      const chartData = keys.map(key => {
        const validCount = oliRows.filter(r => r[key] !== null && r[key] !== undefined && String(r[key]).trim() !== "").length;
        return { name: key.replace(/_/g, " "), Valid: validCount, Missing: oliRows.length - validCount };
      });

      return (
        <div className="space-y-3">
          <div className="h-[240px] w-full bg-white p-4 border border-neutral-200 rounded-xl block">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Valid" stackId="a" fill="#10b981" />
                <Bar dataKey="Missing" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Chart Description:</strong> Displays field density properties for the current dataset containing {oliRows.length} total elements. Green areas reflect clear values, and Red reflects blanks.
          </p>
        </div>
      );
    }

    case "C2": {
      const mpcMap: Record<string, number> = {};
      mpcRows.forEach(row => {
        const id = String(row["product_primary_class_id"] ?? "").trim();
        const pct = Number(row["redemption_percentage"] ?? 0);
        if (id) mpcMap[id] = pct;
      });

      // Scales dynamically with dataset length up to a readable maximum window size of 20
      const chartData = oliRows.slice(0, 20).map((row, idx) => {
        const classId = String(row["product_primary_class_id"] ?? "").trim();
        const pct = mpcMap[classId] ?? 0;
        const sales = Number(row["extended_sales_amount"] ?? 0);
        const systemPts = Number(row["total_redeemable_points"] ?? 0);
        const manualPts = Math.floor(((sales * pct / 100) / 0.005));
        return { line: `L${idx + 1}`, System: systemPts, Formula: manualPts };
      });

      return (
        <div className="space-y-3">
          <div className="h-[240px] w-full bg-white p-4 border border-neutral-200 rounded-xl block">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="line" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="System" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Formula" stroke="#ea580c" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Chart Description:</strong> Tracks calculation variations down to individual cell inputs over a sample snapshot window of the uploaded spreadsheet array.
          </p>
        </div>
      );
    }

    case "C3": {
      const distribution: Record<string, number> = {};
      oliRows.forEach(r => {
        const code = String(r["order_line_step_code"] ?? "UNKNOWN").trim().toLowerCase();
        distribution[code] = (distribution[code] || 0) + 1;
      });
      const chartData = Object.entries(distribution).map(([name, value]) => ({ name, value }));
      const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

      return (
        <div className="space-y-3">
          <div className="h-[240px] w-full bg-white flex items-center justify-center border border-neutral-200 rounded-xl p-4 block">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={50} 
                  outerRadius={75} 
                  paddingAngle={4} 
                  dataKey="value" 
                  label={(props: any) => `${props.name ?? "Unknown"} (${((props.percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Chart Description:</strong> Displays the distribution share metrics for unique status step codes found within the uploaded work file.
          </p>
        </div>
      );
    }

    case "C4": {
      const chartData = oliRows.slice(0, 20).map((row, idx) => {
        const sysPLTR = Number(row["points_left_to_redeem"] ?? 0);
        const total = Number(row["total_redeemable_points"] ?? 0);
        const redeemed = Number(row["points_redeemed"] ?? 0);
        return { id: idx + 1, System: sysPLTR, Calculated: total - redeemed, label: `Line ${idx + 1}` };
      });

      return (
        <div className="space-y-3">
          <div className="h-[240px] w-full bg-white p-4 border border-neutral-200 rounded-xl block">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="Calculated" name="Calculated" tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="System" name="System" tick={{ fontSize: 10 }} />
                <ZAxis dataKey="label" name="Item ID" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Balance Tracking" data={chartData} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Chart Description:</strong> Correlates outstanding balances. Clustered points highlight tight mathematical alignment, while loose outliers represent clear variance risks.
          </p>
        </div>
      );
    }

    case "C8": {
      // ====================================================================
      // FULLY DYNAMIC LOGIC FOR C8 (Binds cleanly to any uploaded dataset volume)
      // ====================================================================
      // 1. Calculate active eligible rows with transaction timestamps
      const countedEligibleFromFile = oliRows.filter(r => r["date_of_transaction"] !== null && String(r["date_of_transaction"]).trim() !== "").length;
      
      // 2. Locate the corresponding expected execution log row from the uploaded scheduler logs sheet
      const targetLogEntry = schedRows.find(r => String(r["scheduler"]).includes("Calc_of_points"));
      const loggedCountFromLogs = targetLogEntry ? Number(targetLogEntry["record_count"] ?? targetLogEntry["mapped_count"] ?? 0) : 0;

      const chartData = [
        { name: "Scheduler expected", Volume: loggedCountFromLogs },
        { name: "File Actual Count", Volume: countedEligibleFromFile }
      ];

      return (
        <div className="space-y-3">
          <div className="h-[200px] w-full bg-white p-4 border border-neutral-200 rounded-xl block">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                {/* Dynamically adjust the bar color: Green if counts match, Red if there's a mismatch */}
                <Bar 
                  dataKey="Volume" 
                  fill={loggedCountFromLogs === countedEligibleFromFile ? "#10b981" : "#ef4444"} 
                  radius={[4, 4, 0, 0]} 
                  barSize={35} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Chart Description:</strong> Compares expected execution log counts against active spreadsheet row counts. A side-by-side gap indicates rows were dropped during transmission.
          </p>
        </div>
      );
    }

    case "C9": {
      const counts: Record<string, number> = {};
      oliRows.forEach(r => {
        const d = r["load_date"] ? String(r["load_date"]).split("T")[0].trim() : "Blank";
        counts[d] = (counts[d] || 0) + 1;
      });
      const chartData = Object.entries(counts).map(([date, count]) => ({ date, count }));
      return (
        <div className="h-44 w-full bg-white p-2 border border-neutral-100 rounded-xl block">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    default: {
      // General fall-through for C5, C6, C7 row metric counts
      const nonNullDateCount = oliRows.filter(r => r["date_of_transaction"] && String(r["date_of_transaction"]).trim() !== "").length;
      const chartData = [
        { name: "Total Rows", count: oliRows.length, fill: "#64748b" },
        { name: "Eligible (Not Null)", count: nonNullDateCount, fill: "#3b82f6" },
        { name: "Ineligible (Null)", count: oliRows.length - nonNullDateCount, fill: "#f59e0b" }
      ];
      return (
        <div className="space-y-3">
          <div className="h-[240px] w-full bg-white p-4 border border-neutral-200 rounded-xl block">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                  {chartData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Chart Description:</strong> Displays pipeline execution volume splits for the uploaded data matrix.
          </p>
        </div>
      );
    }
  }
}