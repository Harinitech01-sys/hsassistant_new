"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalysisReport } from "@/types";
import UploadZone from "@/components/UploadZone";
import ReportView from "@/components/ReportView";
import ChatPanel from "@/components/ChatPanel";
import Image from "next/image"; 

type AppState = "idle" | "uploading" | "analyzing" | "done" | "error";

const CHECKS = [
  { id: "C1", label: "Column completeness — no blank/NULL in mapped columns" },
  { id: "C2", label: "Total redeemable points (manual) = system-calculated" },
  { id: "C3", label: "Order step code must be post, cncl, or open" },
  { id: "C4", label: "manual_PLTR = points_left_to_redeem" },
  { id: "C5", label: "Business unit description present for posted orders" },
  { id: "C6", label: "Non-earning records only for dormant accounts" },
  { id: "C7", label: "Date of transaction NULL vs NOT NULL (B − C = D)" },
  { id: "C8", label: "Scheduler count matches output count" },
  { id: "C9", label: "Job run date consistency (load date = previous day)" },
];

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFile = useCallback(async (file: File) => {
    setState("uploading");
    setErrorMsg("");
    setReport(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setState("analyzing");
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setReport(data as AnalysisReport);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, []);

  const handleReset = () => {
    setState("idle");
    setReport(null);
    setErrorMsg("");
  };

  return (
    <main className="relative min-h-screen text-black">
      {/* FLUID FULL-WIDTH HEADER 
        Removed the max-width centering blocks to allow the logo to sit at the absolute left edge of the monitor screen
      */}
      <header className="sticky top-0 z-30 w-full border-b border-orange-100 bg-white/70 backdrop-blur-xl">
        <div className="w-full flex items-center justify-between px-6 py-4 sm:px-10">
          
          {/* PROPORTIONAL CORPORATE BRANDING CONTAINER 
            Increased sizing scale parameters explicitly to render the logo text beautifully clear and large
          */}
          <div className="relative h-12 w-52 shrink-0 block">
            <Image 
              src="/logo.jpg" 
              alt="ValueHealth Logo" 
              fill
              priority
              className="object-contain object-left scale-150 origin-left"
            />
          </div>

          {/* New file application context switch */}
          {state === "done" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-bold text-black shadow-sm transition-colors hover:bg-neutral-50"
            >
              <svg className="h-4 w-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              New file
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Dashboard Grid Layout */}
      <div className="mx-auto max-w-6xl px-6">
        <AnimatePresence mode="wait">
          {(state === "idle" || state === "error") && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12 py-16"
            >
              <section className="text-center">
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mb-4 inline-block rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-bold text-orange-800 shadow-sm"
                >
                  AI-powered · cell-level precision · RAG assistant
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.05 }}
                  className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-black sm:text-6xl"
                >
                  Catch every loyalty data <span className="text-gradient">anomaly</span>, down to the cell.
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.12 }}
                  className="mx-auto mt-5 max-w-xl text-base font-bold text-black/70"
                >
                  Upload your daily Master Tables workbook to run all 9 data-quality checks. Get the
                  exact row, column, and cell of every problem — then ask the AI to explain and fix it.
                </motion.p>
              </section>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="glass rounded-3xl p-6 shadow-sm"
              >
                <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-black/60">Checks performed on upload</h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {CHECKS.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 rounded-md bg-orange-500 px-1.5 py-0.5 font-mono text-[11px] font-black text-white">
                        {c.id}
                      </span>
                      <span className="text-sm font-semibold text-black">{c.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <UploadZone onFile={handleFile} />

              {state === "error" && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-black text-rose-900">Analysis failed</p>
                    <p className="mt-0.5 text-sm font-bold text-rose-800">{errorMsg}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {(state === "uploading" || state === "analyzing") && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-5 py-32"
            >
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-orange-500/20 border-t-orange-600" />
                <div className="absolute inset-2 animate-pulse rounded-full bg-orange-500/10" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-black">
                  {state === "uploading" ? "Uploading file…" : "Running anomaly checks…"}
                </p>
                <p className="mt-1 text-xs font-bold text-black/60">Analyzing all 9 data-quality rules</p>
              </div>
            </motion.div>
          )}

          {state === "done" && report && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-12"
            >
              <ReportView report={report} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatPanel report={report} />
    </main>
  );
}