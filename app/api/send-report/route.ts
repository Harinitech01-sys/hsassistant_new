import { NextRequest, NextResponse } from "next/server";
import { buildReportHtml, buildStaticChartUrl, generatePdfBuffer, sendDailyReport } from "@/lib/emailService";
import type { AnomalyResult } from "@/types";
 
export const runtime = "nodejs";
 
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const checks = body?.checks as AnomalyResult[] | undefined;
    const recipientEmail = body?.recipientEmail as string | undefined;
 
    if (!Array.isArray(checks) || checks.length === 0) {
      return NextResponse.json({ error: "No report checks were provided." }, { status: 400 });
    }
 
    const failed = checks.filter((check) => check.status === "fail" || check.status === "warning").length;
    const passed = checks.length - failed;
    const chartUrl = buildStaticChartUrl(passed, failed);
    const htmlBody = buildReportHtml(checks, chartUrl);
    const pdfBuffer = await generatePdfBuffer(checks, new Date().toISOString());
 
    const targetEmail = recipientEmail || process.env.EMAIL_RECEIVER || process.env.EMAIL_USER;
    if (!targetEmail) {
      return NextResponse.json({ error: "No recipient email configured." }, { status: 500 });
    }
 
    await sendDailyReport(`HS Assist Data Quality Report — ${failed} anomalies`, htmlBody, pdfBuffer, targetEmail);
 
    return NextResponse.json({ success: true, message: "Report email sent successfully.", metrics: { total: checks.length, passed, failed } });
  } catch (error: any) {
    console.error("❌ send-report route error:", error);
    return NextResponse.json({ error: error?.message || "Failed to send report email." }, { status: 500 });
  }
}
 
 