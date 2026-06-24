import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import type { AnomalyResult } from "@/types";
 
const WINDOWS_CHROME_PATHS = [
  process.env.CHROME_PATH,
  process.env.CHROMIUM_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
 
async function resolveBrowserExecutablePath(): Promise<string | undefined> {
  const envPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
  ];
 
  for (const envPath of envPaths) {
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }
  }
 
  for (const chromePath of WINDOWS_CHROME_PATHS) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
 
  try {
    const chromiumPath = await chromium.executablePath();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      return chromiumPath;
    }
  } catch (_error) {
    // ignore and fall back
  }
 
  return undefined;
}
 
export async function generatePdfBuffer(htmlContent: string): Promise<Buffer> {
  // Launch a headless browser instance using the Chromium binary package when available
  const executablePath = await resolveBrowserExecutablePath();
  if (!executablePath) {
    throw new Error("No Chrome or Chromium executable found for PDF generation.");
  }
 
  const launchOptions: any = {
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", ...chromium.args],
    headless: true,
  };
 
  const browser = await puppeteer.launch(launchOptions);
 
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
 