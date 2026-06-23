"use client";

import { useState, useEffect, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalysisReport, AnomalyResult, ExplainResponse } from "@/types";
import AnimatedCounter from "@/components/AnimatedCounter";
import CheckChartViewer from "./CheckChartViewer";

interface Props {
  report: AnalysisReport & { rawSheetsData?: any };
}

type Filter = "all" | "fail" | "pass" | "info";

export default function ReportView({ report }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [mounted, setMounted] = useState(false); // ✅ Fixed typo here
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');

  // Track client mounting to handle portal injection smoothly
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!expandedId && report.checks.length > 0) {
      const firstFail = report.checks.find((c) => c.status === "fail" || c.status === "warning");
      setExpandedId(firstFail?.checkId ?? report.checks[0].checkId);
    }
  }, [report.checks, expandedId]);

  const downloadReportPdf = async () => {
    if (!report?.checks?.length) {
      setExportStatus('error');
      setExportMessage('No report data is available to export.');
      return;
    }

    setExportStatus('loading');
    setExportMessage('Generating PDF...');

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks: report.checks }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'PDF generation failed.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Data_Quality_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setExportMessage('PDF generated and downloaded successfully.');
    } catch (error: any) {
      setExportStatus('error');
      setExportMessage(error?.message || 'Failed to generate PDF.');
    } finally {
      window.setTimeout(() => setExportStatus('idle'), 5000);
    }
  };

  const filtered = report.checks.filter((c) => {
    if (filter === "all") return true;
    if (filter === "fail") return c.status === "fail";
    if (filter === "pass") return c.status === "pass";
    if (filter === "info") return c.status === "warning" || c.status === "info";
    return true;
  });

  return (
    <div id="reconciliation-report-root" className="space-y-8 text-neutral-900 bg-white p-2 rounded-2xl print:p-0 print:space-y-6 relative">
      
      {/* ====================================================================
          HTML DIRECT PORTAL TRIGGER (Escapes Framer Motion to prevent blocked clicks)
          ==================================================================== */}
      {mounted && createPortal(
        <div className="print:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              downloadReportPdf();
            }}
            className="fixed bottom-24 right-24 bg-neutral-950 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider rounded-full px-6 py-4 shadow-2xl transition-all transform active:scale-95 flex items-center gap-2"
            style={{
              position: 'fixed',
              zIndex: 999999,
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: 'none',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)'
            }}
          >
            <svg className="h-4 w-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {exportStatus === 'loading' ? 'Generating PDF…' : 'Generate Report PDF'}
          </button>

          {exportStatus !== 'idle' && (
            <div className="fixed bottom-16 right-24 w-[280px] rounded-2xl border border-neutral-800 bg-black/95 px-4 py-3 text-sm text-white shadow-2xl">
              {exportMessage}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* ====================================================================
          1. SYSTEM AUDIT COVER TITLE (Visible ONLY inside saved PDF)
          ==================================================================== */}
      <div className="hidden print:block border-b-4 border-neutral-950 pb-6 mb-6 w-full">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Data Integrity Ledger // Corporate Copy</p>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950 uppercase">Analysis &amp; Reconciliation Audit Report</h1>
            <p className="text-xs text-neutral-600 font-medium">
              Source Matrix File: <span className="font-mono font-bold text-neutral-900">{report.filename}</span>
            </p>
          </div>
          <div className="text-right text-xs font-mono text-neutral-500 space-y-0.5">
            <div>RUN DATE: {report.runDate}</div>
            <div>COMPILED AT: {new Date(report.analyzedAt).toLocaleString()}</div>
            <div className="text-neutral-950 font-bold uppercase tracking-wider text-[10px] bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 mt-1 inline-block">Verified Secure</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 border-t border-neutral-200 pt-4 font-mono text-xs">
          <div><span className="text-neutral-400 block uppercase text-[9px] font-bold">Total Rules Scanned</span> <span className="text-base font-bold text-neutral-900">{report.summary.total}</span></div>
          <div><span className="text-neutral-400 block uppercase text-[9px] font-bold">Passed Parameters</span> <span className="text-base font-bold text-emerald-600">{report.summary.passed}</span></div>
          <div><span className="text-neutral-400 block uppercase text-[9px] font-bold">Flagged Anomalies</span> <span className="text-base font-bold text-rose-600">{report.summary.failed}</span></div>
          <div><span className="text-neutral-400 block uppercase text-[9px] font-bold">System Warnings</span> <span className="text-base font-bold text-amber-600">{report.summary.warnings}</span></div>
        </div>
      </div>

      {/* ====================================================================
          2. SCREEN INTERFACE SUMMARY TILES
          ==================================================================== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        <SummaryCard label="Total Checks" value={report.summary.total} accent="from-neutral-100 to-neutral-50" text="text-neutral-900" />
        <SummaryCard label="Passed" value={report.summary.passed} accent="from-emerald-50 to-emerald-100/50" text="text-emerald-700" />
        <SummaryCard label="Failed" value={report.summary.failed} accent="from-rose-50 to-rose-100/50" text="text-rose-700" />
        <SummaryCard label="Info / Warn" value={report.summary.warnings} accent="from-amber-50 to-amber-100/50" text="text-amber-700" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 print:border-none print:bg-white print:p-0">
        <span className="text-xs font-bold text-neutral-400 font-mono uppercase tracking-wide print:text-neutral-500">Sheets found:</span>
        {report.sheetsFound.map((s) => (
          <span key={s} className="rounded-md bg-white border border-neutral-200 px-2 py-0.5 font-mono text-xs text-neutral-600 shadow-sm print:shadow-none">
            {s}
          </span>
        ))}
      </div>

      {/* ====================================================================
          3. NAVIGATION FILTER BAR TABS
          ==================================================================== */}
      <div className="flex items-center justify-between border-b border-neutral-200 print:hidden">
        <div className="flex gap-1">
          {(["all", "fail", "pass", "info"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold capitalize transition-colors ${
                filter === f
                  ? "border-neutral-950 text-neutral-950 font-extrabold"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              }`}
            >
              {f === "info" ? "Info / Warn" : f}
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === f ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-500"}`}>
                {f === "all" ? report.checks.length : f === "fail" ? report.summary.failed : f === "pass" ? report.summary.passed : report.summary.warnings}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================================
          4. VALIDATION CARDS PIPELINE LIST
          ==================================================================== */}
      <div className="space-y-3 print:space-y-6 print:block print:w-full">
        {filtered.map((check, i) => (
          <CheckCard
            key={check.checkId}
            check={check}
            index={i}
            reportRawSheetsData={report.rawSheetsData}
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

function SummaryCard({ label, value, accent, text }: { label: string; value: number; accent: string; text: string }) {
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
  pass: { dot: "bg-emerald-500", badge: "bg-emerald-50 border-emerald-200 text-emerald-800", label: "PASSED" },
  fail: { dot: "bg-rose-500", badge: "bg-rose-50 border-rose-300 text-rose-800", label: "ANOMALY" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-50 border-amber-200 text-amber-800", label: "WARN" },
  info: { dot: "bg-sky-500", badge: "bg-sky-50 border-sky-200 text-sky-800", label: "INFO" },
} as const;

interface CheckCardProps {
  check: AnomalyResult;
  index: number;
  reportRawSheetsData: any;
  expanded: boolean;
  onToggle: () => void;
}

function CheckCard({ check, index, reportRawSheetsData, expanded, onToggle }: CheckCardProps) {
  const cfg = STATUS_CONFIG[check.status];
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");

  const runExplain = async (e?: MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.stopPropagation();
    }
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
      const explanationText = data.explanation || data.aiExplanation || "No explanation available.";
      setExplain({ checkId: check.checkId, explanation: explanationText, sources: [] });
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "Failed to explain");
    } finally {
      setExplainLoading(false);
    }
  };

  const shouldForceDisplay = expanded || check.status === "fail";

  useEffect(() => {
    if (shouldForceDisplay && !explain && !explainLoading && !explainError) {
      runExplain();
    }
  }, [shouldForceDisplay]);

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm print:shadow-none print:border-neutral-300 print:break-inside-avoid ${
      shouldForceDisplay ? "border-neutral-900" : "border-neutral-200"
    }`}>
      <button 
        type="button"
        onClick={onToggle} 
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-neutral-50/50 transition-colors print:bg-white print:cursor-default"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
        <span className="shrink-0 font-mono text-xs text-neutral-400">{check.checkId}</span>
        <span className="flex-1 text-sm font-bold text-neutral-900 uppercase tracking-tight">{check.checkName}</span>
        {check.count !== undefined && check.total !== undefined && (
          <span className="shrink-0 text-xs font-mono font-bold text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded-md border border-neutral-200 print:bg-white">
            {check.count} / {check.total} exceptions
          </span>
        )}
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider ${cfg.badge}`}>
          {cfg.label}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform print:hidden ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs print:border-neutral-300 print:break-inside-avoid mt-3">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-3 print:border-neutral-200">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
            Statistical Distribution Metrics Chart
          </h4>
          <span className="font-mono text-[9px] font-bold text-neutral-300">ID AXIS MAPPING // {check.checkId}</span>
        </div>
        <div className="w-full h-[280px] relative block" style={{ height: "280px" }} data-pdf-safe="true">
          <CheckChartViewer checkId={check.checkId} sheets={reportRawSheetsData} check={check} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {shouldForceDisplay && (
          <div className="border-t border-neutral-100 bg-neutral-50/30 px-5 py-4 space-y-4 print:bg-white print:border-neutral-200">
            <div className="border-l-2 border-neutral-900 pl-3 py-0.5">
              <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-neutral-400">Parameter Bounds</p>
              <p className="text-xs text-neutral-600 mt-0.5">{check.description}</p>
              <p className="mt-1.5 text-xs font-bold text-neutral-900 bg-white border border-neutral-200 px-2.5 py-1.5 rounded-lg inline-block print:bg-white">{check.message}</p>
            </div>

            {(!explain && !explainLoading) && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs print:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-neutral-800" style={{ width: '16px', height: '16px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">Copilot Narrative Analytics</span>
                  </div>
                  <button
                    type="button"
                    onClick={runExplain}
                    className="rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800"
                  >
                    Explain Exception
                  </button>
                </div>
              </div>
            )}

            {explainLoading && <p className="text-xs font-mono font-bold text-neutral-400 print:hidden">Compiling copilot diagnostics...</p>}
            {explainError && <p className="text-xs font-mono font-bold text-rose-600 print:hidden">⚠️ {explainError}</p>}

            {explain && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 print:border-neutral-300">
                <p className="text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-400 border-b border-neutral-100 pb-1 mb-2">Automated Copilot Narrative Insight</p>
                <div className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-800">{explain.explanation}</div>
              </div>
            )}

            {check.details && check.details.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider font-mono text-neutral-400">
                  Detailed Discrepancy Register (Showing first {Math.min(check.details.length, 50)} captured exception items)
                </p>
                <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-white print:max-h-none print:overflow-visible print:border-neutral-300">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-neutral-50 text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-wider border-b border-neutral-200 z-10 print:static print:bg-neutral-100">
                      <tr>
                        <th className="px-4 py-2.5">Row</th>
                        <th className="px-4 py-2.5">Column</th>
                        <th className="px-4 py-2.5">Cell</th>
                        <th className="px-4 py-2.5">Bad value</th>
                        <th className="px-4 py-2.5">Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700 print:divide-neutral-200">
                      {check.details.map((d, i) => (
                        <tr key={i} className="hover:bg-neutral-50/40 transition-colors text-[11px] print:hover:bg-white">
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-neutral-400">{d.rowIndex ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-neutral-950 font-bold print:font-semibold">{d.field ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-neutral-600">{d.cellRef ?? "-"}</td>
                          <td className="whitespace-nowrap px-4 py-2 font-mono">
                            <span className="bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200 font-bold text-neutral-800 print:bg-white print:p-0 print:border-none">
                              {formatCellValue(d.value)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-neutral-500 font-sans print:text-neutral-800">{d.issue ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}