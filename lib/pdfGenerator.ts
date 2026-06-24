import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core"; // Keeps the deployment bundle small
import chromium from "@sparticuz/chromium";
import type { AnomalyResult } from "@/types";

const commonLinuxPaths = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
];

const commonMacPaths = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const commonWinPaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

async function resolveBrowserExecutablePath(): Promise<string | undefined> {
  // 1. Check environment overrides first
  const envPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
  ];

  for (const envPath of envPaths) {
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }
  }

  // 2. Netlify Production Environment / AWS Lambda
  if (process.env.NETLIFY === "true" || process.env.NODE_ENV === "production") {
    try {
      return await chromium.executablePath();
    } catch (error) {
      console.warn("Sparticuz Chromium resolution failed in production:", error);
    }
  }

  // 3. Local Development Fallbacks (Windows / Mac / Linux)
  const localCandidates = [
    ...(process.platform === "win32" ? commonWinPaths : []),
    ...commonMacPaths,
    ...commonLinuxPaths,
  ];

  for (const candidate of localCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function getPuppeteerLaunchArgs(): Promise<string[]> {
  // If we are on Netlify production, use sparticuz specialized flags
  if (process.env.NETLIFY === "true" || process.env.NODE_ENV === "production") {
    return chromium.args;
  }

  // Local development arguments
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
  ];
}

export async function generatePdfBuffer(htmlContent: string): Promise<Buffer> {
  const executablePath = await resolveBrowserExecutablePath();
  
  if (!executablePath) {
    throw new Error("Could not find a valid Chrome or Chromium executable path.");
  }

  const browser = await puppeteer.launch({
    args: await getPuppeteerLaunchArgs(),
    executablePath: executablePath,
    headless: true, // Type-safe implementation across all environments
  });

  const page = await browser.newPage();

  // "load" satisfies TypeScript's strict union criteria perfectly
  await page.setContent(htmlContent, { waitUntil: "load" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}

export async function generateReportPdfBuffer(checks: AnomalyResult[], runDate: string): Promise<Buffer> {
  const totalChecks = checks.length;
  const failedChecks = checks.filter((r) => r.status === "fail" || r.status === "warning");
  const passCount = totalChecks - failedChecks.length;
  
  const temporaryConfigUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
    type: "doughnut",
    data: {
      labels: ["Passed", "Failed"],
      datasets: [{ data: [passCount, failedChecks.length], backgroundColor: ["#10B981", "#EF4444"] }],
    },
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