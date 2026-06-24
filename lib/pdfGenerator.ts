import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnomalyResult } from "@/types";
 
async function fetchChartImage(chartUrl: string): Promise<Uint8Array> {
  const response = await fetch(chartUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch chart image: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
 
function splitTextIntoLines(text: string, font: any, size: number, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
 
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
 
  if (currentLine) {
    lines.push(currentLine);
  }
 
  return lines;
}
 
export async function generateReportPdfBuffer(checks: AnomalyResult[], runDate: string): Promise<Buffer> {
  const totalChecks = checks.length;
  const failedChecks = checks.filter((r) => r.status === "fail" || r.status === "warning");
  const passed = totalChecks - failedChecks.length;
 
  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(
    JSON.stringify({
      type: "doughnut",
      data: {
        labels: ["Passed", "Failed"],
        datasets: [{ data: [passed, failedChecks.length], backgroundColor: ["#10B981", "#EF4444"] }],
      },
      options: {
        plugins: {
          legend: { display: true, position: "bottom", labels: { color: "#0f172a" } },
        },
      },
    })
  )}&w=500&h=320`;
 
  const chartImageBytes = await fetchChartImage(chartUrl);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
 
  let y = 780;
  const margin = 50;
  const maxWidth = 595 - margin * 2;
  const lineHeight = 16;
 
  let currentPage = page;
  currentPage.drawText("HS Assist Data Quality Report", {
    x: margin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.06, 0.09, 0.16),
  });
 
  y -= 28;
  page.drawText(`Run date: ${runDate}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.28, 0.34, 0.41),
  });
 
  y -= 24;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 595 - margin, y },
    thickness: 1,
    color: rgb(0.89, 0.91, 0.94),
  });
 
  y -= 20;
  page.drawText("Summary", {
    x: margin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.06, 0.09, 0.16),
  });
 
  y -= 18;
  page.drawText(`Total checks: ${totalChecks}`, { x: margin, y, size: 11, font, color: rgb(0.2, 0.26, 0.33) });
  y -= lineHeight;
  page.drawText(`Passed: ${passed}`, { x: margin, y, size: 11, font, color: rgb(0.2, 0.26, 0.33) });
  y -= lineHeight;
  page.drawText(`Failed: ${failedChecks.length}`, { x: margin, y, size: 11, font, color: rgb(0.2, 0.26, 0.33) });
 
  y -= 36;
  const img = await pdfDoc.embedPng(chartImageBytes);
  const imgDims = img.scaleToFit(500, 300);
  page.drawImage(img, {
    x: margin,
    y: y - imgDims.height,
    width: imgDims.width,
    height: imgDims.height,
  });
 
  y -= imgDims.height + 30;
 
  page.drawText("Anomalies Detected", {
    x: margin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.06, 0.09, 0.16),
  });
 
  y -= 20;
  if (failedChecks.length === 0) {
    const lines = splitTextIntoLines("No anomalies detected. All validation checks passed.", font, 11, maxWidth);
    lines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.06, 0.09, 0.16) });
      y -= lineHeight;
    });
  } else {
    const items = failedChecks.slice(0, 20);
    for (const check of items) {
      const headline = `• ${check.checkId} ${check.checkName} [${check.status.toUpperCase()}]`;
      const headlineLines = splitTextIntoLines(headline, font, 10, maxWidth);
      headlineLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.06, 0.09, 0.16) });
        y -= lineHeight;
      });
 
      if (check.message) {
        const messageLines = splitTextIntoLines(check.message, font, 9, maxWidth - 12);
        messageLines.forEach((line) => {
          currentPage.drawText(line, { x: margin + 12, y, size: 9, font, color: rgb(0.28, 0.34, 0.41) });
          y -= lineHeight;
        });
      }
      y -= 6;
      if (y < 80) {
        currentPage = pdfDoc.addPage([595, 842]);
        y = 780;
      }
    }
 
    if (failedChecks.length > 20) {
      const note = `Showing first 20 of ${failedChecks.length} anomalies.`;
      page.drawText(note, { x: margin, y, size: 9, font, color: rgb(0.39, 0.46, 0.55) });
      y -= lineHeight;
    }
  }
 
  if (y < 70) {
    const footerPage = pdfDoc.addPage([595, 842]);
    footerPage.drawText("Generated by HS Assist AI.", {
      x: margin,
      y: 40,
      size: 10,
      font,
      color: rgb(0.39, 0.46, 0.55),
    });
  } else {
    page.drawText("Generated by HS Assist AI.", {
      x: margin,
      y: 40,
      size: 10,
      font,
      color: rgb(0.39, 0.46, 0.55),
    });
  }
 
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
 
 