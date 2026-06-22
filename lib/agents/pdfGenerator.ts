import puppeteer from "puppeteer";
import type { AnomalyResult } from "@/types";

export async function generatePdfBuffer(htmlContent: string): Promise<Buffer> {
  // Launch a headless browser instance safely using sandboxing arguments
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  
  const page = await browser.newPage();
  
  // Use 'load' instead of 'networkidle0' to ensure page layout buffers match stream completions
  await page.setContent(htmlContent, { waitUntil: "load" });
  
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
  });

  await browser.close();
  
  return Buffer.from(pdfBuffer);
}

// Resilient Alias Export to match chronological context invocations inside the cron framework
export async function generateReportPdfBuffer(checks: AnomalyResult[], runDate: string): Promise<Buffer> {
  const totalChecks = checks.length;
  const failedChecks = checks.filter(r => r.status === "fail" || r.status === "warning");
  const passCount = totalChecks - failedChecks.length;
  
  const temporaryConfigUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
    type: "doughnut",
    data: {
      labels: ["Passed", "Failed"],
      datasets: [{ data: [passCount, failedChecks.length], backgroundColor: ["#10B981", "#EF4444"] }]
    }
  }))}&w=400&h=250`;

  const standaloneHtml = `
    <html>
      <head><style>body { font-family: Arial, sans-serif; padding: 30px; color: #333; }</style></head>
      <body>
        <h2>Data Quality PDF Audit Report</h2>
        <p><strong>Target Run Scope Context:</strong> ${runDate}</p>
        <p>Passed: ${passCount} / Total Rules Checked: ${totalChecks}</p>
        <br/>
        <img src="${temporaryConfigUrl}" width="350"/>
      </body>
    </html>
  `;
  return generatePdfBuffer(standaloneHtml);
}