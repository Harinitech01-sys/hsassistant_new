import { NextRequest, NextResponse } from "next/server";
import type { AnomalyResult } from "@/types";
import { generatePdfBuffer } from "@/lib/emailService";
 
export const runtime = "nodejs";
 
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const checks = body?.checks as AnomalyResult[] | undefined;
 
    if (!Array.isArray(checks) || checks.length === 0) {
      return NextResponse.json(
        { error: "No report checks were provided for PDF generation." },
        { status: 400 }
      );
    }
 
    const pdfBuffer = await generatePdfBuffer(checks, new Date().toISOString());
    const pdfBytes = new Uint8Array(pdfBuffer);
 
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Data_Quality_Report_${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("❌ PDF generation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate PDF." },
      { status: 500 }
    );
  }
}
 
 