import { chromium } from "playwright";

export async function renderDocumentPdf(html: string) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });

    return await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    try {
      return await chromium.launch({ channel: "msedge", headless: true });
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Não foi possível iniciar o navegador para gerar PDF: ${error.message}`
          : "Não foi possível iniciar o navegador para gerar PDF.",
      );
    }
  }
}
