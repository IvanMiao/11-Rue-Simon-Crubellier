import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const baseUrl = args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:5181';
const includeProps = args.includes('--props');
const screenshotDir = '/home/ubuntu/sim';
const consoleErrors = [];
const pageErrors = [];
const screenshots = [];
let browser;

try {
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    executablePath: '/home/ubuntu/.local/bin/google-chrome',
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const capture = async (url, readyFlag, screenshotPath, fullPage = false) => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`Navigation failed (${response?.status()}): ${url}`);
    await page.waitForFunction((flag) => window[flag] === true, readyFlag);
    await page.screenshot({ path: screenshotPath, fullPage });
    screenshots.push(screenshotPath);
  };

  const castPath = `${screenshotDir}/a2-cast.png`;
  await capture(new URL('/cast.html', baseUrl).href, '__castReady', castPath, true);

  for (const view of ['room', 'section', ...(includeProps ? ['props'] : [])]) {
    const screenshotPath = `${screenshotDir}/a2-${view}.png`;
    const url = new URL(`/style-lab.html?static&view=${view}`, baseUrl).href;
    await capture(url, '__styleLabReady', screenshotPath);
  }
} catch (error) {
  console.error(`Art screenshot run failed: ${error instanceof Error ? error.message : String(error)}`);
  pageErrors.push(error instanceof Error ? error.message : String(error));
} finally {
  await browser?.close();
  console.log(JSON.stringify({ screenshots, consoleErrors, pageErrors }, null, 2));
  if (consoleErrors.length > 0 || pageErrors.length > 0) process.exitCode = 1;
}
