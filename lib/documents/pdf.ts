import { chromium } from "playwright";

const CONTAINER_ARGS = [
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

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
  const errors: string[] = [];

  try {
    return await chromium.launch({
      args: CONTAINER_ARGS,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      headless: true,
    });
  } catch (error) {
    errors.push(formatLaunchError("playwright-chromium", error));
  }

  try {
    return await chromium.launch({
      args: CONTAINER_ARGS,
      channel: "chrome",
      headless: true,
    });
  } catch (error) {
    errors.push(formatLaunchError("chrome", error));
  }

  try {
    return await chromium.launch({
      args: CONTAINER_ARGS,
      channel: "msedge",
      headless: true,
    });
  } catch (error) {
    errors.push(formatLaunchError("msedge", error));
  }

  throw new Error(
    `Não foi possível iniciar o navegador para gerar PDF. Tentativas: ${errors.join(" | ")}`,
  );
}

function formatLaunchError(target: string, error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return `${target}: ${error.message}`;
  }

  return `${target}: falha desconhecida`;
}
