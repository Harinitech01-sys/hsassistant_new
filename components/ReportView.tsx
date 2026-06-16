"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalysisReport, AnomalyResult, ExplainResponse } from "@/types";
import AnimatedCounter from "@/components/AnimatedCounter";
import CheckChartViewer from "./CheckChartViewer"; // Our newly built Recharts component

interface Props {
  report: AnalysisReport & { rawSheetsData?: any };
}

type Filter = "all" | "fail" | "pass" | "info";

export default function ReportView({ report }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = report.checks.filter((c) => {
    if (filter === "all") return true;
    if (filter === "fail") return c.status === "fail";
    if (filter === "pass") return c.status === "pass";
    if (filter === "info") return c.status === "warning" || c.status === "info";
    return true;
  });

  const handleExport = () => {
    const lines = [
      `Anomaly Check Report`,
      `File: ${report.filename}`,
      `Analyzed At: ${new Date(report.analyzedAt).toLocaleString()}`,
      `Run Date: ${report.runDate}`,
      ``,
      `Summary: ${report.summary.passed} passed / ${report.summary.failed} failed / ${report.summary.warnings} info-warn`,
      ``,
      ...report.checks.map((c) =>
        [
          `[${c.checkId}] ${c.checkName}`,
          `Status: ${c.status.toUpperCase()}`,
          `Message: ${c.message}`,
          c.details?.length
            ? `Details (first ${Math.min(c.details.length, 10)}):\n` +
              c.details
                .slice(0, 10)
                .map(
                  (d) =>
                    `  ${d.cellRef ?? `Row ${d.rowIndex ?? "-"}`} [${d.field ?? "-"}] value=${formatCellValue(
                      d.value
                    )} -> ${d.issue}`
                )
                .join("\n")
            : "",
          ``,
        ].join("\n")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anomaly-report-${report.runDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 text-black">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Analysis Report</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {report.filename} · Run date:{" "}
            <span className="font-semibold text-neutral-700">{report.runDate}</span> · Analyzed{" "}
            {new Date(report.analyzedAt).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Checks" value={report.summary.total} accent="from-neutral-100 to-neutral-50" text="text-neutral-900" />
        <SummaryCard label="Passed" value={report.summary.passed} accent="from-emerald-50 to-emerald-100/50" text="text-emerald-700" />
        <SummaryCard label="Failed" value={report.summary.failed} accent="from-rose-50 to-rose-100/50" text="text-rose-700" />
        <SummaryCard label="Info / Warn" value={report.summary.warnings} accent="from-amber-50 to-amber-100/50" text="text-amber-700" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Sheets found:</span>
        {report.sheetsFound.map((s) => (
          <span key={s} className="rounded-md bg-white border border-neutral-200 px-2 py-0.5 font-mono text-xs text-neutral-600 shadow-sm">
            {s}
          </span>
        ))}
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {(["all", "fail", "pass", "info"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
            }`}
          >
            {f === "info" ? "Info / Warn" : f}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${filter === f ? "bg-orange-100 text-orange-700" : "bg-neutral-100 text-neutral-600"}`}>
              {f === "all"
                ? report.checks.length
                : f === "fail"
                ? report.summary.failed
                : f === "pass"
                ? report.summary.passed
                : report.summary.warnings}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((check, i) => (
          <CheckCard
            key={check.checkId}
            check={check}
            index={i}
            reportRawSheetsData={report.rawSheetsData} // Pass excel sheets down safely
            expanded={expandedId === check.checkId}
            onToggle={() => setExpandedId(expandedId === check.checkId ? null : check.checkId)}
          />
        ))}
      </div>
    </div>
  );
}

function formatCellValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "(blank)";
  return String(value);
}

function SummaryCard({
  label,
  value,
  accent,
  text,
}: {
  label: string;
  value: number;
  accent: string;
  text: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`rounded-2xl border border-neutral-200 bg-gradient-to-br ${accent} p-5 shadow-sm`}
    >
      <div className={`text-3xl font-bold ${text}`}>
        <AnimatedCounter value={value} />
      </div>
      <div className="mt-1 text-xs font-medium text-neutral-500">{label}</div>
    </motion.div>
  );
}

const STATUS_CONFIG = {
  pass: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800", label: "PASS", ring: "ring-emerald-500/10" },
  fail: { dot: "bg-rose-500", badge: "bg-rose-100 text-rose-800", label: "FAIL", ring: "ring-rose-500/10" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-800", label: "WARN", ring: "ring-amber-500/10" },
  info: { dot: "bg-sky-500", badge: "bg-sky-100 text-sky-800", label: "INFO", ring: "ring-sky-500/10" },
} as const;

function CheckCard({
  check,
  index,
  reportRawSheetsData,
  expanded,
  onToggle,
}: {
  check: AnomalyResult;
  index: number;
  reportRawSheetsData: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = STATUS_CONFIG[check.status];
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");

  const runExplain = async () => {
    setExplainLoading(true);
    setExplainError("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ check }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to explain");
      setExplain(data as ExplainResponse);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Failed to explain");
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3) }}
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur-sm shadow-sm ring-1 ${cfg.ring}`}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-neutral-50/50 transition-colors">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
        <span className="shrink-0 font-mono text-xs text-neutral-400">{check.checkId}</span>
        <span className="flex-1 text-sm font-semibold text-neutral-900">{check.checkName}</span>
        {check.count !== undefined && check.total !== undefined && (
          <span className="shrink-0 text-xs font-medium text-neutral-500">
            {check.count} / {check.total}
          </span>
        )}
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${cfg.badge}`}>
          {cfg.label}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-neutral-100 bg-neutral-50/40"
          >
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="text-xs text-neutral-500">{check.description}</p>
                <p className="mt-2 text-sm font-semibold text-neutral-800">{check.message}</p>
              </div>

              {/* --- 1. AI EXPLANATION GENERATION CONTAINER CARD --- */}
              <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z" />
                    </svg>
                    <span className="text-sm font-semibold text-orange-800">AI explanation</span>
                  </div>
                  <button
                    onClick={runExplain}
                    disabled={explainLoading}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:opacity-50"
                  >
                    {explainLoading ? "Analyzing…" : explain ? "Regenerate" : "Explain with AI"}
                  </button>
                </div>

                {explainError && <p className="mt-3 text-xs text-rose-600 font-medium">{explainError}</p>}

                {explain && (
                  <div className="mt-3 space-y-2 border-t border-orange-100 pt-3">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                      {explain.explanation}
                    </div>
                    {explain.sources.length > 0 && (
                      <p className="text-[11px] font-medium text-neutral-400">Sources: {explain.sources.join(", ")}</p>
                    )}
                  </div>
                )}
              </div>

              {/* --- 2. FIXED: MOUNT THE REAL DYNAMIC RECHARTS VIEWER WITH GRAPH TEXT DESCRIPTION --- */}
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    Check Metrics &amp; Visual Chart
                  </h4>
                  <span className="font-mono text-[10px] font-bold text-neutral-400">CONTEXT DESCRIPTOR: {check.checkId}</span>
                </div>

                <div className="w-full block">             
                  <CheckChartViewer checkId={check.checkId} sheets={reportRawSheetsData} check={check} />
                </div>
              </div>

              {/* --- 3. AUDIT TRANSACTION ENTRIES ISSUE LOG TABLE UNIT --- */}
              {check.details && check.details.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold text-neutral-500">
                    Issue details (showing first {Math.min(check.details.length, 50)} of{" "}
                    {check.count ?? check.details.length}):
                  </p>
                  <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-white">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-neutral-100 backdrop-blur">
                        <tr className="border-b border-neutral-200">
                          <th className="px-3 py-2 text-left font-semibold text-neutral-700">Row</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-700">Column</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-700">Cell</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-700">Bad value</th>
                          <th className="px-3 py-2 text-left font-semibold text-neutral-700">Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {check.details.map((d, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-transparent" : "bg-orange-50/20"}>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-500">{d.rowIndex ?? "-"}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-800 font-medium">{d.field ?? "-"}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-orange-600 font-semibold">{d.cellRef ?? "-"}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 font-mono text-amber-700 bg-amber-50/40 rounded px-1">{formatCellValue(d.value)}</td>
                            <td className="px-3 py-1.5 text-neutral-700">{d.issue ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}