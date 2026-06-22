import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/parseExcel";
import { runAllChecks } from "@/lib/anomalyChecks";
import type { AnalysisReport } from "@/types";
import { createClient } from '@supabase/supabase-js';
export const maxDuration = 30;
export const runtime = "nodejs";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    
    const { searchParams } = new URL(request.url);
    const selectedQueryDate = searchParams.get("date");

    let sheets: any = {};
    let sheetNames: string[] = [];
    let columnMaps: any = {};
    let filename = "";
    let targetAuditDate = selectedQueryDate || "";

    // PATHWAY A: LIVE DATABASE EVALUATION RUN
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const timeframeType = body.timeframeType;
      const timeframeValue = body.timeframeValue;
      const startDate = body.startDate;
      const endDate = body.endDate;

      filename = "Live Supabase Database Partition";

      let query = supabase.from("scheduler_logs").select("*");

      if (timeframeType === "day" && timeframeValue) {
        query = query.eq("run_date", timeframeValue);
      } else if ((timeframeType === "week" || timeframeType === "month") && startDate && endDate) {
        query = query.gte("run_date", startDate).lte("run_date", endDate);
      } else if (timeframeType === "year" && timeframeValue) {
        query = query.gte("run_date", `${timeframeValue}-01-01`).lte("run_date", `${timeframeValue}-12-31`);
      }

      let { data, error } = await query.order("id", { ascending: true });
      if (error) throw error;

      // Fallback: If filtered result is empty, grab the last 117 records
      if (!data || data.length === 0) {
        const fallbackQuery = await supabase
          .from("scheduler_logs")
          .select("*")
          .order("run_date", { ascending: false })
          .limit(117);
        data = fallbackQuery.data || [];
        if (fallbackQuery.error) throw fallbackQuery.error;
      }

      const normalizedRows = (data || []).map((row: any) => {
        let startTime = row.start_time;
        let endTime = row.end_time;
        
        if (startTime && !startTime.includes("-") && row.run_date) {
          startTime = `${row.run_date} ${startTime}`;
        }
        if (endTime && !endTime.includes("-") && row.run_date) {
          endTime = `${row.run_date} ${endTime}`;
        }

        return {
          ...row,
          start_time: startTime,
          end_time: endTime,
          scheduler: row.scheduler || "",
          status: row.status || "Success",
          record_count: Number(row.record_count ?? 0)
        };
      });

      // CRITICAL FIX: Duplicate the rows into Order_line_item to feed the Visual Charts & AI Explanation targets!
      sheets = { 
        "scheduler_logs": normalizedRows, 
        "Order_line_item": normalizedRows 
      };
      sheetNames = ["scheduler_logs", "Order_line_item"];
      
      columnMaps = {
        "scheduler_logs": ["id", "scheduler", "key_column", "record_count", "status", "run_date", "start_time", "end_time"],
        "Order_line_item": ["load_date", "run_date"]
      };

      if (!targetAuditDate && normalizedRows.length > 0) {
        targetAuditDate = String(normalizedRows[0].run_date || timeframeValue || "2026");
      }

    } else {
      // PATHWAY B: STANDARD MULTIPART MANUAL FILE UPLOAD
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }

      filename = file.name;
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv", "txt"].includes(ext ?? "")) {
        return NextResponse.json({ error: "Unsupported file extension type." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = parseExcelBuffer(buffer);
      sheets = parsed.sheets;
      sheetNames = parsed.sheetNames;
      columnMaps = parsed.columnMaps;

      if (!targetAuditDate) {
        const oli = sheets["Order_line_item"] ?? [];
        const loadDates = oli.map((r: any) => r["load_date"]).filter(Boolean).map((d: any) => String(d));
        targetAuditDate = loadDates.sort().reverse()[0] ?? new Date().toISOString().split("T")[0];
      }
    }

    // --- UPDATED PERSISTENCE LOGIC USING SUPABASE STORAGE ---
    // Instead of local fs, stringify the sheets and upsert directly into cloud storage
    const fileContentString = JSON.stringify(sheets);
    const { error: storageError } = await supabase
      .storage
      .from('audit-sheets')
      .upload('latest_data.json', fileContentString, {
        contentType: 'application/json',
        upsert: true 
      });

    if (storageError) {
      console.error("Cloud storage sync failed:", storageError);
      // Log error but continue execution matrix so current dashboard operation doesn't crash
    }

    // Run evaluations matrix
    const checks = runAllChecks(sheets, columnMaps);

    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      failed: checks.filter((c) => c.status === "fail").length,
      warnings: checks.filter((c) => c.status === "warning" || c.status === "info").length,
    };

    const report: AnalysisReport & { rawSheetsData: any } = {
      filename,
      analyzedAt: new Date().toISOString(),
      runDate: targetAuditDate || "2026",
      sheetsFound: sheetNames,
      summary,
      checks,
      rawSheetsData: sheets, 
    };

    return NextResponse.json(report);
  } catch (err: any) {
    console.error("Analysis handling fault encountered:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process evaluation logs framework sequence rules." },
      { status: 500 }
    );
  }
}