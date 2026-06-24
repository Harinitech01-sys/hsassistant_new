import nodemailer from "nodemailer";
import { buildReportHtml, buildStaticChartUrl } from "@/lib/reportBuilder";
import { generatePdfBuffer } from "@/lib/pdfGenerator";



// CRUCIAL NAMED EXPORT: Directly satisfies the 'import { transporter }' statement in route.ts

export const transporter = nodemailer.createTransport({

  host: process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com",

  port: Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 465),

  secure: true, // true for port 465, false for other ports

  auth: {

    user: process.env.EMAIL_USER || process.env.SMTP_USER, // harini16018@gmail.com

    pass: process.env.EMAIL_PASS || process.env.SMTP_PASS, // dnnogzkuhojrhacv

  },

});



/**

 * Dispatches a detailed operational metric report containing an attached PDF buffer downstream.

 */

export async function sendDailyReport(

  subject: string, 

  htmlBody: string, 

  pdfBuffer: Buffer

): Promise<boolean> {

  const targetReceiver = process.env.EMAIL_RECEIVER || "keerthusara2007@gmail.com";



  try {
    const info = await transporter.sendMail({
      from: `"Data Quality Engine" <${process.env.EMAIL_USER || process.env.SMTP_USER}>`,
      to: targetReceiver,
      subject: subject,
      html: htmlBody,
      attachments:
        pdfBuffer && pdfBuffer.length > 0
          ? [
              {
                filename: `Data_Quality_Report_${new Date().toISOString().split("T")[0]}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ]
          : [],
    });

    console.log(`✓ Email successfully sent to ${targetReceiver}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("✖ Failed to send transaction report email message payload:", error);
    throw error;
  }

}



/**

 * Resilient Alias Export matching explicit key interfaces expected by the dashboard triggers.

 */

export async function sendAdminEmail(params: {

  to: string;

  subject: string;

  html: string;

  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;

}): Promise<boolean> {

  const attachmentBuffer = params.attachments && params.attachments.length > 0 

    ? params.attachments[0].content 

    : Buffer.from("");

    

  return sendDailyReport(params.subject, params.html, attachmentBuffer);

}
// Re-export helpers for backward-compatible imports used by API routes
export { buildReportHtml, buildStaticChartUrl, generatePdfBuffer };

