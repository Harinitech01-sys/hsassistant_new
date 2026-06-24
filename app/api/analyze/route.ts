import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/parseExcel";
import { runAllChecks } from "@/lib/anomalyChecks";
import type { AnalysisReport } from "@/types";
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;
export const runtime = "nodejs";

// REWRITTEN SAFE INSTANTIATION BARS EXTRACTION ERRORS ON NETLIFY BUILD
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  
  if (!url || !key) {
    // Return null instead of crashing the build. We check this later if Pathway A is selected.
    return null;
  }
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
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
      // If the user requested live Supabase checks, but keys are missing, throw the error here safely
      if (!supabase) {
        throw new Error(
          "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) are required for Live Database Evaluation."
        );
      }

      filename = "Live Supabase Database Partition";

      // 1. DYNAMIC WATERMARK LOOKUP
      const { data: lastRunLog, error: watermarkError } = await supabase
        .from("scheduler_logs")
        .select("start_time")
        .eq("status", "Success")
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (watermarkError) throw watermarkError;

      const lastWatermark = lastRunLog?.start_time || new Date(0).toISOString();
      const currentRunStartTime = new Date().toISOString();

      // 2. FETCH NEW DATA ONLY
      const { data, error } = await supabase
        .from("scheduler_logs")
        .select("*")
        .gt("start_time", lastWatermark)
        .order("start_time", { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        return NextResponse.json({
          filename,
          analyzedAt: currentRunStartTime,
          runDate: targetAuditDate || new Date().toISOString().split("T")[0],
          sheetsFound: ["scheduler_logs", "Order_line_item"],
          summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
          checks: [],
          message: "Database clear! No newly appended rows detected since last execution run.",
          rawSheetsData: { scheduler_logs: [], Order_line_item: [] }
        });
      }

      const normalizedRows = data.map((row: any) => {
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
        targetAuditDate = String(normalizedRows[0].run_date || "2026");
      }

      // 3. MOVE THE WATERMARK BOUNDARY FORWARD
      await supabase.from("scheduler_logs").insert({
        scheduler: "Dynamic Incremental Audit Engine",
        record_count: normalizedRows.length,
        status: "Success",
        run_date: currentRunStartTime.split("T")[0],
        start_time: currentRunStartTime,
        end_time: new Date().toISOString()
      });

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

    // SAFE OPTIONAL CLOUD STORAGE PERSIST LAYER
    if (supabase) {
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
      }
    } else {
      console.log("Skipping dynamic cloud sync workspace storage backup pass—Running local in-memory execution mode.");
    }

    // Run evaluations matrix on the isolated new rows cleanly
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