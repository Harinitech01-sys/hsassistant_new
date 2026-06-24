import { NextRequest, NextResponse } from "next/server";
import { runAllChecks } from "@/lib/anomalyChecks";
import { 
  sendDailyReport, 
  generatePdfBuffer, 
  buildStaticChartUrl, 
  buildReportHtml 
} from "@/lib/emailService"; 
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;
export const runtime = "nodejs";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // Enforce matching API keys to shield route from malicious lookups
    if (secret !== process.env.CRON_SECRET) {
      console.warn("⚠️ Security Intercept: Unauthorized route request key mismatch.");
      return NextResponse.json({ error: "Unauthorized access token reference match" }, { status: 401 });
    }

    console.log("🔄 Cron Pipeline Triggered: Accessing latest JSON audit sheet from cloud bucket...");

    // Fetch the workbook text string parsed during the last upload run
    const { data: storageFile, error: downloadError } = await supabase
      .storage
      .from('audit-sheets')
      .download('latest_data.json');

    let sheets: any = {};
    let columnMaps: any = {};

    if (downloadError || !storageFile) {
      console.warn("⚠️ Storage empty or inaccessible, falling back to raw scheduler database tables:", downloadError?.message);
      
      // Fallback: If cache file is missing, fetch history directly out of the tracking tables
      const { data: logs } = await supabase
        .from("scheduler_logs")
        .select("*")
        .order("run_date", { ascending: false })
        .limit(100);

      if (!logs || logs.length === 0) {
        return NextResponse.json({ error: "No active historical workspace data records available to compile." }, { status: 404 });
      }

      sheets = { "scheduler_logs": logs, "Order_line_item": logs };
      columnMaps = {
        "scheduler_logs": ["id", "scheduler", "record_count", "status", "run_date"],
        "Order_line_item": ["load_date", "run_date"]
      };
    } else {
      // Cleanly compile data straight out of the active cache file
      const rawText = await storageFile.text();
      sheets = JSON.parse(rawText);
      columnMaps = {
        "scheduler_logs": ["id", "scheduler", "record_count", "status", "run_date", "start_time", "end_time"],
        "Order_line_item": ["load_date", "run_date", "order_line_step_code", "customer_account_number", "total_redeemable_points"]
      };
      console.log("✅ Live spreadsheet cache downloaded and mapped successfully.");
    }

    // Process real anomalies matrix rows
    const checks = runAllChecks(sheets, columnMaps) || [];
    const total = checks.length;
    const failed = checks.filter(c => c.status === "fail" || c.status === "warning").length;
    const passed = total - failed;

    console.log(`📊 Processing metrics: Rules: ${total} // Passed: ${passed} // Exceptions: ${failed}`);

    // Build dynamic document fragments
    const chartUrl = buildStaticChartUrl(passed, failed);
    const htmlBody = buildReportHtml(checks, chartUrl);
    const runDate = new Date().toISOString();

    console.log("⏳ Spawning Headless Chromium browser context to output PDF buffer...");
    const pdfBuffer = await generatePdfBuffer(checks, runDate);

    console.log("🚀 Initializing mail payload delivery across SMTP pathways...");
    await sendDailyReport(`Data Quality Ledger Update: ${failed} Anomalies Flagged`, htmlBody, pdfBuffer);

    return NextResponse.json({ 
      success: true, 
      message: "Ledger report emailed successfully.",
      metrics: { total, passed, failed } 
    });
  } catch (err: any) {
    console.error("❌ Cron script processing terminated on framework error:", err);
    return NextResponse.json({ error: err?.message || "Internal transmission script error" }, { status: 500 });
  }
}