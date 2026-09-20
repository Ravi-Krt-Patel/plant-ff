import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.goto("http://localhost:3000");
await page.waitForTimeout(700);
const result = await new AxeBuilder({ page }).analyze();
console.log(
  JSON.stringify(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    null,
    2,
  ),
);
for (let y = 0; y < 4500; y += 600) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(120);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({
  path: "test-results/desktop-full.png",
  fullPage: true,
});
console.log(
  await page.locator("img").evaluateAll((imgs) =>
    imgs.map((i) => ({
      src: i.getAttribute("src"),
      ok: i.complete && i.naturalWidth > 0,
    })),
  ),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "test-results/mobile-top.png" });
await browser.close();
