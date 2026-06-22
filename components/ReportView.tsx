"use client";

import { useState } from "react";
import type { AnalysisReport } from "@/types";
import CheckChartViewer from "./CheckChartViewer";

interface ReportViewProps {
  report: AnalysisReport;
}

export default function ReportView({ report }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<"all" | "fail" | "pass" | "warning">("all");

  const filteredChecks = report.checks.filter((check) => {
    if (activeTab === "all") return true;
    if (activeTab === "fail") return check.status === "fail";
    if (activeTab === "pass") return check.status === "pass";
    if (activeTab === "warning") return check.status === "warning" || check.status === "info";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* SCOREBOARD METRICS HEADER */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-neutral-400">Total Checks</p>
          <p className="mt-2 text-3xl font-black text-neutral-800">{report.summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-600/80">Passed</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{report.summary.passed}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/30 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-rose-600/80">Failed</p>
          <p className="mt-2 text-3xl font-black text-rose-700">{report.summary.failed}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-amber-600/80">Info / Warn</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{report.summary.warnings}</p>
        </div>
      </div>

      {/* METRIC FILTER NAVIGATION TABS */}
      <div className="flex border-b border-neutral-200 gap-6 text-sm font-bold">
        {(["all", "fail", "pass", "warning"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 capitalize transition-colors relative ${
              activeTab === tab ? "text-orange-600 border-b-2 border-orange-500 font-black" : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            {tab === "warning" ? "Info / Warn" : tab}
          </button>
        ))}
      </div>

      {/* EVALUATION RULES GRID */}
      <div className="space-y-4">
        {filteredChecks.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm font-medium text-neutral-400">
            No rules match the selected metric criteria.
          </div>
        ) : (
          filteredChecks.map((check) => (
            <DynamicAccordionCard 
              key={check.checkId} 
              check={check} 
              rawSheetsData={report.rawSheetsData} 
            />
          ))
        )}
      </div>
    </div>
  );
}

// Sub-Component: Handles individual card toggle and automated Groq API fetching
function DynamicAccordionCard({ check, rawSheetsData }: { check: any; rawSheetsData: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiText, setAiText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    const opening = !isExpanded;
    setIsExpanded(opening);

    // Call the Groq runtime engine only if expanding and text hasn't been fetched yet
    if (opening && !aiText && !loading) {
      setLoading(true);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkId: check.checkId,
            checkName: check.checkName,
            status: check.status,
            message: check.message,
            details: check.details,
          }),
        });
        const data = await res.json();
        setAiText(data.aiExplanation || "An execution breakdown error occurred.");
      } catch (err) {
        setAiText("Could not reach Groq analytical servers. Check your local API key configuration.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:shadow-md">
      {/* CARD ACCORDION CONTROLLER HEADER */}
      <div 
        onClick={handleToggle}
        className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-6 py-4 cursor-pointer hover:bg-neutral-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-orange-500 px-2 py-0.5 font-mono text-xs font-black text-white">
            {check.checkId}
          </span>
          <h3 className="text-sm font-black text-neutral-800">{check.checkName}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${
            check.status === "pass" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}>
            {check.status}
          </span>
          <svg className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* DROPDOWN VIEWS LAYER */}
      {isExpanded && (
        <div className="p-6 space-y-5">
          <p className="text-xs font-bold text-neutral-400">{check.description}</p>
          <p className="text-sm font-bold text-neutral-800">{check.message}</p>

          {check.details && check.details.length > 0 && (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/30 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">Detailed Mismatch Flags Log</p>
              <div className="max-h-40 overflow-y-auto text-xs font-mono text-neutral-600 space-y-1">
                {check.details.map((detail: any, i: number) => (
                  <div key={i} className="border-b border-neutral-100 last:border-0 py-1">
                    {detail.issue || `Row Exception flag at cell ref: ${detail.cellRef}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DYNAMIC GROQ AI DISPATCH BLOCK */}
          <div className={`rounded-xl p-4 space-y-1.5 border ${
            check.status === "pass" ? "bg-emerald-50/40 border-emerald-100" : "bg-orange-50/40 border-orange-100"
          }`}>
            <div className="flex items-center gap-1.5">
              <span>{check.status === "pass" ? "✨" : "⚠️"}</span>
              <p className={`text-xs font-black uppercase tracking-wider ${check.status === "pass" ? "text-emerald-800" : "text-orange-800"}`}>
                {check.status === "pass" ? "AI Verification Summary" : "AI Diagnostic Explanation"}
              </p>
            </div>
            
            {loading ? (
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 py-1">
                <div className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-600" />
                Querying Groq context engines...
              </div>
            ) : (
              <p className="text-sm font-semibold text-neutral-700 leading-relaxed whitespace-pre-line">
                {aiText}
              </p>
            )}
          </div>

          {/* DYNAMIC VISUAL CHART VIEWER (ALWAYS RENDERS EXACTLY BELOW AI EXPLANATION BOX) */}
          <div className="pt-4 border-t border-neutral-100">
            <CheckChartViewer 
              checkId={check.checkId} 
              sheets={rawSheetsData} 
              check={check} 
            />
          </div>
        </div>
      )}
    </div>
  );
}