const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const results = [];
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://localhost:3111/mock-tests", { waitUntil: "networkidle", timeout: 45000 });
    const heading = await page.locator("h1").first().innerText().catch(() => "NO_H1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    results.push({ width, heading, overflowX: overflow, panels: await page.locator(".exam-panel").count(), errors: errors.length });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
