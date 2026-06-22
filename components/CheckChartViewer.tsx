"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

interface ChartViewerProps {
  checkId: string;
  sheets: any; // Dynamic sheet data matrix from uploaded files or live Supabase tables
  check: any;  // Metadata from the validation engine pass
}

export default function CheckChartViewer({ checkId, sheets, check }: ChartViewerProps) {
  
  // Safe dynamic parsing utility layer to read across variable table casings
  const getSheetRows = (names: string[]): any[] => {
    if (!sheets) return [];
    for (const name of names) {
      if (sheets[name] && Array.isArray(sheets[name])) return sheets[name];
    }
    return [];
  };

  const oliRows = getSheetRows(["Order_line_item", "Order_Line_Item", "order_line_item"]);
  const mpcRows = getSheetRows(["mpc", "MPC"]);
  const schedRows = getSheetRows(["schedular logs", "Scheduler_logs", "scheduler_logs", "scheduler"]);

  if (!oliRows.length) {
    return (
      <div className="text-xs text-neutral-400 p-4 italic bg-neutral-50 rounded-xl border border-neutral-200">
        📊 Waiting for data matrix execution pass to populate analytics...
      </div>
    );
  }

  // Dynamic sample boundaries: matches dataset dynamically up to 40 max elements for UI readability
  const sampleLimit = Math.min(oliRows.length, 40);

  switch (checkId) {
    case "C1": {
      const keys = ["order_line_number", "order_line_step_code", "points_left_to_redeem", "total_redeemable_points", "load_date"];
      const chartData = keys.map(key => {
        const validCount = oliRows.filter(r => r[key] !== null && r[key] !== undefined && String(r[key]).trim() !== "").length;
        return { name: key.replace(/_/g, " "), Valid: validCount, Missing: oliRows.length - validCount };
      });

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📊 Chart: Mandatory Columns Fill-Rate Density
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                {/* Fixed: Added interval 0 and a clean tilt to prevent squishing */}
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} angle={-15} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Record Volume', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={32} />
                <Bar name="Valid Values" dataKey="Valid" stackId="a" fill="#10b981" />
                <Bar name="Missing / NULL" dataKey="Missing" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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

      const chartData = oliRows.slice(0, sampleLimit).map((row, idx) => {
        const classId = String(row["product_primary_class_id"] ?? "").trim();
        const pct = mpcMap[classId] ?? 0;
        const sales = Number(row["extended_sales_amount"] ?? 0);
        const systemPts = Number(row["total_redeemable_points"] ?? 0);
        const manualPts = Math.floor(((sales * pct / 100) / 0.005));
        return { line: `L${idx + 1}`, System: systemPts, Formula: manualPts };
      });

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📈 Chart: Manual Formula vs System Points Verification Window
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                {/* Fixed: Reduced label text sizing and added an interval gap helper for clean layout scaling */}
                <XAxis dataKey="line" tick={{ fontSize: 9 }} interval={sampleLimit > 20 ? 1 : 0} label={{ value: 'Spreadsheet Row Index (Sample window)', position: 'insideBottom', offset: 25, style: { fontSize: 10, fill: '#475569', fontWeight: 'bold' } }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Point Balance Metrics', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={32} />
                <Line name="System Calculated" type="monotone" dataKey="System" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                <Line name="Independent Audit Formula" type="monotone" dataKey="Formula" stroke="#ea580c" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 1 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs font-medium text-neutral-600 bg-neutral-100 p-2.5 rounded-lg">
            <strong>Dynamic Window Tracking:</strong> Rendering a structural snapshot window of {sampleLimit} active rows from the database payload array.
          </p>
        </div>
      );
    }

    case "C3": {
      const distribution: Record<string, number> = {};
      oliRows.forEach(r => {
        const code = String(r["order_line_step_code"] ?? "UNKNOWN").trim().toUpperCase();
        distribution[code] = (distribution[code] || 0) + 1;
      });
      const chartData = Object.entries(distribution).map(([name, value]) => ({ name, value }));
      const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            🍩 Chart: Order Line Step Code Status Share Split
          </div>
          <div className="h-[260px] w-full bg-white flex items-center justify-center border border-neutral-200 rounded-xl p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" label={(props) => `${props.name}: ${props.value}`}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case "C5": {
      const buDistribution: Record<string, { Valid: number; Missing: number }> = {};
      
      oliRows.forEach(r => {
        const step = String(r["order_line_step_code"] ?? "").toLowerCase().trim();
        const bu = String(r["business_unit_description"] ?? "").trim();
        
        if (step === "post" || step === "posted") {
          const buName = bu === "" || bu === "null" ? "Missing / Blanks" : bu;
          if (!buDistribution[buName]) buDistribution[buName] = { Valid: 0, Missing: 0 };
          
          if (buName === "Missing / Blanks") {
            buDistribution[buName].Missing += 1;
          } else {
            buDistribution[buName].Valid += 1;
          }
        }
      });

      const chartData = Object.entries(buDistribution).map(([name, counts]) => ({
        name,
        "Valid BU Present": counts.Valid,
        "Missing BU Context": counts.Missing
      }));

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📊 Chart: Business Unit Integrity for Posted Orders
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                {/* Fixed: Rotated x-axis categories to accommodate dynamic names cleanly */}
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" label={{ value: 'Business Unit Group Category', position: 'insideBottom', offset: 35, style: { fontSize: 10, fill: '#475569', fontWeight: 'bold' } }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Posted Order Counts', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={28} />
                <Bar dataKey="Valid BU Present" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Missing BU Context" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case "C6": {
      let dormantEarningCount = 0;
      let dormantNonEarningCount = 0;
      let activeAccountsCount = 0;

      oliRows.forEach(r => {
        const isDormant = Number(r["dormant_account_flag"] ?? 0) === 1;
        const pts = Number(r["total_redeemable_points"] ?? 0);

        if (isDormant) {
          if (pts > 0) dormantEarningCount += 1;
          else dormantNonEarningCount += 1;
        } else {
          activeAccountsCount += 1;
        }
      });

      const chartData = [
        { name: "Active Accounts", count: activeAccountsCount, fill: "#10b981" },
        { name: "Dormant (Compliant)", count: dormantNonEarningCount, fill: "#64748b" },
        { name: "Dormant Anomaly (Violations)", count: dormantEarningCount, fill: "#ef4444" }
      ];

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📊 Chart: Account Dormancy vs Earning Actions Distribution
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                {/* Fixed: Added slight labels rotation alignment path */}
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-10} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Account Metrics Volumetrics', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={50}>
                  {chartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case "C7": {
      const chartData = oliRows.slice(0, sampleLimit).map((r, idx) => {
        const hasTransactionDate = r["date_of_transaction"] !== null && String(r["date_of_transaction"]).trim() !== "";
        return {
          name: `Row ${idx + 1}`,
          "Valid Invariants": hasTransactionDate ? 1 : 0,
          "Invalid Splits": hasTransactionDate ? 0 : 1
        };
      });

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📉 Chart: Transaction Date Invariant Compliance Timeline
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 15, left: 15, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={sampleLimit > 20 ? 1 : 0} label={{ value: 'Row Parsing Ingestion Order', position: 'insideBottom', offset: 25, style: { fontSize: 10, fill: '#475569', fontWeight: 'bold' } }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={28} />
                <Area name="Date Field Present" type="monotone" dataKey="Valid Invariants" stackId="1" stroke="#8b5cf6" fill="#c084fc" fillOpacity={0.2} />
                <Area name="Date Field Missing (NULL)" type="monotone" dataKey="Invalid Splits" stackId="1" stroke="#ec4899" fill="#f472b6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case "C8": {
      const targetLogEntry = schedRows.find(r => String(r["scheduler"] || "").includes("Calc_of_points"));
      const expectedCount = targetLogEntry ? Number(targetLogEntry["record_count"] ?? targetLogEntry["mapped_count"] ?? 0) : oliRows.length;
      const actualCount = oliRows.length;

      const chartData = [
        {
          name: "Audit Reconciliation Data",
          "Expected (Scheduler Logs)": expectedCount,
          "Actual (File Records Loaded)": actualCount
        }
      ];

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📊 Chart: Scheduler vs Output Reconciliation Check
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 25, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Total Record Ingestion Volumes', angle: -90, position: 'insideLeft', offset: -10, style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={36} />
                <Bar dataKey="Expected (Scheduler Logs)" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={60} />
                <Bar dataKey="Actual (File Records Loaded)" fill={expectedCount === actualCount ? "#10b981" : "#ef4444"} radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    case "C9": {
      const dateCounts: Record<string, number> = {};
      oliRows.forEach(r => {
        let dateStr = "Unknown Date";
        if (r["load_date"]) {
          dateStr = String(r["load_date"]).split("T")[0].trim();
        }
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
      });

      const chartData = Object.entries(dateCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({
          date,
          "Ingested Records": count
        }));

      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📅 Chart: Job Run Date Volume Distribution Consistency
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                {/* Fixed: Rotated YYYY-MM-DD date stamps -25 degrees with bottom offset buffering */}
                <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" label={{ value: 'System Load Run Batch Timestamp (YYYY-MM-DD)', position: 'insideBottom', offset: 35, style: { fontSize: 10, fill: '#475569', fontWeight: 'bold' } }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Processed Row Count', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={24} />
                <Bar name="Ingested Records Count" dataKey="Ingested Records" fill="#db2777" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    default: {
      const nonNullDateCount = oliRows.filter(r => r["date_of_transaction"] && String(r["date_of_transaction"]).trim() !== "").length;
      const chartData = [
        { name: "Total Rows", count: oliRows.length, fill: "#64748b" },
        { name: "Eligible (Valid)", count: nonNullDateCount, fill: "#3b82f6" },
        { name: "Ineligible", count: oliRows.length - nonNullDateCount, fill: "#f59e0b" }
      ];
      return (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-1">
            📊 Chart: Ledger Pipeline Data Volume Splits
          </div>
          <div className="h-[260px] w-full bg-white p-4 border border-neutral-200 rounded-xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 25, right: 15, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'Row Count Data Summary', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 'bold', fill: '#475569' } }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
  }
}