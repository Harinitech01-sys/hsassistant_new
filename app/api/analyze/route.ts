import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/parseExcel";
import { runAllChecks } from "@/lib/anomalyChecks";
import type { AnalysisReport } from "@/types";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // 1. EXTRACT THE CHOSEN DATE FROM THE URL QUERY PARAMETERS
    const { searchParams } = new URL(request.url);
    const selectedQueryDate = searchParams.get("date"); // e.g., "2026-06-15"

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      return NextResponse.json({ error: "Only .xlsx or .xls files are supported." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { sheets, sheetNames, columnMaps } = parseExcelBuffer(buffer);

    // 2. COMPUTE BACKUP RUN DATE IF NO QUERY PARAMETER WAS PASSED
    const oli = sheets["Order_line_item"] ?? [];
    const loadDates = oli
      .map((r) => r["load_date"])
      .filter(Boolean)
      .map((d) => String(d));
    
    const fallbackRunDate = loadDates.sort().reverse()[0] ?? new Date().toISOString().split("T")[0];
    
    // Use the user's selected date if available; otherwise, drop back to file metadata date
    const targetAuditDate = selectedQueryDate || fallbackRunDate;

    // ==============================================================
    // CRITICAL FIX: Only pass the 2 arguments your function expects!
    // ==============================================================
    const checks = runAllChecks(sheets, columnMaps);

    // 4. CALCULATE DYNAMIC METRIC RATIOS
    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      failed: checks.filter((c) => c.status === "fail").length,
      warnings: checks.filter((c) => c.status === "warning" || c.status === "info").length,
    };

    const report: AnalysisReport & { rawSheetsData: any } = {
      filename: file.name,
      analyzedAt: new Date().toISOString(),
      runDate: targetAuditDate,
      sheetsFound: sheetNames,
      summary,
      checks,
      rawSheetsData: sheets, // Keeps your live charts fed with data!
    };

    return NextResponse.json(report);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze file. Please ensure it is a valid Master Tables Excel file." },
      { status: 500 }
    );
  }
}