import puppeteer from 'puppeteer';

export async function generatePdfBuffer(htmlContent: string): Promise<Buffer> {
  // Launch a headless browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  
  const page = await browser.newPage();
  
  // FIX: Use 'load' instead of 'networkidle0' for setContent
  await page.setContent(htmlContent, { waitUntil: 'load' });
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
  });

  await browser.close();
  
  return Buffer.from(pdfBuffer);
}