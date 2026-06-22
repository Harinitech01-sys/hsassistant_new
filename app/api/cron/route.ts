import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate endpoint execution signature via query params
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized trigger signature." }, { status: 401 });
    }

    // 2. Parse the dynamic metrics directly out of the request body incoming from the frontend
    const body = await req.json();
    const { totalRows = 0, passedChecks = [], failedChecks = [] } = body;

    // 3. Construct the clean, modern HTML email template layout
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1e293b; background-color: #f8fafc; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0;">
        
        <div style="margin-bottom: 24px; text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
          <h2 style="color: #4f46e5; margin: 0 0 4px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">ValueHealth Data Audit Center</h2>
          <p style="color: #64748b; margin: 0; font-size: 14px; font-weight: 500;">Live Runtime Analytics Report</p>
        </div>
        
        <div style="background: #ffffff; padding: 14px 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; color: #475569; font-weight: 600;">Uploaded Dataset Records Count:</span>
          <span style="font-size: 16px; font-weight: 800; color: #0f172a;">${totalRows} Rows</span>
        </div>

        <div style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #15803d; font-size: 16px; font-weight: 700;">
            ✅ Passed Validation Gates (${passedChecks.length})
          </h3>
          ${passedChecks.length > 0 
            ? `<div style="margin: 0;">
                ${passedChecks.map((c: string) => `<span style="display: inline-block; background: #f0fdf4; color: #16a34a; font-weight: 700; font-size: 12px; padding: 6px 12px; border-radius: 6px; border: 1px solid #dcfce7; margin-right: 6px; margin-bottom: 6px;">${c}</span>`).join("")}
               </div>`
            : `<p style="margin: 0; color: #64748b; font-size: 13px; font-style: italic;">No rules passed during this validation run.</p>`
          }
        </div>

        <div style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #fecaca; border-left: 5px solid #dc2626; margin-bottom: 28px;">
          <h3 style="margin: 0 0 12px 0; color: #991b1b; font-size: 16px; font-weight: 700;">
            ❌ Flagged Compliance Anomalies (${failedChecks.length})
          </h3>
          ${failedChecks.length > 0 
            ? `<div style="margin: 0;">
                ${failedChecks.map((c: string) => `<span style="display: inline-block; background: #fef2f2; color: #dc2626; font-weight: 700; font-size: 12px; padding: 6px 12px; border-radius: 6px; border: 1px solid #fee2e2; margin-right: 6px; margin-bottom: 6px;">${c}</span>`).join("")}
               </div>`
            : `<p style="margin: 0; color: #16a34a; font-size: 13px; font-style: italic; font-weight: 600;">Perfect Pass! Zero metrics anomalies isolated.</p>`
          }
        </div>

        <div style="text-align: center; margin-top: 32px; margin-bottom: 20px;">
          <a href="http://localhost:3000" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
            Open Audit Dashboard 📊
          </a>
        </div>
      </div>
    `;

    // 4. Extract and clean email parameters from environment variables
    const mailHost = process.env.EMAIL_HOST?.replace(/['"]+/g, "") || "smtp.gmail.com";
    const mailPort = Number(process.env.EMAIL_PORT?.replace(/['"]+/g, "") || 465);
    const mailUser = process.env.EMAIL_USER?.replace(/['"]+/g, "");
    const mailPass = process.env.EMAIL_PASS?.replace(/['"]+/g, "");
    const mailReceiver = process.env.EMAIL_RECEIVER?.replace(/['"]+/g, "");

    if (!mailUser || !mailPass || !mailReceiver) {
      return NextResponse.json({ error: "Configuration Error: Required email parameters are missing." }, { status: 500 });
    }

    // 5. Initialize clean SMTP transport architecture
    const transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailPort === 465, 
      auth: { user: mailUser, pass: mailPass },
    });

    // 6. Send the email layout
    await transporter.sendMail({
      from: `"HS Assist Audit Engine" <${mailUser}>`,
      to: mailReceiver,
      subject: `Loyalty Compliance Integrity Update (${new Date().toLocaleDateString()})`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, message: "Dynamic dashboard notification dispatched successfully." });

  } catch (error: any) {
    console.error("DYNAMIC SMTP FAILURE:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}