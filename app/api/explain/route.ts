import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// 1. INLINE TRANSPORTER CONFIGURATION (BYPASSES DYNAMIC ROUTING & CACHE ERRORS)
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, reportData, messageContext } = body;

    // Compile dynamic HTML report context
    const dynamicHtmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; color: #ffffff;">
          <h3 style="margin: 0; font-size: 18px;">AI Anomaly Analysis Breakdown</h3>
        </div>
        <div style="padding: 20px; background-color: #ffffff; line-height: 1.6;">
          <p style="font-size: 14px; color: #475569;">
            <strong>Context Analysis Report:</strong> The following anomalies have been identified and reviewed by the AI framework.
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 15px 0;" />
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #ea580c; border-radius: 4px; font-size: 14px;">
            ${messageContext || "No additional explanation context was supplied."}
          </div>
        </div>
      </div>
    `;

    // 2. Dispatch the payload using the inlined transporter assets
    await transporter.sendMail({
      from: `"Data Quality Engine" <${process.env.EMAIL_USER}>`,
      to: email || process.env.EMAIL_RECEIVER,
      subject: "Data Quality Engine - AI Anomaly Analysis Breakdown",
      html: dynamicHtmlBody,
    });

    return NextResponse.json({ success: true, message: "Explanation sent cleanly." });
  } catch (error: any) {
    console.error("Route Error Transmission Exception:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server transmission breakdown." },
      { status: 500 }
    );
  }
}